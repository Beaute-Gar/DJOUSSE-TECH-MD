'use strict';

/* Cache TTL avancé — LRU-aware, stats, TTL adaptatif, mémoire bornée. */

const store = new Map();
const MAX_ENTRIES = 500;
const CLEANUP_MS = 30 * 1000;
const stats = { hits: 0, misses: 0, evictions: 0, sets: 0 };

function evict() {
  if (store.size <= MAX_ENTRIES) return;
  const now = Date.now();
  const sorted = [...store.entries()]
    .map(([k, v]) => ({ k, exp: v.exp, accessed: v.lastAccess || v.exp }))
    .sort((a, b) => a.accessed - b.accessed);
  const toRemove = sorted.slice(0, Math.floor(MAX_ENTRIES * 0.2));
  for (const { k } of toRemove) store.delete(k);
  stats.evictions += toRemove.length;
}

async function cached(key, ttlMs, fn) {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && now < hit.exp) {
    hit.hits = (hit.hits || 0) + 1;
    hit.lastAccess = now;
    stats.hits++;
    return hit.value;
  }
  stats.misses++;
  const value = await fn();
  store.set(key, { value, exp: now + ttlMs, hits: 0, lastAccess: now, created: now });
  stats.sets++;
  evict();
  return value;
}

function set(key, value, ttlMs = 300000) {
  store.set(key, { value, exp: Date.now() + ttlMs, hits: 0, lastAccess: Date.now(), created: Date.now() });
  stats.sets++;
  evict();
}

function get(key) {
  const hit = store.get(key);
  if (!hit || Date.now() > hit.exp) return null;
  hit.hits = (hit.hits || 0) + 1;
  hit.lastAccess = Date.now();
  stats.hits++;
  return hit.value;
}

function has(key) {
  const hit = store.get(key);
  return !!hit && Date.now() < hit.exp;
}

function invalidate(key) {
  store.delete(key);
}

function invalidatePattern(pattern) {
  const regex = new RegExp(pattern);
  for (const k of store.keys()) {
    if (regex.test(k)) store.delete(k);
  }
}

function cleanup() {
  const now = Date.now();
  for (const [k, v] of store) if (now > v.exp) store.delete(k);
}

function getStats() {
  const total = stats.hits + stats.misses;
  return {
    entries: store.size,
    maxEntries: MAX_ENTRIES,
    hits: stats.hits,
    misses: stats.misses,
    hitRate: total > 0 ? (stats.hits / total * 100).toFixed(1) + '%' : '0%',
    evictions: stats.evictions,
    sets: stats.sets
  };
}

function clear() {
  store.clear();
}

setInterval(cleanup, CLEANUP_MS).unref();

module.exports = { cached, set, get, has, invalidate, invalidatePattern, getStats, clear };