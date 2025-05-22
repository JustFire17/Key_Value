import express from 'express';
import Redis from 'ioredis';
import pkg from 'pg';
import amqp from 'amqplib';
import { z } from 'zod';

const { Client } = pkg;
 
const app = express();
app.use(express.json());
const port = 3000;

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
});



const pgclient = new Client({
  host: 'haproxy',      
  port: 26256,            
  user: 'root',           
  database: 'appdb',  
  ssl: false              
});

async function connectToCockroach() {
  try {
    await pgclient.connect();
    console.log('✅ Connected to CockroachDB via HAProxy');

    const res = await pgclient.query('SELECT now()');
    console.log('🕒 Current time:', res.rows[0]);

  } catch (err) {
    console.error('❌ Connection error:', err.message);
  } 

}

connectToCockroach();

let mqChannel;

async function connectToRabbitWithRetry(maxRetries = 10, delay = 2000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const conn = await amqp.connect('amqp://rabbitmq');
      mqChannel = await conn.createChannel();
      await mqChannel.assertQueue('add_key');
      await mqChannel.assertQueue('del_key');
      console.log('✅ Connected to RabbitMQ');
      return;
    } catch (err) {
      console.warn(`RabbitMQ not ready (attempt ${attempt}/${maxRetries}): ${err.message}`);
      if (attempt === maxRetries) throw new Error('❌ Could not connect to RabbitMQ');
      await new Promise(res => setTimeout(res, delay));
    }
  }
}

await connectToRabbitWithRetry();

// Zod schema
const KeyPayloadSchema = z.object({
  key_name: z.string().min(1).max(100),
  key_value: z.string().min(1).max(1000),
}).strict();

const KeyDeleteSchema = z.object({
  key_name: z.string().min(1).max(100),
}).strict();

const KeyQuerySchema = z.object({
  key: z.string().min(1).max(100),
}).strict();

app.get('/', async (req, res) => {
  const parseResult = KeyQuerySchema.safeParse(req.query);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Invalid query parameters',
      details: parseResult.error.format(),
    });
  }

  const { key } = parseResult.data;


  try {
    const redisVal = await redis.get(key);
    if (redisVal !== null) {
      return res.json({ value: redisVal, source: 'redis' });
    }

    const result = await pgclient.query('SELECT value FROM kv_store WHERE key = $1', [key]);
    if (result.rows.length > 0) {
      const value = result.rows[0].value;
      await redis.set(key, value);
      return res.json({ value, source: 'database' });
    }

    return res.status(404).json({ error: 'Key not found' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/', async (req, res) => {

  const parseResult = KeyPayloadSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parseResult.error.format() });
  }

  const { key_name, key_value } = parseResult.data;
  const payload = { key_name, key_value, timestamp: new Date().toISOString() };
  
  await mqChannel.sendToQueue('add_key', Buffer.from(JSON.stringify(payload)));
  return res.status(202).json({ message: 'Queued to add_key' });
});


app.delete('/', async (req, res) => {
  const parseResult = KeyDeleteSchema.safeParse(req.query);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid query parameters', details: parseResult.error.format() });
  }

  const { key_name } = parseResult.data;
  const payload = { key_name, timestamp: new Date().toISOString()};
  
 
  await mqChannel.sendToQueue('del_key', Buffer.from(JSON.stringify(payload)));
  return res.status(202).json({ message: 'Queued to del_key' });
});


app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});

