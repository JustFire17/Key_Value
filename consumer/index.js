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
  connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://admin:admin@haproxy-rabbit:5672');
  channel = await connection.createChannel();
  channel.on('error', (err) => {
    if (err && err.code === 404) {
      console.warn('Fila key-value-queue ainda não existe (evento error). A tentar novamente em 5 segundos...');
      setTimeout(() => consumeMessages(globalPool), 5000);
    } else {
      console.error('Erro no canal RabbitMQ:', err);
    }
  });
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
            if (data.action === 'delete') {
              await client.query('DELETE FROM key_value WHERE key = $1', [data.key]);
              if (redisClient) await redisClient.del(data.key);
              console.log(`Chave ${data.key} removida da base de dados e do Redis`);
            } else {
              await client.query(
                'INSERT INTO key_value (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
                [data.key, data.value]
              );
              if (redisClient) await redisClient.set(data.key, data.value);
              console.log(`Chave ${data.key} guardada na base de dados e no Redis`);
            }
          } catch (error) {
            console.error('Erro ao processar mensagem:', error);
          } finally {
            client.release();
            channel.ack(msg);
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