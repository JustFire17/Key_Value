const amqp = require('amqplib');
const { Pool } = require('pg');

// Conexão com CockroachDB
const pool = new Pool({
  connectionString: process.env.COCKROACH_URL || 'postgresql://root@cockroachdb:26257/defaultdb?sslmode=disable'
});

// Inicialização da tabela
async function initTable() {
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

// Consumidor de mensagens
async function consumeMessages() {
  const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672');
  const channel = await connection.createChannel();
  await channel.assertQueue('key-value-queue');

  console.log('Consumer aguardando mensagens...');

  channel.consume('key-value-queue', async (msg) => {
    if (msg) {
      const data = JSON.parse(msg.content.toString());
      const client = await pool.connect();
      try {
        if (data.action === 'delete') {
          await client.query('DELETE FROM key_value WHERE key = $1', [data.key]);
          console.log(`Chave ${data.key} removida da base de dados`);
        } else {
          await client.query(
            'INSERT INTO key_value (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
            [data.key, data.value]
          );
          console.log(`Chave ${data.key} guardada na base de dados`);
        }
      } catch (error) {
        console.error('Erro ao processar mensagem:', error);
      } finally {
        client.release();
        channel.ack(msg);
      }
    }
  });
}

// Inicialização
(async () => {
  await initTable();
  await consumeMessages();
})(); 