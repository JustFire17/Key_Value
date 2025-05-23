const amqp = require('amqplib');
const { Pool } = require('pg');
const redis = require('redis');

let channel;
let connection;
let globalPool;
let redisClient;
let isReconnecting = false;
let processedMessages = new Set();

// Conexão com CockroachDB
async function connectCockroach() {
  const pool = new Pool({
    connectionString: process.env.COCKROACH_URL || 'postgresql://root@cockroachdb:26257/defaultdb?sslmode=disable'
  });
  // Testa a ligação
  const client = await pool.connect();
  await client.query('SELECT 1');
  client.release();
  console.log('✅ Conectado ao CockroachDB');
  return pool;
}

// Conexão com RabbitMQ
async function connectRabbit() {
  try {
    if (connection) {
      await connection.close().catch(() => {});
    }
    connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://admin:admin@haproxy-rabbit:5672');
    channel = await connection.createChannel();
    
    // Configurar handlers de erro
    connection.on('error', async (err) => {
      console.error('Erro na conexão RabbitMQ:', err);
      if (!isReconnecting) {
        isReconnecting = true;
        processedMessages.clear(); // Limpar mensagens processadas ao reconectar
        setTimeout(async () => {
          try {
            await connectRabbit();
            await consumeMessages(globalPool);
          } catch (error) {
            console.error('Erro ao reconectar:', error);
          } finally {
            isReconnecting = false;
          }
        }, 5000);
      }
    });

    channel.on('error', async (err) => {
      console.error('Erro no canal RabbitMQ:', err);
      if (!isReconnecting) {
        isReconnecting = true;
        processedMessages.clear(); // Limpar mensagens processadas ao reconectar
        setTimeout(async () => {
          try {
            await connectRabbit();
            await consumeMessages(globalPool);
          } catch (error) {
            console.error('Erro ao reconectar:', error);
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
    console.log('✅ Conectado ao RabbitMQ');
    return channel;
  } catch (error) {
    console.error('❌ Erro ao conectar ao RabbitMQ:', error);
    throw error;
  }
}

// Conexão com Redis
async function connectRedis() {
  redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://haproxy-redis:6379'
  });
  await redisClient.connect();
  console.log('✅ Conectado ao Redis');
}

// Inicialização da tabela
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
    console.log('Tabela key_value criada ou já existente');
  } catch (error) {
    console.error('Erro ao criar tabela:', error);
  } finally {
    client.release();
  }
}

// Consumidor de mensagens com retry e canal novo
async function consumeMessages(pool) {
  console.log('Consumer aguardando mensagens...');
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
            
            // Verificar se a mensagem já foi processada
            if (processedMessages.has(messageId)) {
              console.log(`Mensagem já processada: ${messageId}`);
              channel.ack(msg);
              return;
            }

            console.log('Mensagem recebida do RabbitMQ:', data);
            const msgTimestamp = data.timestamp || Date.now();

            // Processar DELETE
            if (data.action === 'delete') {
              try {
                // Primeiro deletar do CockroachDB
                const deleteResult = await client.query('DELETE FROM key_value WHERE key = $1 RETURNING *', [data.key]);
                
                // Se a chave existia no CockroachDB, deletar do Redis também
                if (deleteResult.rows.length > 0) {
                  if (redisClient) await redisClient.del(data.key);
                  console.log(`Chave ${data.key} removida da base de dados e do Redis`);
                } else {
                  console.log(`Chave ${data.key} não encontrada para remoção`);
                }
                
                processedMessages.add(messageId);
                channel.ack(msg);
              } catch (err) {
                console.error('Erro ao processar DELETE:', err);
                channel.nack(msg);
              }
              return;
            }

            // Processar PUT
            try {
              // Verificar timestamp apenas para PUT
              const existingValue = await client.query(
                'SELECT timestamp FROM key_value WHERE key = $1',
                [data.key]
              );

              if (existingValue.rows.length > 0 && existingValue.rows[0].timestamp > msgTimestamp) {
                console.log(`Ignorado: mensagem com timestamp antigo para chave ${data.key} (DB: ${existingValue.rows[0].timestamp}, MSG: ${msgTimestamp})`);
                processedMessages.add(messageId);
                channel.ack(msg);
                return;
              }

              // Executar PUT
              await client.query(
                'INSERT INTO key_value (key, value, timestamp) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET value = $2, timestamp = $3',
                [data.key, data.value, msgTimestamp]
              );
              
              if (redisClient) await redisClient.set(data.key, data.value);
              console.log(`Chave ${data.key} guardada na base de dados e no Redis (timestamp: ${msgTimestamp})`);
              
              processedMessages.add(messageId);
              channel.ack(msg);
            } catch (err) {
              console.error('Erro ao processar PUT:', err);
              channel.nack(msg);
            }
          } catch (err) {
            error = err;
            console.error('Erro ao processar mensagem:', err);
            channel.nack(msg);
          } finally {
            client.release();
          }
        }
      });
    } catch (err) {
      console.error('Erro ao consumir mensagens:', err);
      if (!isReconnecting) {
        isReconnecting = true;
        processedMessages.clear(); // Limpar mensagens processadas ao reconectar
        setTimeout(async () => {
          try {
            await connectRabbit();
            await consumeMessages(pool);
          } catch (error) {
            console.error('Erro ao reconectar:', error);
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