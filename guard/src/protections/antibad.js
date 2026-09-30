'use strict';
const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[@4]/g, 'a').replace(/3/g, 'e').replace(/[1!|]/g, 'i').replace(/0/g, 'o').replace(/\$/g, 's');

module.exports = {
  key: 'antibad',
  label: 'Anti-Bad',
  detect: (ctx, g) => {
    if (!g.badWords.length || !ctx.text) return null;
    const t = ' ' + norm(ctx.text).replace(/[^a-z0-9]+/g, ' ') + ' ';
    const hit = g.badWords.find((w) => t.includes(' ' + norm(w).replace(/[^a-z0-9]+/g, ' ').trim() + ' '));
    return hit ? { reason: 'Langage inapproprié détecté.' } : null;
  },
};
