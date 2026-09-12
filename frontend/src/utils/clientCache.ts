/**
 * Lightweight Client-Side In-Memory Cache for Instant Tab Switching (0ms UI).
 * Implements the Stale-While-Revalidate pattern with TTL.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class ClientMemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes in ms

  get<T>(key: string, maxAgeMs?: number): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    const ttl = maxAgeMs || this.defaultTTL;
    if (Date.now() - entry.timestamp > ttl) {
      return entry.data; // Stale data can still be served for optimistic UI while revalidating
    }
    return entry.data;
  }

  isFresh(key: string, maxAgeMs?: number): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    const ttl = maxAgeMs || this.defaultTTL;
    return Date.now() - entry.timestamp < ttl;
  }

  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  invalidate(keyPrefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(keyPrefix)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

export const clientCache = new ClientMemoryCache();
