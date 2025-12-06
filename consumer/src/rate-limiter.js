export class RateLimiter {
  constructor(maxConcurrent = 5) {
    this.maxConcurrent = maxConcurrent;
    this.currentUploads = 0;
  }

  acquire() {
    if (this.currentUploads >= this.maxConcurrent) {
      console.log(`[RateLimiter] REJECTED: ${this.currentUploads}/${this.maxConcurrent} slots in use`);
      return false;
    }
    this.currentUploads++;
    console.log(`[RateLimiter] ACQUIRED: ${this.currentUploads}/${this.maxConcurrent} slots in use`);
    return true;
  }

  release() {
    if (this.currentUploads > 0) {
      this.currentUploads--;
      console.log(`[RateLimiter] RELEASED: ${this.currentUploads}/${this.maxConcurrent} slots in use`);
    }
  }

  getStats() {
    return {
      current: this.currentUploads,
      max: this.maxConcurrent,
      available: this.maxConcurrent - this.currentUploads,
    };
  }
}
