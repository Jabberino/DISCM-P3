import express from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createExpressServer(rateLimiter, workerPool, port = 3000) {
  const app = express();

  app.use(cors());
  app.use(express.json());

  const uploadsDir = path.join(__dirname, '..', 'uploads');
  app.use('/uploads', express.static(uploadsDir));

  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok',
      rateLimiter: rateLimiter.getStats(),
      workerPool: workerPool.getStats(),
    });
  });

  app.get('/api/videos', async (req, res) => {
    try {
      const files = await fs.readdir(uploadsDir);
      const videoFiles = files.filter(file => 
        !file.startsWith('temp_') && 
        (file.endsWith('.mp4') || file.endsWith('.webm') || file.endsWith('.mov'))
      );
      res.json(videoFiles);
    } catch (error) {
      console.error('[Express] Error reading uploads directory:', error);
      res.status(500).json({ 
        error: 'Failed to read videos',
        message: error.message 
      });
    }
  });

  app.get('/api/stats', (req, res) => {
    res.json({
      rateLimiter: rateLimiter.getStats(),
      workerPool: workerPool.getStats(),
    });
  });

  app.use((err, req, res, next) => {
    console.error('[Express] Error:', err);
    res.status(500).json({ 
      error: 'Internal server error',
      message: err.message 
    });
  });

  const server = app.listen(port, () => {
    console.log(`[Express] Server listening on port ${port}`);
    console.log(`[Express] API available at http://localhost:${port}/api/videos`);
    console.log(`[Express] Videos served at http://localhost:${port}/uploads/`);
  });

  return server;
}
