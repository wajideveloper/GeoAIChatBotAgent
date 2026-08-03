type CacheEntry<T> = {
  data: T;
  cachedAt: number;
};

class SmartCache {
  private store = new Map<string, CacheEntry<any>>();
  private maxAge: number;

  constructor(maxAgeMinutes = 60) {
    this.maxAge = maxAgeMinutes * 60 * 1000;
  }

  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.cachedAt > this.maxAge;
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (this.isExpired(entry)) {
      this.store.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T): void {
    this.store.set(key, {
      data,
      cachedAt: Date.now(),
    });
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  clear(): void {
    this.store.clear();
  }

  stats() {
    return {
      totalEntries: this.store.size,
      keys: Array.from(this.store.keys()),
    };
  }
}

// Make caches global so they survive hot reloads in development
const globalForCache = globalThis as unknown as {
  parseCache: SmartCache;
  geocodeCache: SmartCache;
  routeCache: SmartCache;
};

export const parseCache = globalForCache.parseCache || new SmartCache(120); // 2 hours

export const geocodeCache = globalForCache.geocodeCache || new SmartCache(1440); // 24 hours

export const routeCache = globalForCache.routeCache || new SmartCache(60); // 1 hour

if (process.env.NODE_ENV !== "production") {
  globalForCache.parseCache = parseCache;
  globalForCache.geocodeCache = geocodeCache;
  globalForCache.routeCache = routeCache;
}

export function makeCacheKey(...parts: (string | number)[]): string {
  return parts.map((p) => String(p).toLowerCase().trim()).join("::");
}
