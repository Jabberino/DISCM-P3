import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GRPC_HOST = process.env.GRPC_HOST || 'localhost';
const GRPC_PORT = process.env.GRPC_PORT || '50051';
const PRODUCER_ID = process.env.PRODUCER_ID || '1';
const VIDEO_FOLDER = process.env.VIDEO_FOLDER || `folder${PRODUCER_ID}`;
const CHUNK_SIZE = 64 * 1024; 

function validateInputs() {
  const errors = [];

  if (!GRPC_HOST || GRPC_HOST.trim() === '') {
    errors.push('GRPC_HOST cannot be empty');
  }
  if (GRPC_HOST.length > 255) {
    errors.push('GRPC_HOST exceeds maximum length (255 characters)');
  }

  const port = parseInt(GRPC_PORT);
  if (isNaN(port)) {
    errors.push(`GRPC_PORT must be a number, got: ${GRPC_PORT}`);
  } else if (port < 1 || port > 65535) {
    errors.push(`GRPC_PORT must be between 1-65535, got: ${port}`);
  }

  const producerId = parseInt(PRODUCER_ID);
  if (isNaN(producerId)) {
    errors.push(`PRODUCER_ID must be a number, got: ${PRODUCER_ID}`);
  } else if (producerId < 1) {
    errors.push(`PRODUCER_ID must be >= 1, got: ${producerId}`);
  } else if (producerId > 100) {
    errors.push(`PRODUCER_ID exceeds reasonable maximum (100), got: ${producerId}`);
  }

  if (!VIDEO_FOLDER || VIDEO_FOLDER.trim() === '') {
    errors.push('VIDEO_FOLDER cannot be empty');
  }
  if (VIDEO_FOLDER.includes('..') || VIDEO_FOLDER.startsWith('/')) {
    errors.push(`VIDEO_FOLDER contains invalid path characters: ${VIDEO_FOLDER}`);
  }

  return errors;
}

const validationErrors = validateInputs();
if (validationErrors.length > 0) {
  console.error('='.repeat(60));
  console.error('❌ INPUT VALIDATION FAILED');
  console.error('='.repeat(60));
  validationErrors.forEach(error => console.error(`  - ${error}`));
  console.error('='.repeat(60));
  console.error('\nProvide valid environment variables:');
  console.error('  GRPC_HOST     - Hostname or IP (default: localhost)');
  console.error('  GRPC_PORT     - Port number 1-65535 (default: 50051)');
  console.error('  PRODUCER_ID   - Producer ID 1-100 (default: 1)');
  console.error('  VIDEO_FOLDER  - Folder name (default: folder{PRODUCER_ID})');
  console.error('='.repeat(60));
  process.exit(1);
}

console.log('='.repeat(60));
console.log(`Producer Instance #${PRODUCER_ID} Starting`);
console.log('='.repeat(60));
console.log(`Configuration:`);
console.log(`  - gRPC Server: ${GRPC_HOST}:${GRPC_PORT}`);
console.log(`  - Video Folder: ${VIDEO_FOLDER}`);
console.log(`  - Chunk Size: ${CHUNK_SIZE} bytes`);
console.log('='.repeat(60));

const PROTO_PATH = path.join(__dirname, '../proto/video.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const videoProto = grpc.loadPackageDefinition(packageDefinition).video;

const client = new videoProto.VideoUploadService(
  `${GRPC_HOST}:${GRPC_PORT}`,
  grpc.credentials.createInsecure()
);

function uploadVideo(videoPath) {
  return new Promise((resolve, reject) => {
    const filename = path.basename(videoPath);
    const stats = fs.statSync(videoPath);
    const call = client.UploadVideo((error, response) => {
      if (error) {
        console.error(`❌ [${filename}] Upload failed:`, error.message);
        reject(error);
      } else {
        console.log(`✓ [${filename}] Upload successful!`);
        console.log(`  Response:`, response);
        resolve(response);
      }
    });

    const fileStream = fs.createReadStream(videoPath, {
      highWaterMark: CHUNK_SIZE
    });

    let chunkCount = 0;
    let bytesSent = 0;

    console.log(`📤 [${filename}] Starting upload (${(stats.size / 1024 / 1024).toFixed(2)} MB)...`);

    fileStream.on('data', (chunk) => {
      chunkCount++;
      bytesSent += chunk.length;
      
      const progress = ((bytesSent / stats.size) * 100).toFixed(1);
      process.stdout.write(`\r  Progress: ${progress}% (${chunkCount} chunks)`);

      call.write({
        filename: filename,
        data: chunk 
      });
    });

    fileStream.on('end', () => {
      console.log(''); 
      console.log(`  Finalizing upload...`);
      call.end();
    });

    fileStream.on('error', (error) => {
      console.error(`❌ [${filename}] File read error:`, error);
      reject(error);
    });
  });
}

async function main() {
  const videosDir = path.join(__dirname, '../videos', VIDEO_FOLDER);

  if (!fs.existsSync(videosDir)) {
    console.error(`❌ Video folder not found: ${videosDir}`);
    console.error(`   Did you run: npm run generate-videos?`);
    process.exit(1);
  }

  const files = fs.readdirSync(videosDir)
    .filter(file => file.endsWith('.mp4'))
    .map(file => path.join(videosDir, file));

  if (files.length === 0) {
    console.error(`❌ No video files found in ${videosDir}`);
    process.exit(1);
  }

  console.log(`\nFound ${files.length} video(s) to upload\n`);

  let successCount = 0;
  let failureCount = 0;

  for (const file of files) {
    try {
      await uploadVideo(file);
      successCount++;
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      failureCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Upload Summary:`);
  console.log(`  ✓ Successful: ${successCount}`);
  console.log(`  ❌ Failed: ${failureCount}`);
  console.log(`  📊 Total: ${files.length}`);
  console.log('='.repeat(60));

  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
