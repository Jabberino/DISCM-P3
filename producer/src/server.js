import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { ProducerPool } from './producer-threaded.js';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;
const GRPC_HOST = process.env.GRPC_HOST || 'consumer';
const GRPC_PORT = process.env.GRPC_PORT || '50051';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

let clients = [];

function broadcast(type, data) {
  const message = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  clients.forEach((client) => client.res.write(message));
}

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const clientId = Date.now();
  const newClient = {
    id: clientId,
    res,
  };

  clients.push(newClient);

  req.on('close', () => {
    clients = clients.filter((client) => client.id !== clientId);
  });
});

function countVideoFolders() {
  const videosDir = path.join(__dirname, '../videos');
  try {
    if (!fs.existsSync(videosDir)) return 0;
    const items = fs.readdirSync(videosDir);
    const folders = items.filter(item => 
      item.startsWith('folder') && 
      fs.statSync(path.join(videosDir, item)).isDirectory()
    );
    return folders.length;
  } catch (error) {
    console.error('Error counting folders:', error);
    return 0;
  }
}

const MAX_THREADS = countVideoFolders();
console.log(`Detected ${MAX_THREADS} video folders. Setting max threads to ${MAX_THREADS}.`);

app.get('/api/config', (req, res) => {
  res.json({ maxThreads: MAX_THREADS });
});

app.post('/api/start', async (req, res) => {
  const { threads } = req.body;
  const numThreads = parseInt(threads, 10);

  if (isNaN(numThreads) || numThreads < 1) {
    return res.status(400).json({ error: 'Invalid thread count' });
  }

  if (numThreads > MAX_THREADS) {
    return res.status(400).json({ 
      error: `Thread count (${numThreads}) exceeds available folders (${MAX_THREADS}). Please use ${MAX_THREADS} or fewer.` 
    });
  }

  console.log(`Received start request for ${numThreads} threads`);
  broadcast('log', `\n🚀 Starting upload with ${numThreads} threads...`);
  
  try {
    const pool = new ProducerPool(numThreads, GRPC_HOST, GRPC_PORT);
    console.log('Pool initialized');

    pool.on('log', (message) => {
      console.log('POOL LOG:', message);
      broadcast('log', message);
    });
    pool.on('progress', (data) => broadcast('progress', data));
    pool.on('finished', (summary) => broadcast('finished', summary));
    
    console.log('Starting pool...');
    await pool.start();
    console.log('Pool started (async)');
  } catch (error) {
    console.error('Error starting pool:', error);
    broadcast('log', `❌ Fatal Error: ${error.message}`);
  }

  res.json({ success: true, message: 'Upload started' });
});

app.listen(PORT, () => {
  console.log(`Producer UI running at http://localhost:${PORT}`);
});
