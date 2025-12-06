import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class VideoProcessor {
  constructor(maxConcurrent = 3) {
    this.maxConcurrent = maxConcurrent;
    this.currentProcessing = 0;
    this.queue = [];
    this.uploadsDir = path.join(__dirname, '..', 'uploads');
  }

  async processVideo(inputPath, filename) {
    return new Promise((resolve, reject) => {
      const task = { inputPath, filename, resolve, reject };
      this.queue.push(task);
      this.processNext();
    });
  }

  async processNext() {
    if (this.currentProcessing >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const task = this.queue.shift();
    this.currentProcessing++;
    
    console.log(`[VideoProcessor] START: ${task.filename} (${this.currentProcessing}/${this.maxConcurrent} workers active, ${this.queue.length} queued)`);

    try {
      await this.processWithFFmpeg(task.inputPath, task.filename);
      console.log(`[VideoProcessor] SUCCESS: ${task.filename}`);
      task.resolve();
    } catch (error) {
      console.error(`[VideoProcessor] ERROR: ${task.filename}`, error.message);
      task.reject(error);
    } finally {
      this.currentProcessing--;
      try {
        await fs.unlink(task.inputPath);
      } catch (err) {
        console.error(`[VideoProcessor] Failed to delete temp file: ${task.inputPath}`);
      }
      this.processNext();
    }
  }

  processWithFFmpeg(inputPath, filename) {
    return new Promise((resolve, reject) => {
      const outputFilename = this.sanitizeFilename(filename);
      const outputPath = path.join(this.uploadsDir, outputFilename);

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
          console.log(`[FFmpeg] Command: ${cmdline}`);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`[FFmpeg] Processing ${filename}: ${Math.round(progress.percent)}%`);
          }
        })
        .on('end', () => {
          console.log(`[FFmpeg] Completed: ${outputFilename}`);
          resolve();
        })
        .on('error', (err) => {
          console.error(`[FFmpeg] Error processing ${filename}:`, err.message);
          reject(err);
        })
        .run();
    });
  }

  sanitizeFilename(filename) {
    const base = path.basename(filename);
    return base.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  getStats() {
    return {
      processing: this.currentProcessing,
      queued: this.queue.length,
      maxConcurrent: this.maxConcurrent,
    };
  }
}
