import { createLogger } from '../core/logger.js';

const log = createLogger('CACHE');

export class PerfCache {
  #store = new Map();
  #stats = { hits: 0, misses: 0, sets: 0, evictions: 0 };
  #maxSize;
  #defaultTTL;

  constructor(maxSize = 500, defaultTTL = 60000) {
    this.#maxSize = maxSize;
    this.#defaultTTL = defaultTTL;
    setInterval(() => this.#evict(), 30000).unref();
  }

  get(key) {
    const entry = this.#store.get(key);
    if (!entry) { this.#stats.misses++; return undefined; }
    if (Date.now() > entry.expires) {
      this.#store.delete(key);
      this.#stats.evictions++;
      this.#stats.misses++;
      return undefined;
    }
    this.#stats.hits++;
    entry.lastAccess = Date.now();
    return entry.value;
  }

  set(key, value, ttl) {
    if (this.#store.size >= this.#maxSize) this.#evictOne();
    this.#store.set(key, {
      value, expires: Date.now() + (ttl || this.#defaultTTL), created: Date.now(), lastAccess: Date.now(),
    });
    this.#stats.sets++;
    return value;
  }

  delete(key) {
    this.#store.delete(key);
  }

  clear() {
    this.#store.clear();
    this.#stats.evictions += this.#store.size;
  }

  memoize(fn, keyFn = (...args) => JSON.stringify(args), ttl) {
    const cache = this;
    return async function (...args) {
      const key = keyFn(...args);
      const cached = cache.get(key);
      if (cached !== undefined) return cached;
      const result = await fn.apply(this, args);
      cache.set(key, result, ttl);
      return result;
    };
  }

  wrap(ttl) {
    const cache = this;
    return function (target, propertyKey, descriptor) {
      const original = descriptor.value;
      descriptor.value = async function (...args) {
        const key = `${propertyKey}:${JSON.stringify(args)}`;
        const cached = cache.get(key);
        if (cached !== undefined) return cached;
        const result = await original.apply(this, args);
        cache.set(key, result, ttl);
        return result;
      };
      return descriptor;
    };
  }

  #evict() {
    const now = Date.now();
    for (const [key, entry] of this.#store) {
      if (now > entry.expires) {
        this.#store.delete(key);
        this.#stats.evictions++;
      }
    }
  }

  #evictOne() {
    let oldest = Infinity;
    let oldestKey = null;
    for (const [key, entry] of this.#store) {
      if (entry.lastAccess < oldest) {
        oldest = entry.lastAccess;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      this.#store.delete(oldestKey);
      this.#stats.evictions++;
    }
  }

  get size() { return this.#store.size; }

  getStats() {
    const total = this.#stats.hits + this.#stats.misses;
    return {
      size: this.#store.size,
      maxSize: this.#maxSize,
      hitRate: total > 0 ? (this.#stats.hits / total * 100).toFixed(1) + '%' : '0%',
      ...this.#stats,
    };
  }
}

export const cache = new PerfCache(500, 60000);
export default cache;
