const express = require('express');
const Redis = require('redis');
const amqp = require('amqplib');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Key-Value Store',
      version: '1.0.0',
      description: 'REST API for a distributed key-value store',
    },
    servers: [
      {
        url: 'http://localhost:80',
        description: 'Local server',
      },
    ],
    components: {
      schemas: {
        KeyValue: {
          type: 'object',
          properties: {
            key: {
              type: 'string',
              description: 'Key to store'
            },
            value: {
              type: 'string',
              description: 'Value to store'
            }
          },
          required: ['key', 'value']
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message'
            }
          }
        }
      }
    }
  },
  apis: ['./index.js'],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'API Key-Value Store - Documentation'
}));

// Connect to Redis
let redisClient;
async function connectRedis() {
  redisClient = Redis.createClient({
    url: process.env.REDIS_URL || 'redis://redis:6379'
  });
  await redisClient.connect();
  console.log('[OK] Connected to Redis');
}

// Connect to CockroachDB
let pgPool;
async function connectCockroach() {
  pgPool = new Pool({
    connectionString: process.env.COCKROACH_URL || 'postgresql://root@haproxy-crdb:26260/defaultdb?sslmode=disable'
  });
  // Test connection
  const client = await pgPool.connect();
  await client.query('SELECT 1');
  client.release();
  console.log('[OK] Connected to CockroachDB');
}

// Connect to RabbitMQ
let channel;
let rabbitReady = false;

async function connectRabbit() {
  try {
  const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://admin:admin@haproxy-rabbit:5672');
  channel = await connection.createChannel();
  
  // Only create queues when INIT_QUEUES=true
  if (process.env.INIT_QUEUES === 'true') {
    await channel.assertQueue('key-value-queue', {
      durable: true,
      arguments: {
        'x-queue-type': 'quorum'
      }
    });
    console.log('[OK] Queues created');
  }
  
    rabbitReady = true;
  console.log('[OK] Connected to RabbitMQ');
  } catch (error) {
    console.error('[ERROR] RabbitMQ connection failed:', error);
    rabbitReady = false;
    throw error;
  }
}

// Health check route for HAProxy
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Debug endpoint to list registered routes
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
 *     summary: Retrieve a value by key
 *     description: Returns the stored value for a specific key
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: Key to retrieve
 *     responses:
 *       200:
 *         description: Value found successfully
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
 *         description: Key not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:key', async (req, res) => {
  const { key } = req.params;
  try {
    let value = await redisClient.get(key);
    if (value) {
      return res.json({ data: { value } });
    }
    // Cache miss: check CockroachDB
    const client = await pgPool.connect();
    try {
      const dbRes = await client.query('SELECT value FROM key_value WHERE key = $1', [key]);
      if (dbRes.rows.length > 0) {
        value = dbRes.rows[0].value;
        // Restore in Redis
        await redisClient.set(key, value);
        return res.json({ data: { value } });
      }
    } finally {
      client.release();
    }
    return res.status(404).json({ error: 'Chave não encontrada' });
  } catch (error) {
    console.error('[ERROR] Failed to fetch key:', error);
    return res.status(500).json({ error: 'Erro interno' });
  }
});

/**
 * @swagger
 * /api:
 *   put:
 *     summary: Insert or update a key-value pair
 *     description: Stores or updates a value for a specific key
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/KeyValue'
 *     responses:
 *       200:
 *         description: Operation completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid payload
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
    
    // Send message to RabbitMQ
    await channel.sendToQueue('key-value-queue', Buffer.from(JSON.stringify({ 
      key, 
      value, 
      timestamp: Date.now(),
      action: 'put'
    })));
    
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
 *     summary: Remove um par chave-valor
 *     description: Remove uma chave e seu valor do sistema
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: Chave a ser removida
 *     responses:
 *       200:
 *         description: Chave removida com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       404:
 *         description: Chave não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:key', async (req, res) => {
  const { key } = req.params;
  try {
    if (!rabbitReady) {
      throw new Error('RabbitMQ não está pronto');
    }
    if (!redisClient.isReady) {
      throw new Error('Redis não está pronto');
    }
    
    // Verificar se a chave existe no Redis ou CockroachDB
    const existingValue = await redisClient.get(key);
    if (!existingValue) {
      const client = await pgPool.connect();
      try {
        const dbRes = await client.query('SELECT value FROM key_value WHERE key = $1', [key]);
        if (dbRes.rows.length === 0) {
          // Se a chave não existe, retornar 404 em vez de erro interno
          return res.status(404).json({ error: 'Chave não encontrada' });
        }
      } finally {
        client.release();
      }
    }
    
    // Se chegou aqui, a chave existe e pode ser deletada
    // Enviar mensagem para o RabbitMQ
    await channel.sendToQueue('key-value-queue', Buffer.from(JSON.stringify({ 
      key, 
      timestamp: Date.now(),
      action: 'delete'
    })));
    
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

// Montar o mesmo router na raiz
console.log('A montar o router na raiz...');
app.use('/', router);

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