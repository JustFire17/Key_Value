const amqp = require('amqplib');
const { Pool } = require('pg');
const redis = require('redis');

let channel;
let connection;
let globalPool;
let redisClient;
let isReconnecting = false;
let processedMessages = new Set();
let deletedKeys = new Map(); // Tracks deleted keys and timestamps
const CLEANUP_INTERVAL = 3600000; // 1 hora em milissegundos

// Remove old deleted keys from the tracking map
function cleanupDeletedKeys() {
  const now = Date.now();
  for (const [key, timestamp] of deletedKeys.entries()) {
    if (now - timestamp > CLEANUP_INTERVAL) {
      deletedKeys.delete(key);
    }
  }
}

// Start periodic cleanup
setInterval(cleanupDeletedKeys, CLEANUP_INTERVAL);

// Connect to CockroachDB
async function connectCockroach() {
  const pool = new Pool({
    connectionString: process.env.COCKROACH_URL || 'postgresql://root@cockroachdb:26257/defaultdb?sslmode=disable'
  });
  // Test connection
  const client = await pool.connect();
  await client.query('SELECT 1');
  client.release();
  console.log('[OK] Connected to CockroachDB');
  return pool;
}

// Connect to RabbitMQ
async function connectRabbit() {
  try {
    if (connection) {
      await connection.close().catch(() => {});
    }
    connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://admin:admin@haproxy-rabbit:5672');
    channel = await connection.createChannel();
    
    // Error handlers
    connection.on('error', async (err) => {
      console.error('[ERROR] RabbitMQ connection error:', err);
      if (!isReconnecting) {
        isReconnecting = true;
        processedMessages.clear(); // Clear processed messages on reconnect
        setTimeout(async () => {
          try {
            await connectRabbit();
            await consumeMessages(globalPool);
          } catch (error) {
            console.error('[ERROR] Reconnect failed:', error);
          } finally {
            isReconnecting = false;
          }
        }, 5000);
      }
    });

    channel.on('error', async (err) => {
      console.error('[ERROR] RabbitMQ channel error:', err);
      if (!isReconnecting) {
        isReconnecting = true;
        processedMessages.clear(); // Clear processed messages on reconnect
        setTimeout(async () => {
          try {
            await connectRabbit();
            await consumeMessages(globalPool);
          } catch (error) {
            console.error('[ERROR] Reconnect failed:', error);
          } finally {
            isReconnecting = false;
          }
        }, 5000);
      }
    });

    await channel.assertQueue('key-value-queue', {
      durable: true,
      arguments: {
        'x-queue-type': 'quorum'
      }
    });
    console.log('[OK] Connected to RabbitMQ');
    return channel;
  } catch (error) {
    console.error('[ERROR] RabbitMQ connection failed:', error);
    throw error;
  }
}

// Connect to Redis
async function connectRedis() {
  redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://haproxy-redis:6379'
  });
  await redisClient.connect();
  console.log('[OK] Connected to Redis');
}

// Initialize table
async function initTable(pool) {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS key_value (
        key TEXT PRIMARY KEY,
        value TEXT,
        timestamp BIGINT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Table key_value created or already exists');
  } catch (error) {
    console.error('[ERROR] Failed to create table:', error);
  } finally {
    client.release();
  }
}

// Message consumer with retry and channel recovery
async function consumeMessages(pool) {
  console.log('Consumer waiting for messages...');
  const tryConsume = async () => {
    try {
      if (!channel) {
        await connectRabbit();
      }

      channel.consume('key-value-queue', async (msg) => {
        if (msg) {
          const client = await pool.connect();
          let error = null;
          try {
            const data = JSON.parse(msg.content.toString());
            const messageId = `${data.key}-${data.timestamp}`;
            
            // Check if message was already processed
            if (processedMessages.has(messageId)) {
              console.log(`Message already processed: ${messageId}`);
              channel.ack(msg);
              return;
            }

            console.log('Message received from RabbitMQ:', data);
            const msgTimestamp = data.timestamp || Date.now();

            // Process DELETE
            if (data.action === 'delete') {
              try {
                // Check if the key exists
                const checkResult = await client.query('SELECT * FROM key_value WHERE key = $1', [data.key]);
                
                if (checkResult.rows.length > 0) {
                  // Delete from CockroachDB
                  await client.query('DELETE FROM key_value WHERE key = $1', [data.key]);
                  
                  // Delete from Redis
                  if (redisClient && redisClient.isReady) {
                    await redisClient.del(data.key);
                  }
                  
                  // Record key as deleted
                  deletedKeys.set(data.key, msgTimestamp);
                  console.log(`Key ${data.key} removed from database and Redis`);
                } else {
                  console.log(`Key ${data.key} not found for removal`);
                }
                
                processedMessages.add(messageId);
                channel.ack(msg);
              } catch (err) {
                console.error('[ERROR] Failed to process DELETE:', err);
                // Retry on error
                channel.nack(msg, false, true);
              }
              return;
            }

            // Process PUT
            try {
              // Check if key was deleted recently
              const deletedTimestamp = deletedKeys.get(data.key);
              if (deletedTimestamp && msgTimestamp < deletedTimestamp) {
                console.log(`Ignored: PUT after DELETE for key ${data.key} (DELETE: ${deletedTimestamp}, PUT: ${msgTimestamp})`);
                processedMessages.add(messageId);
                channel.ack(msg);
                return;
              }

              // Compare timestamps for PUT
              const existingValue = await client.query(
                'SELECT timestamp FROM key_value WHERE key = $1',
                [data.key]
              );

              if (existingValue.rows.length > 0 && existingValue.rows[0].timestamp > msgTimestamp) {
                console.log(`Ignored: older message timestamp for key ${data.key} (DB: ${existingValue.rows[0].timestamp}, MSG: ${msgTimestamp})`);
                processedMessages.add(messageId);
                channel.ack(msg);
                return;
              }

              // Execute PUT
              await client.query(
                'INSERT INTO key_value (key, value, timestamp) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET value = $2, timestamp = $3',
                [data.key, data.value, msgTimestamp]
              );
              
              if (redisClient) await redisClient.set(data.key, data.value);
              // Remove key from deleted map, if present
              deletedKeys.delete(data.key);
              console.log(`Key ${data.key} stored in database and Redis (timestamp: ${msgTimestamp})`);
              
              processedMessages.add(messageId);
              channel.ack(msg);
            } catch (err) {
              console.error('[ERROR] Failed to process PUT:', err);
              channel.nack(msg);
            }
          } catch (err) {
            error = err;
            console.error('[ERROR] Failed to process message:', err);
            channel.nack(msg);
          } finally {
            client.release();
          }
        }
      });
    } catch (err) {
      console.error('[ERROR] Message consume failed:', err);
      if (!isReconnecting) {
        isReconnecting = true;
        processedMessages.clear(); // Clear processed messages on reconnect
        setTimeout(async () => {
          try {
            await connectRabbit();
            await consumeMessages(pool);
          } catch (error) {
            console.error('[ERROR] Reconnect failed:', error);
          } finally {
            isReconnecting = false;
          }
        }, 5000);
      }
    }
  };
  tryConsume();
}

// Inicialização
(async () => {
  const pool = await connectCockroach();
  globalPool = pool;
  await initTable(pool);
  await connectRedis();
  await connectRabbit();
  await consumeMessages(pool);
})(); 