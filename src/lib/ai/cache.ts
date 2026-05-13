// ─── In-Memory TTL Cache ─────────────────────────────────────────────────────
// Avoids repeated expensive AI calls and caches external API responses.

import type { CacheEntry } from "./types";

class TtlCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private maxEntries = 200;

  /**
   * Get a cached value if it exists and hasn't expired.
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttlMs) {
      this.store.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set a value in the cache with a TTL in seconds.
   */
  set<T>(key: string, data: T, ttlSeconds: number): void {
    // Evict oldest entries if at capacity
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) {
        this.store.delete(oldest);
      }
    }

    this.store.set(key, {
      data,
      timestamp: Date.now(),
      ttlMs: ttlSeconds * 1000,
      key,
    });
  }

  /**
   * Check if a key exists and is not expired.
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Delete a specific key.
   */
  delete(key: string): void {
    this.store.delete(key);
  }

  /**
   * Clear all entries.
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Get cache stats.
   */
  stats(): { size: number; maxEntries: number } {
    return { size: this.store.size, maxEntries: this.maxEntries };
  }
}

// ── Singleton instances ──

/** Cache for external API responses (properties, market data) */
export const apiCache = new TtlCache();

/** Cache for AI response hashes (avoid duplicate AI calls for identical queries) */
export const aiResponseCache = new TtlCache();

/**
 * Generate a cache key from query parameters.
 */
export function buildCacheKey(prefix: string, params: Record<string, unknown>): string {
  const sorted = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join("&");
  return `${prefix}:${sorted}`;
}
