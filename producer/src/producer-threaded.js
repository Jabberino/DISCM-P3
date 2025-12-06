import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ProducerPool extends EventEmitter {
  constructor(numProducers, grpcHost, grpcPort) {
    super();
    this.numProducers = numProducers;
    this.grpcHost = grpcHost;
    this.grpcPort = grpcPort;
    this.workers = [];
    this.results = [];
  }

  async start() {
    this.emit('log', '='.repeat(60));
    this.emit('log', `Starting ${this.numProducers} Producer Threads`);
    this.emit('log', `gRPC Server: ${this.grpcHost}:${this.grpcPort}`);
    this.emit('log', '='.repeat(60));

    const workerPromises = [];

    for (let i = 1; i <= this.numProducers; i++) {
      const workerPromise = this.startProducerThread(i);
      workerPromises.push(workerPromise);
    }

    this.results = await Promise.allSettled(workerPromises);
    this.printSummary();
    this.emit('finished', this.getSummary());
  }

  startProducerThread(producerId) {
    return new Promise((resolve, reject) => {
      const workerPath = path.join(__dirname, 'producer-worker.js');

      const worker = new Worker(workerPath, {
        workerData: {
          producerId,
          grpcHost: this.grpcHost,
          grpcPort: this.grpcPort,
          videoFolder: `folder${producerId}`,
        },
      });

      this.emit('log', `[Main] Started Producer Thread #${producerId}`);

      worker.on('message', (message) => {
        if (message.type === 'PROGRESS') {
          this.emit('log', `[Producer ${producerId}] ${message.text}`);
          this.emit('progress', { producerId, text: message.text });
        } else if (message.type === 'COMPLETE') {
          this.emit('log', `[Producer ${producerId}] ✓ COMPLETED`);
          this.emit('log', `  Successful: ${message.stats.successful}`);
          this.emit('log', `  Failed: ${message.stats.failed}`);
          resolve(message.stats);
        }
      });

      worker.on('error', (error) => {
        this.emit('log', `[Producer ${producerId}] ❌ ERROR: ${error.message}`);
        reject(error);
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          this.emit('log', `[Producer ${producerId}] Exited with code ${code}`);
          reject(new Error(`Worker ${producerId} exited with code ${code}`));
        }
      });

      this.workers.push({ id: producerId, worker });
    });
  }

  printSummary() {
    this.emit('log', '\n' + '='.repeat(60));
    this.emit('log', 'Producer Pool Summary');
    this.emit('log', '='.repeat(60));

    const summary = this.getSummary();

    this.results.forEach((result, index) => {
      const producerId = index + 1;
      if (result.status === 'fulfilled') {
        this.emit('log', `Producer ${producerId}: ✓ ${result.value.successful} succeeded, ${result.value.failed} failed`);
      } else {
        this.emit('log', `Producer ${producerId}: ❌ ${result.reason.message}`);
      }
    });

    this.emit('log', '='.repeat(60));
    this.emit('log', `Total Successful Uploads: ${summary.totalSuccess}`);
    this.emit('log', `Total Failed Uploads: ${summary.totalFailed}`);
    this.emit('log', `Total Threads: ${this.numProducers}`);
    this.emit('log', '='.repeat(60));
  }

  getSummary() {
    let totalSuccess = 0;
    let totalFailed = 0;

    this.results.forEach((result) => {
      if (result.status === 'fulfilled') {
        totalSuccess += result.value.successful;
        totalFailed += result.value.failed;
      }
    });

    return { totalSuccess, totalFailed };
  }
}
