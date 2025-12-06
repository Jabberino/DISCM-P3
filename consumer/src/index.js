import { RateLimiter } from './rate-limiter.js';
import { WorkerPool } from './worker-pool.js';
import { VideoDuplicateDetector } from './video-hash.js';
import { createGrpcServer } from './grpc-server.js';
import { createExpressServer } from './express-server.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArguments() {
  const args = process.argv.slice(2);
  const config = {
    c: null,
    q: null,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-c' || args[i] === '--consumer-threads') {
      config.c = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '-q' || args[i] === '--queue-length') {
      config.q = parseInt(args[i + 1], 10);
      i++;
    }
  }

  return config;
}

function validateConfig(config) {
  const validated = {};

  if (config.c === null || config.c === undefined) {
    console.log('[Config] No consumer threads specified, using default: 3');
    validated.c = 3;
  } else if (isNaN(config.c) || config.c < 1) {
    console.warn(`[Config] Invalid consumer threads value: ${config.c}, using default: 3`);
    validated.c = 3;
  } else if (config.c > 10) {
    console.warn(`[Config] Consumer threads value too high (${config.c}), capping at 10`);
    validated.c = 10;
  } else {
    validated.c = config.c;
  }


  if (config.q === null || config.q === undefined) {
    console.log('[Config] No queue length specified, using default: 5');
    validated.q = 5;
  } else if (isNaN(config.q) || config.q < 1) {
    console.warn(`[Config] Invalid queue length value: ${config.q}, using default: 5`);
    validated.q = 5;
  } else if (config.q > 100) {
    console.warn(`[Config] Queue length value too high (${config.q}), capping at 100`);
    validated.q = 100;
  } else {
    validated.q = config.q;
  }

  return validated;
}

const GRPC_PORT = 50051;
const EXPRESS_PORT = 3000;

const userConfig = parseArguments();
const config = validateConfig(userConfig);

const MAX_CONCURRENT_UPLOADS = config.q;
const MAX_CONCURRENT_PROCESSING = config.c;

console.log('='.repeat(60));
console.log('Starting Video Upload Backend Server with Worker Threads');
console.log('='.repeat(60));
console.log(`Configuration:`);
console.log(`  - Consumer threads (c): ${MAX_CONCURRENT_PROCESSING}`);
console.log(`  - Max concurrent uploads / Queue length (q): ${MAX_CONCURRENT_UPLOADS}`);
console.log(`  - gRPC port: ${GRPC_PORT}`);
console.log(`  - Express port: ${EXPRESS_PORT}`);
console.log('='.repeat(60));
console.log(`Usage: node src/index.js -c <threads> -q <queue_length>`);
console.log(`Example: node src/index.js -c 3 -q 5`);
console.log('='.repeat(60));

const uploadsDir = path.join(__dirname, '..', 'uploads');
const rateLimiter = new RateLimiter(MAX_CONCURRENT_UPLOADS);
const workerPool = new WorkerPool(MAX_CONCURRENT_PROCESSING, uploadsDir);
const duplicateDetector = new VideoDuplicateDetector(uploadsDir);

await duplicateDetector.initialize();

try {
  const grpcServer = createGrpcServer(rateLimiter, workerPool, duplicateDetector, GRPC_PORT);
  const expressServer = createExpressServer(rateLimiter, workerPool, EXPRESS_PORT);

  console.log('\n✓ Both servers started successfully!');
  console.log('\nEndpoints:');
  console.log(`  - gRPC Upload: localhost:${GRPC_PORT}`);
  console.log(`  - REST API: http://localhost:${EXPRESS_PORT}/api/videos`);
  console.log(`  - Health: http://localhost:${EXPRESS_PORT}/health`);
  console.log(`  - Videos: http://localhost:${EXPRESS_PORT}/uploads/\n`);


  process.on('SIGINT', async () => {
    console.log('\n\nShutting down gracefully...');
    
    await workerPool.shutdown();
    
    grpcServer.tryShutdown(() => {
      console.log('[gRPC] Server closed');
    });
    expressServer.close(() => {
      console.log('[Express] Server closed');
      process.exit(0);
    });
  });

} catch (error) {
  console.error('Failed to start servers:', error);
  process.exit(1);
}
