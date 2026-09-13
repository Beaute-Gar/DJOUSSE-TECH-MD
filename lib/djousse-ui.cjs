// lib/djousse-ui.cjs — Moteur de templates DJOUSSE TECH
const config = require('../config-djousse.cjs');

const FOOTER = '> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀɪɴᴏʀɪᴀ';
const FOOTER_DEV = '> ᴅᴊᴏᴜꜱꜱᴇ ᴛᴇᴄʜ ᴇᴠᴏʟᴜᴛɪᴏɴ';

/**
 * Génère une réponse naturelle (pas de formatage bot)
 * @param {string} title  — ex: 'PING'
 * @param {Array<{label?:string, value?:string, raw?:string}>} rows — lignes
 * @param {Object} [opts] — { footer, maxLen }
 */
function box(title, rows, opts = {}) {
  const lines = [];
  for (const row of rows || []) {
    if (!row) continue;
    if (typeof row === 'string') { lines.push(row); continue; }
    if (row.blank) { lines.push(''); continue; }
    if (row.raw) { lines.push(row.raw); continue; }
    lines.push((row.label ? row.label + ' : ' : '') + (row.value || ''));
  }
  let text = lines.join('\n');
  if (opts.maxLen && text.length > opts.maxLen) text = text.slice(0, opts.maxLen) + '...';
  return text;
}

/** Bloc multi-lignes */
function raw(lines) {
  return (Array.isArray(lines) ? lines : [lines]).join('\n');
}

/** Tronque une chaîne à n caractères */
function truncate(str, n = 120) {
  const s = String(str || '');
  return s.length > n ? s.slice(0, n) + '…' : s;
}

/** Durée formatée depuis des secondes */
function uptime(sec = 0) {
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), d = Math.floor(h / 24);
  if (d > 0) return `${d}j ${h % 24}h ${m}m`;
  return `${h}h ${m}m`;
}

/** Timeout utilitaire */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

module.exports = { box, raw, truncate, uptime, sleep, FOOTER, FOOTER_DEV, prefix: () => config.PREFIX || '.' };
