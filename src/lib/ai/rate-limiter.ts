// ─── Token-Bucket Rate Limiter ───────────────────────────────────────────────
// Prevents exceeding external API rate limits and protects the AI endpoint.

interface BucketConfig {
  maxTokens: number;
  refillRatePerSecond: number;
}

interface Bucket {
  tokens: number;
  lastRefill: number;
  config: BucketConfig;
}

class RateLimiter {
  private buckets = new Map<string, Bucket>();

  /**
   * Create or retrieve a rate-limiting bucket for a given key.
   */
  private getBucket(key: string, config: BucketConfig): Bucket {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = {
        tokens: config.maxTokens,
        lastRefill: Date.now(),
        config,
      };
      this.buckets.set(key, bucket);
    }
    return bucket;
  }

  /**
   * Refill tokens based on elapsed time.
   */
  private refill(bucket: Bucket): void {
    const now = Date.now();
    const elapsed = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(
      bucket.config.maxTokens,
      bucket.tokens + elapsed * bucket.config.refillRatePerSecond,
    );
    bucket.lastRefill = now;
  }

  /**
   * Try to consume a token. Returns true if allowed, false if rate-limited.
   */
  tryConsume(key: string, config: BucketConfig): boolean {
    const bucket = this.getBucket(key, config);
    this.refill(bucket);

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }
    return false;
  }

  /**
   * Get remaining tokens for a bucket.
   */
  remaining(key: string): number {
    const bucket = this.buckets.get(key);
    if (!bucket) return 0;
    this.refill(bucket);
    return Math.floor(bucket.tokens);
  }
}

// ── Singleton ──
export const rateLimiter = new RateLimiter();

// ── Preset configurations ──

/** Rate limit for the AI chat endpoint (per IP or global) */
export const AI_ENDPOINT_LIMIT = {
  maxTokens: 20,
  refillRatePerSecond: 0.5, // ~30 requests per minute
};

/** Rate limit for external API providers */
export const EXTERNAL_API_LIMIT = {
  maxTokens: 10,
  refillRatePerSecond: 0.33, // ~20 requests per minute
};

/** Rate limit for Gemini API calls */
export const GEMINI_LIMIT = {
  maxTokens: 15,
  refillRatePerSecond: 0.25, // ~15 requests per minute
};

/**
 * Check if a request is rate-limited. Returns true if blocked.
 */
export function isRateLimited(
  key: string,
  config: { maxTokens: number; refillRatePerSecond: number } = AI_ENDPOINT_LIMIT,
): boolean {
  return !rateLimiter.tryConsume(key, config);
}
