const express = require('express');
const Redis = require('redis');
const amqp = require('amqplib');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

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
const redisClient = Redis.createClient({
  url: process.env.REDIS_URL || 'redis://redis:6379'
});

// Conexão com RabbitMQ
let channel;
async function connectRabbitMQ() {
  const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672');
  channel = await connection.createChannel();
  await channel.assertQueue('key-value-queue');
}

// Inicialização
(async () => {
  await redisClient.connect();
  await connectRabbitMQ();
  console.log('API conectada ao Redis e RabbitMQ!');
})();

/**
 * @swagger
 * /{key}:
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
app.get('/:key', async (req, res) => {
  const { key } = req.params;
  try {
    const value = await redisClient.get(key);
    if (value) {
      return res.json({ data: { value } });
    }
    return res.status(404).json({ error: 'Chave não encontrada' });
  } catch (error) {
    console.error('Erro ao buscar chave:', error);
    return res.status(500).json({ error: 'Erro interno' });
  }
});

/**
 * @swagger
 * /:
 *   put:
 *     summary: Insere ou atualiza um par chave-valor
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               data:
 *                 type: object
 *                 properties:
 *                   key:
 *                     type: string
 *                   value:
 *                     type: string
 *     responses:
 *       200:
 *         description: Chave-valor inserido com sucesso
 *       400:
 *         description: Chave e valor são obrigatórios
 */
app.put('/', async (req, res) => {
  const { key, value } = req.body.data;
  if (!key || !value) {
    return res.status(400).json({ error: 'Chave e valor são obrigatórios' });
  }
  try {
    await redisClient.set(key, value);
    await channel.sendToQueue('key-value-queue', Buffer.from(JSON.stringify({ key, value })));
    return res.status(200).json({ message: 'Chave-valor inserido com sucesso' });
  } catch (error) {
    console.error('Erro ao inserir chave-valor:', error);
    return res.status(500).json({ error: 'Erro interno' });
  }
});

/**
 * @swagger
 * /{key}:
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
app.delete('/:key', async (req, res) => {
  const { key } = req.params;
  try {
    await redisClient.del(key);
    await channel.sendToQueue('key-value-queue', Buffer.from(JSON.stringify({ key, action: 'delete' })));
    return res.status(200).json({ message: 'Chave removida com sucesso' });
  } catch (error) {
    console.error('Erro ao remover chave:', error);
    return res.status(500).json({ error: 'Erro interno' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
  console.log(`Swagger UI disponível em http://localhost:80/api-docs`);
}); 