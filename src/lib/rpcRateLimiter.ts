/**
 * Global RPC Rate Limiter
 * Prevents too many requests to RPC endpoint to avoid 429 errors
 */

interface QueuedRequest {
  resolve: (value: any) => void;
  reject: (error: any) => void;
  execute: () => Promise<any>;
}

class RPCRateLimiter {
  private queue: QueuedRequest[] = [];
  private isProcessing = false;
  private lastRequestTime = 0;
  private minDelayBetweenRequests = 50; // 50ms between requests (optimized for multicall)
  private consecutive429Errors = 0;
  private backoffMultiplier = 1;
  private maxBackoffDelay = 10000; // Max 10 seconds

  /**
   * Execute a request with rate limiting
   */
  async execute<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        resolve,
        reject,
        execute: requestFn,
      });

      this.processQueue();
    });
  }

  /**
   * Process the request queue with rate limiting
   */
  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const request = this.queue.shift();
      if (!request) break;

      try {
        // Calculate delay based on last request time and backoff
        const timeSinceLastRequest = Date.now() - this.lastRequestTime;
        const baseDelay = this.minDelayBetweenRequests * this.backoffMultiplier;
        const delay = Math.max(0, baseDelay - timeSinceLastRequest);

        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        // Execute the request
        const result = await request.execute();
        this.lastRequestTime = Date.now();
        
        // Reset backoff on successful request
        this.consecutive429Errors = 0;
        this.backoffMultiplier = 1;

        request.resolve(result);
      } catch (error: any) {
        // Handle 429 errors with exponential backoff
        if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('Too Many Requests')) {
          this.consecutive429Errors++;
          this.backoffMultiplier = Math.min(
            Math.pow(2, this.consecutive429Errors),
            this.maxBackoffDelay / this.minDelayBetweenRequests
          );

          console.warn(`[RPCRateLimiter] Rate limited (429). Backoff multiplier: ${this.backoffMultiplier}, consecutive errors: ${this.consecutive429Errors}`);

          // Re-queue the request with backoff
          const backoffDelay = this.minDelayBetweenRequests * this.backoffMultiplier;
          setTimeout(() => {
            this.queue.unshift(request);
            this.isProcessing = false;
            this.processQueue();
          }, backoffDelay);

          return; // Exit to wait for backoff
        }

        // For other errors, reject immediately
        request.reject(error);
      }
    }

    this.isProcessing = false;
  }

  /**
   * Reset rate limiter state
   */
  reset() {
    this.consecutive429Errors = 0;
    this.backoffMultiplier = 1;
    this.lastRequestTime = 0;
  }
}

// Global rate limiter instance
export const rpcRateLimiter = new RPCRateLimiter();

