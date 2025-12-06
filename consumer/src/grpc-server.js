import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { VideoDuplicateDetector } from './video-hash.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createGrpcServer(rateLimiter, workerPool, duplicateDetector, port = 50051) {
  const PROTO_PATH = path.join(__dirname, '..', 'proto', 'video.proto');
  const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  
  const videoProto = grpc.loadPackageDefinition(packageDefinition).video;

  const server = new grpc.Server();

  server.addService(videoProto.VideoUploadService.service, {
    UploadVideo: async (call, callback) => {
      if (!rateLimiter.acquire()) {
        console.log('[gRPC] Upload rejected: RESOURCE_EXHAUSTED');
        return callback({
          code: grpc.status.RESOURCE_EXHAUSTED,
          details: 'Too many concurrent uploads. Please try again later.',
        });
      }

      let filename = null;
      let tempFilePath = null;
      const chunks = [];
      let uploadSuccess = false;

      try {
        call.on('data', (chunk) => {
          try {
            if (!filename && chunk.filename) {
              filename = chunk.filename;
              const sanitizedName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
              tempFilePath = path.join(__dirname, '..', 'uploads', `temp_${Date.now()}_${sanitizedName}`);
              console.log(`[gRPC] Receiving upload: ${filename}`);
            }

            if (chunk.data && chunk.data.length > 0) {
              chunks.push(chunk.data);
            }
          } catch (error) {
            console.error('[gRPC] Error processing chunk:', error);
            call.destroy(error);
          }
        });

        call.on('end', async () => {
          try {
            if (!tempFilePath || !filename || chunks.length === 0) {
              throw new Error('No file data received');
            }

            const fileBuffer = Buffer.concat(chunks);
            console.log(`[gRPC] Received ${chunks.length} chunks, total size: ${fileBuffer.length} bytes`);

            const duplicateCheck = await duplicateDetector.checkDuplicate(fileBuffer);
            if (duplicateCheck) {
              console.log(`[gRPC] DUPLICATE REJECTED: ${filename}`);
              rateLimiter.release();
              return callback({
                code: grpc.status.ALREADY_EXISTS,
                details: `Duplicate video detected. Original: "${duplicateCheck.originalFilename}" uploaded at ${new Date(duplicateCheck.uploadedAt).toLocaleString()}`,
              });
            }

            await fs.writeFile(tempFilePath, fileBuffer);
            console.log(`[gRPC] File written to: ${tempFilePath}`);

            console.log(`[gRPC] Upload complete: ${filename}, queuing for processing...`);

            await workerPool.processVideo(tempFilePath, filename);

            uploadSuccess = true;
            
            await duplicateDetector.registerVideo(fileBuffer, filename);
            
            callback(null, {
              success: true,
              message: `Video ${filename} uploaded and processed successfully`,
            });
          } catch (error) {
            console.error('[gRPC] Error processing upload:', error);
            callback(null, {
              success: false,
              message: `Failed to process video: ${error.message}`,
            });
            
            if (tempFilePath) {
              fs.unlink(tempFilePath).catch(() => {});
            }
          } finally {
            rateLimiter.release();
          }
        });

        call.on('error', (error) => {
          console.error('[gRPC] Stream error:', error);
          if (tempFilePath && !uploadSuccess) {
            fs.unlink(tempFilePath).catch(() => {});
          }
          rateLimiter.release();
        });

      } catch (error) {
        console.error('[gRPC] Upload handler error:', error);
        rateLimiter.release();
        callback({
          code: grpc.status.INTERNAL,
          details: error.message,
        });
      }
    },
  });

  server.bindAsync(
    `0.0.0.0:${port}`,
    grpc.ServerCredentials.createInsecure(),
    (err, boundPort) => {
      if (err) {
        console.error('[gRPC] Failed to bind server:', err);
        throw err;
      }
      console.log(`[gRPC] Server listening on port ${boundPort}`);
    }
  );

  return server;
}
