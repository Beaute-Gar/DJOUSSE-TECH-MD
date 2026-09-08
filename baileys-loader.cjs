/* baileys-loader.cjs — ESM→CJS bridge for Baileys v7 (ESM-only)
   All .cjs files that need Baileys must use this loader instead of require().
   Usage: const baileys = await require('./baileys-loader.cjs')(); */

let _cache = null;

async function loadBaileys() {
  if (_cache) return _cache;
  _cache = await import('@whiskeysockets/baileys');
  return _cache;
}

/* Synchronous wrapper — returns cached instance or throws if not loaded yet.
   Call loadBaileys() first (async) at startup, then use getBaileys() everywhere. */
let _syncCache = null;
function getBaileys() {
  if (_syncCache) return _syncCache;
  throw new Error('Baileys not loaded yet — call await loadBaileys() first');
}

async function initBaileys() {
  const mod = await loadBaileys();
  _syncCache = mod;
  return mod;
}

module.exports = initBaileys;
module.exports.loadBaileys = loadBaileys;
module.exports.getBaileys = getBaileys;
