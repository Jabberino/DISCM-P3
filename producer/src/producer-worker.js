import { parentPort, workerData } from 'worker_threads';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { producerId, grpcHost, grpcPort, videoFolder } = workerData;
const CHUNK_SIZE = 64 * 1024;

fs.appendFileSync('/app/worker_debug.txt', `[Worker ${producerId}] Started. Folder: ${videoFolder}\n`);

const PROTO_PATH = path.join(__dirname, '../proto/video.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const videoProto = grpc.loadPackageDefinition(packageDefinition).video;

const client = new videoProto.VideoUploadService(
  `${grpcHost}:${grpcPort}`,
  grpc.credentials.createInsecure()
);

function uploadVideo(videoPath) {
  return new Promise((resolve, reject) => {
    const filename = path.basename(videoPath);
    const stats = fs.statSync(videoPath);
    const uniqueFilename = `${videoFolder}_${path.basename(videoPath)}`;
      
      const call = client.UploadVideo((error, response) => {
        if (error) {
          if (error.code === grpc.status.ALREADY_EXISTS) {
            parentPort.postMessage({ type: 'PROGRESS', text: `⚠ Duplicate: ${path.basename(videoPath)}` });
            resolve({ success: false, message: 'Duplicate detected', code: 'DUPLICATE' });
          } else {
            reject(error);
          }
        } else {
          parentPort.postMessage({ type: 'PROGRESS', text: `Upload complete: ${path.basename(videoPath)}` });
          resolve({ success: true });
        }
      });

    call.write({ filename: uniqueFilename, data: null });

    const fileStream = fs.createReadStream(videoPath, {
      highWaterMark: CHUNK_SIZE,
    });

    let chunkCount = 0;
    let bytesSent = 0;

    sendProgress(`Starting upload: ${filename} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

    fileStream.on('data', (chunk) => {
      chunkCount++;
      bytesSent += chunk.length;

      call.write({
        filename: uniqueFilename,
        data: chunk,
      });
    });

    fileStream.on('end', () => {
      call.end();
    });

    fileStream.on('error', (error) => {
      reject(error);
    });
  });
}

function sendProgress(text) {
  parentPort.postMessage({
    type: 'PROGRESS',
    text,
  });
}

async function main() {
  const videosDir = path.join(__dirname, '../videos', videoFolder);

  if (!fs.existsSync(videosDir)) {
    throw new Error(`Video folder not found: ${videosDir}`);
  }

  const files = fs
    .readdirSync(videosDir)
    .filter((file) => file.endsWith('.mp4'))
    .map((file) => path.join(videosDir, file));

  if (files.length === 0) {
    throw new Error(`No video files found in ${videosDir}`);
  }

  sendProgress(`Found ${files.length} video(s) in ${videoFolder}`);

  let successCount = 0;
  let failureCount = 0;

  for (const file of files) {
    try {
      const response = await uploadVideo(file);
      
      if (response.success) {
        successCount++;
        sendProgress(`✓ Success: ${path.basename(file)}`);
      } else {
        failureCount++;
        sendProgress(`✗ Failed: ${path.basename(file)} - ${response.message}`);
      }
      
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      failureCount++;
      
      if (error.code === grpc.status.RESOURCE_EXHAUSTED) {
        sendProgress(`⚠ Rate limited: ${path.basename(file)}`);
      } else {
        sendProgress(`✗ Error: ${path.basename(file)} - ${error.message}`);
      }
    }
  }

  parentPort.postMessage({
    type: 'COMPLETE',
    stats: {
      successful: successCount,
      failed: failureCount,
      total: files.length,
    },
  });
}

main().catch((error) => {
  parentPort.postMessage({
    type: 'ERROR',
    error: error.message,
  });
  process.exit(1);
});
