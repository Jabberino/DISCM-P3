import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class WorkerPool {
  constructor(numWorkers, uploadsDir) {
    this.numWorkers = numWorkers;
    this.uploadsDir = uploadsDir;
    this.workers = [];
    this.availableWorkers = [];
    this.taskQueue = [];
    this.taskIdCounter = 0;
    this.pendingTasks = new Map(); 
    
    this.initializeWorkers();
  }

  initializeWorkers() {
    const workerPath = path.join(__dirname, 'video-worker.js');
    
    for (let i = 0; i < this.numWorkers; i++) {
      const worker = new Worker(workerPath, {
        workerData: { workerId: i + 1 }
      });
      
      worker.workerId = i + 1;
      worker.busy = false;
      
      worker.on('message', (message) => {
        this.handleWorkerMessage(worker, message);
      });
      
      worker.on('error', (error) => {
        console.error(`[WorkerPool] Worker ${worker.workerId} error:`, error);
      });
      
      worker.on('exit', (code) => {
        if (code !== 0) {
          console.error(`[WorkerPool] Worker ${worker.workerId} exited with code ${code}`);
        }
      });
      
      this.workers.push(worker);
      this.availableWorkers.push(worker);
    }
    
    console.log(`[WorkerPool] Initialized ${this.numWorkers} worker threads`);
  }

  handleWorkerMessage(worker, message) {
    if (message.type === 'TASK_COMPLETE') {
      const pendingTask = this.pendingTasks.get(message.taskId);
      
      if (pendingTask) {
        if (message.success) {
          console.log(`[WorkerPool] Task ${message.taskId} completed successfully by Worker ${worker.workerId}`);
          pendingTask.resolve();
        } else {
          console.error(`[WorkerPool] Task ${message.taskId} failed:`, message.error);
          pendingTask.reject(new Error(message.error));
        }
        
        this.pendingTasks.delete(message.taskId);
      }
      
      worker.busy = false;
      this.availableWorkers.push(worker);
      
      this.processNextTask();
    } else if (message.type === 'ERROR') {
      console.error(`[WorkerPool] Worker ${worker.workerId} reported error:`, message.error);
    }
  }

  async processVideo(inputPath, filename) {
    return new Promise((resolve, reject) => {
      const taskId = ++this.taskIdCounter;
      const task = {
        taskId,
        inputPath,
        filename,
        resolve,
        reject,
      };
      
      this.taskQueue.push(task);
      this.pendingTasks.set(taskId, { resolve, reject });
      
      console.log(`[WorkerPool] Task ${taskId} queued: ${filename} (${this.taskQueue.length} in queue)`);
      
      this.processNextTask();
    });
  }

  processNextTask() {
    if (this.taskQueue.length === 0 || this.availableWorkers.length === 0) {
      return;
    }
    
    const task = this.taskQueue.shift();
    const worker = this.availableWorkers.shift();
    
    worker.busy = true;
    
    const activeWorkers = this.workers.filter(w => w.busy).length;
    console.log(`[WorkerPool] Dispatching task ${task.taskId} to Worker ${worker.workerId} (${activeWorkers}/${this.numWorkers} workers active, ${this.taskQueue.length} queued)`);
    
    worker.postMessage({
      type: 'PROCESS_VIDEO',
      taskId: task.taskId,
      inputPath: task.inputPath,
      filename: task.filename,
      uploadsDir: this.uploadsDir,
    });
  }

  getStats() {
    const activeWorkers = this.workers.filter(w => w.busy).length;
    return {
      totalWorkers: this.numWorkers,
      activeWorkers,
      availableWorkers: this.availableWorkers.length,
      queuedTasks: this.taskQueue.length,
    };
  }

  async shutdown() {
    console.log('[WorkerPool] Shutting down all workers...');
    
    const shutdownPromises = this.workers.map((worker) => {
      return new Promise((resolve) => {
        worker.postMessage({ type: 'SHUTDOWN' });
        worker.on('exit', () => {
          console.log(`[WorkerPool] Worker ${worker.workerId} terminated`);
          resolve();
        });
      });
    });
    
    await Promise.all(shutdownPromises);
    console.log('[WorkerPool] All workers shut down');
  }
}
