const amqp = require('amqplib');
const { Pool } = require('pg');
const redis = require('redis');

let channel;
let connection;
let globalPool;
let redisClient;

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
  const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://admin:admin@haproxy-rabbit:5672');
  channel = await connection.createChannel();
  
  // Configurar prefetch_count para 10 mensagens
  await channel.prefetch(10);
  
  // Só cria as filas se INIT_QUEUES=true
  if (process.env.INIT_QUEUES === 'true') {
    await channel.assertQueue('key-value-queue', {
      durable: true,
      arguments: {
        'x-queue-type': 'quorum'
      }
    });
    console.log('✅ Filas criadas com sucesso');
  }
  
  console.log('✅ Conectado ao RabbitMQ');
}

// Conexão com Redis
async function connectRedis() {
  redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://haproxy-redis:6379'
  });
  redisClient.on('error', (err) => console.error('Erro no Redis:', err));
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
      // Se o canal estiver fechado, cria um novo
      if (!channel || channel.connection.stream.destroyed) {
        if (connection) await connection.close().catch(() => {});
        await connectRabbit();
      }
      await channel.consume('key-value-queue', async (msg) => {
        if (msg) {
          const data = JSON.parse(msg.content.toString());
          console.log('Mensagem recebida do RabbitMQ:', data);
          const client = await pool.connect();
          try {
            // Buscar timestamp atual da chave na DB
            let dbTimestamp = 0;
            const dbRes = await client.query('SELECT timestamp FROM key_value WHERE key = $1', [data.key]);
            if (dbRes.rows.length > 0 && dbRes.rows[0].timestamp) {
              dbTimestamp = parseInt(dbRes.rows[0].timestamp);
            }
            const msgTimestamp = data.timestamp ? parseInt(data.timestamp) : 0;
            
            // Só ignorar se o timestamp for significativamente menor (mais de 1 segundo)
            if (msgTimestamp < dbTimestamp - 1000) {
              console.log(`Ignorado: mensagem com timestamp antigo para chave ${data.key} (DB: ${dbTimestamp}, MSG: ${msgTimestamp})`);
              channel.ack(msg);
              client.release();
              return;
            }
            
            if (data.action === 'delete') {
              await client.query('DELETE FROM key_value WHERE key = $1', [data.key]);
              if (redisClient) await redisClient.del(data.key);
              console.log(`Chave ${data.key} removida da base de dados e do Redis`);
            } else {
              await client.query(
                'INSERT INTO key_value (key, value, timestamp) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET value = $2, timestamp = $3',
                [data.key, data.value, msgTimestamp]
              );
              if (redisClient) await redisClient.set(data.key, data.value);
              console.log(`Chave ${data.key} guardada na base de dados e no Redis (timestamp: ${msgTimestamp})`);
            }
          } catch (error) {
            console.error('Erro ao processar mensagem:', error);
            // Não reconhecer a mensagem em caso de erro para tentar novamente
            channel.nack(msg);
          } finally {
            client.release();
            if (!error) channel.ack(msg);
          }
        }
      });
    } catch (err) {
      if (err.code === 404) {
        console.warn('Fila key-value-queue ainda não existe. A tentar novamente em 5 segundos...');
        if (connection) await connection.close().catch(() => {});
        setTimeout(tryConsume, 5000);
      } else {
        console.error('Erro ao consumir mensagens:', err);
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