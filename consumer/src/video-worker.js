import { parentPort, workerData } from 'worker_threads';
import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';

const workerId = workerData.workerId;

console.log(`[Worker ${workerId}] Thread started`);

function processWithFFmpeg(inputPath, filename, uploadsDir) {
  return new Promise((resolve, reject) => {
    const sanitizedFilename = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
    const outputPath = path.join(uploadsDir, sanitizedFilename);

    ffmpeg(inputPath)
      .videoCodec('libx264')
      .size('1280x?') 
      .aspect('16:9')
      .autopad()
      .outputOptions([
        '-preset fast',
        '-crf 23', 
        '-movflags +faststart', 
        '-an', 
      ])
      .output(outputPath)
      .on('start', (cmdline) => {
        console.log(`[Worker ${workerId}] FFmpeg started: ${filename}`);
      })
      .on('progress', (progress) => {
        if (progress.percent) {
          console.log(`[Worker ${workerId}] Processing ${filename}: ${Math.round(progress.percent)}%`);
        }
      })
      .on('end', () => {
        console.log(`[Worker ${workerId}] Completed: ${sanitizedFilename}`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error(`[Worker ${workerId}] FFmpeg error for ${filename}:`, err.message);
        reject(err);
      })
      .run();
  });
}

parentPort.on('message', async (message) => {
  if (message.type === 'PROCESS_VIDEO') {
    const { inputPath, filename, uploadsDir, taskId } = message;
    
    console.log(`[Worker ${workerId}] Received task ${taskId}: ${filename}`);
    
    try {
      const outputPath = await processWithFFmpeg(inputPath, filename, uploadsDir);
      
      try {
        await fs.unlink(inputPath);
        console.log(`[Worker ${workerId}] Deleted temp file: ${inputPath}`);
      } catch (err) {
        console.error(`[Worker ${workerId}] Failed to delete temp file:`, err.message);
      }
      
      parentPort.postMessage({
        type: 'TASK_COMPLETE',
        taskId,
        success: true,
        outputPath,
        filename,
      });
    } catch (error) {
      parentPort.postMessage({
        type: 'TASK_COMPLETE',
        taskId,
        success: false,
        error: error.message,
        filename,
      });
      
      try {
        await fs.unlink(inputPath);
      } catch (err) {
      }
    }
  } else if (message.type === 'SHUTDOWN') {
    console.log(`[Worker ${workerId}] Shutting down...`);
    process.exit(0);
  }
});

process.on('uncaughtException', (error) => {
  console.error(`[Worker ${workerId}] Uncaught exception:`, error);
  parentPort.postMessage({
    type: 'ERROR',
    error: error.message,
  });
});
