'use strict';
// Même texte répété >= 4 fois en 30 s par le même membre.
const seen = new Map();
module.exports = {
  key: 'antispam',
  label: 'Anti-Spam',
  detect: (ctx) => {
    if (ctx.isEdit) return null; // une édition n'est pas un nouveau message
    const t = (ctx.text || '').trim().toLowerCase();
    if (t.length < 3) return null;
    const k = ctx.from + '|' + ctx.senderNum + '|' + t;
    const now = Date.now();
    const arr = (seen.get(k) || []).filter((x) => now - x < 30000);
    arr.push(now);
    seen.set(k, arr);
    if (seen.size > 5000) for (const [kk, v] of seen) if (now - v[v.length - 1] > 30000) seen.delete(kk);
    return arr.length >= 4 ? { reason: 'Spam : message répété.' } : null;
  },
  _reset: () => seen.clear(),
};
