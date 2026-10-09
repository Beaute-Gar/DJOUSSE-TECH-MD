'use strict';

function createMessageCache({ getStore, getMaxSize }) {
  const cache = new Map();

  function put(jid, id, msg) {
    if (!jid || !id || !msg) return;
    cache.set(`${jid}|${id}`, { msg, ts: Date.now() });
    const max = getMaxSize() || 800;
    while (cache.size > max) {
      cache.delete(cache.keys().next().value);
    }
    try {
      const store = getStore();
      if (store) store.put(jid, id, msg);
    } catch (_) {}
  }

  function get(jid, id) {
    if (!jid || !id) return null;
    const cacheKey = `${jid}|${id}`;
    const hit = cache.get(cacheKey);
    if (hit) return hit;

    try {
      const entry = getStore()?.get(jid, id);
      if (!entry?.message) return null;
      const recovered = {
        key: entry.key || { remoteJid: jid, id },
        message: entry.message,
        messageTimestamp: entry.messageTimestamp,
      };
      const result = { msg: recovered, ts: entry.ts || Date.now() };
      cache.set(cacheKey, result);
      const max = getMaxSize() || 800;
      while (cache.size > max) {
        cache.delete(cache.keys().next().value);
      }
      return result;
    } catch (_) {
      return null;
    }
  }

  return { put, get };
}

module.exports = { createMessageCache };
