import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class VideoDuplicateDetector {
  constructor(uploadsDir) {
    this.uploadsDir = uploadsDir;
    this.hashDbPath = path.join(uploadsDir, '.video_hashes.json');
    this.hashes = new Map();
    this.initialized = false;
  }

  async initialize() {
    try {
      await fs.mkdir(this.uploadsDir, { recursive: true });

      try {
        const data = await fs.readFile(this.hashDbPath, 'utf-8');
        const hashData = JSON.parse(data);
        
        for (const [hash, info] of Object.entries(hashData)) {
          this.hashes.set(hash, info);
        }
        
        console.log(`[DuplicateDetector] Loaded ${this.hashes.size} video hashes from database`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
        console.log('[DuplicateDetector] Starting with empty hash database');
      }

      this.initialized = true;
    } catch (error) {
      console.error('[DuplicateDetector] Initialization error:', error);
      throw error;
    }
  }

  calculateHash(fileBuffer) {
    return crypto
      .createHash('sha256')
      .update(fileBuffer)
      .digest('hex');
  }

  async checkDuplicate(fileBuffer) {
    if (!this.initialized) {
      await this.initialize();
    }

    const contentHash = this.calculateHash(fileBuffer);
    
    if (this.hashes.has(contentHash)) {
      const existing = this.hashes.get(contentHash);
      console.log(`[DuplicateDetector] DUPLICATE DETECTED!`);
      console.log(`  Hash: ${contentHash.substring(0, 16)}...`);
      console.log(`  Original: ${existing.filename}`);
      console.log(`  Uploaded: ${new Date(existing.uploadedAt).toLocaleString()}`);
      
      return {
        isDuplicate: true,
        contentHash,
        originalFilename: existing.filename,
        uploadedAt: existing.uploadedAt,
      };
    }

    return null;
  }

  async registerVideo(fileBuffer, filename) {
    if (!this.initialized) {
      await this.initialize();
    }

    const contentHash = this.calculateHash(fileBuffer);
    
    const videoInfo = {
      filename,
      uploadedAt: new Date().toISOString(),
      contentHash,
    };

    this.hashes.set(contentHash, videoInfo);
    await this.saveDatabase();
    
    console.log(`[DuplicateDetector] Registered new video: ${filename}`);
    console.log(`  Hash: ${contentHash.substring(0, 16)}...`);
    console.log(`  Total videos tracked: ${this.hashes.size}`);
  }

  async saveDatabase() {
    try {
      const hashData = Object.fromEntries(this.hashes);
      
      await fs.writeFile(
        this.hashDbPath,
        JSON.stringify(hashData, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('[DuplicateDetector] Error saving database:', error);
      throw error;
    }
  }

  getStats() {
    return {
      totalVideosTracked: this.hashes.size,
      databasePath: this.hashDbPath,
    };
  }

  async clearDatabase() {
    this.hashes.clear();
    await this.saveDatabase();
    console.log('[DuplicateDetector] Database cleared');
  }
}
