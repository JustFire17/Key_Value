const express = require('express');
const Redis = require('redis');
const amqp = require('amqplib');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

// Configuração do Swagger
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Key-Value Store',
      version: '1.0.0',
      description: 'API REST para sistema distribuído de armazenamento key-value',
    },
    servers: [
      {
        url: 'http://localhost:80',
        description: 'Servidor local',
      },
    ],
  },
  apis: ['./index.js'],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Conexão com Redis
let redisClient;
async function connectRedis() {
  redisClient = Redis.createClient({
    url: process.env.REDIS_URL || 'redis://redis:6379'
  });
  await redisClient.connect();
  console.log('✅ Conectado ao Redis');
}

// Conexão com CockroachDB
let pgPool;
async function connectCockroach() {
  pgPool = new Pool({
    connectionString: process.env.COCKROACH_URL || 'postgresql://root@haproxy-crdb:26260/defaultdb?sslmode=disable'
  });
  // Testa a ligação
  const client = await pgPool.connect();
  await client.query('SELECT 1');
  client.release();
  console.log('✅ Conectado ao CockroachDB');
}

// Conexão com RabbitMQ
let channel;
let rabbitReady = false;

async function connectRabbit() {
  try {
  const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://admin:admin@haproxy-rabbit:5672');
  channel = await connection.createChannel();
  
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
  
    rabbitReady = true;
  console.log('✅ Conectado ao RabbitMQ');
  } catch (error) {
    console.error('❌ Erro ao conectar ao RabbitMQ:', error);
    rabbitReady = false;
    throw error;
  }
}

// Rota de health check para o HAProxy
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Endpoint de debug para listar rotas registadas
app.get('/debug-routes', (req, res) => {
  const routes = [];
  app._router.stack.forEach((middleware) => {
    if (middleware.route) { // routes registered directly on the app
      routes.push(middleware.route);
    } else if (middleware.name === 'router') { // router middleware 
      middleware.handle.stack.forEach((handler) => {
        const route = handler.route;
        route && routes.push(route);
      });
    }
  });
  res.json(routes.map(r => ({ path: r.path, methods: r.methods })));
});

const router = express.Router();

/**
 * @swagger
 * /api/{key}:
 *   get:
 *     summary: Busca um valor pela chave
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Valor encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     value:
 *                       type: string
 *       404:
 *         description: Chave não encontrada
 */
router.get('/:key', async (req, res) => {
  const { key } = req.params;
  try {
    let value = await redisClient.get(key);
    if (value) {
      return res.json({ data: { value } });
    }
    // Cache miss: procurar na CockroachDB
    const client = await pgPool.connect();
    try {
      const dbRes = await client.query('SELECT value FROM key_value WHERE key = $1', [key]);
      if (dbRes.rows.length > 0) {
        value = dbRes.rows[0].value;
        // Repor no Redis
        await redisClient.set(key, value);
        return res.json({ data: { value } });
      }
    } finally {
      client.release();
    }
    return res.status(404).json({ error: 'Chave não encontrada' });
  } catch (error) {
    console.error('Erro ao buscar chave:', error);
    return res.status(500).json({ error: 'Erro interno' });
  }
});

/**
 * @swagger
 * /api/:
 *   put:
 *     summary: Insere ou atualiza um par chave-valor
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               key:
 *                 type: string
 *               value:
 *                 type: string
 *     responses:
 *       200:
 *         description: Chave-valor inserido com sucesso
 *       400:
 *         description: Chave e valor são obrigatórios
 */
router.put('/', async (req, res) => {
  const { key, value } = req.body;
  if (!key || !value) {
    return res.status(400).json({ error: 'Chave e valor são obrigatórios' });
  }
  try {
    if (!rabbitReady) {
      throw new Error('RabbitMQ não está pronto');
    }
    if (!redisClient.isReady) {
      throw new Error('Redis não está pronto');
    }
    
    // Enviar mensagem para o RabbitMQ primeiro
    await channel.sendToQueue('key-value-queue', Buffer.from(JSON.stringify({ 
      key, 
      value, 
      timestamp: Date.now(),
      action: 'put'
    })));
    
    // Depois salvar no Redis
    await redisClient.set(key, value);
    
    return res.status(200).json({ message: 'Chave-valor inserido com sucesso' });
  } catch (error) {
    console.error('Erro ao inserir chave-valor:', error);
    return res.status(500).json({ error: 'Erro interno' });
  }
});

/**
 * @swagger
 * /api/{key}:
 *   delete:
 *     summary: Remove uma chave
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chave removida com sucesso
 *       404:
 *         description: Chave não encontrada
 */
router.delete('/:key', async (req, res) => {
  const { key } = req.params;
  try {
    if (!rabbitReady) {
      throw new Error('RabbitMQ não está pronto');
    }
    await redisClient.del(key);
    await channel.sendToQueue('key-value-queue', Buffer.from(JSON.stringify({ key, action: 'delete', timestamp: Date.now() })));
    return res.status(200).json({ message: 'Chave removida com sucesso' });
  } catch (error) {
    console.error('Erro ao remover chave:', error);
    return res.status(500).json({ error: 'Erro interno' });
  }
});

// Rota de boas-vindas para o endpoint '/api/'
router.get('/', (req, res) => {
  res.send('API Key-Value Store em funcionamento! Visite /api-docs para a documentação Swagger.');
});

// Montar o router sob o prefixo /api
console.log('A montar o router /api...');
app.use('/api', router);

const PORT = process.env.PORT || 3000;

// Inicialização
(async () => {
  await connectRedis();
  await connectCockroach();
  await connectRabbit();
  console.log('API conectada ao Redis, CockroachDB e RabbitMQ!');
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`API rodando na porta ${PORT}`);
    console.log(`Swagger UI disponível em http://localhost:80/api-docs`);
  });
})(); 