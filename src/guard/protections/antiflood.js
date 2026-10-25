'use strict';
// Plus de floodMax messages en floodWindowSec secondes.
const hits = new Map();
module.exports = {
  key: 'antiflood',
  label: 'Anti-Flood',
  detect: (ctx, g) => {
    if (ctx.isEdit) return null;
    const k = ctx.from + '|' + ctx.senderNum;
    const now = Date.now();
    const win = g.floodWindowSec * 1000;
    const arr = (hits.get(k) || []).filter((x) => now - x < win);
    arr.push(now);
    hits.set(k, arr);
    if (hits.size > 5000) for (const [kk, v] of hits) if (now - v[v.length - 1] > win) hits.delete(kk);
    return arr.length > g.floodMax ? { reason: 'Flood : trop de messages en peu de temps.' } : null;
  },
  _reset: () => hits.clear(),
};
