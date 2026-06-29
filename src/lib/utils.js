import https from 'https';
import http from 'http';

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function runtime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}j ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}min`;
  if (m > 0) return `${m}min ${s % 60}s`;
  return `${s}s`;
}

export function isUrl(text) {
  try { new URL(text); return true; } catch { return false; }
}

export function jidToNumber(jid = '') {
  return '+' + jid.replace('@s.whatsapp.net', '').replace('@g.us', '');
}

export function normalizeJid(jid = '') {
  return jid.includes(':') ? jid.replace(/:.*@/, '@') : jid;
}

export function cleanJid(jid = '') {
  return jid.replace(/[^0-9@.\-_]/g, '');
}

export function numberToJid(number) {
  return number.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
}

export function formatNumber(n) {
  if (!n) return '0';
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0s';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = [];
  if (d > 0) parts.push(`${d}j`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}min`);
  if (s > 0 || parts.length === 0) parts.push(`${s}s`);
  return parts.join(' ');
}

export function formatFCFA(amount) {
  return (amount || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA';
}

export function escapeMarkdown(text) {
  return text.replace(/[_*[\]~`>#+\-=|{}.!]/g, '\\$&');
}

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomString(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

export async function fetchJson(url, opts = {}) {
  const lib = url.startsWith('https') ? https : http;
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: opts.method || 'GET',
      headers: { 'User-Agent': 'DJousseTechBot/2.0', 'Accept': 'application/json', ...opts.headers },
      timeout: opts.timeout || 10_000,
    };
    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('JSON invalide')); }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('TIMEOUT')); });
    req.on('error', reject);
    if (opts.data) req.write(JSON.stringify(opts.data));
    req.end();
  });
}

export async function fetchBuffer(url) {
  const lib = url.startsWith('https') ? https : http;
  return new Promise((resolve, reject) => {
    lib.get(url, { headers: { 'User-Agent': 'DJousseTechBot/2.0' } }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject).setTimeout(15_000, function() { this.destroy(); reject(new Error('TIMEOUT')); });
  });
}

export function formatDate(date = new Date(), tz = 'Africa/Douala') {
  return date.toLocaleString('fr-FR', { timeZone: tz, dateStyle: 'full', timeStyle: 'short' });
}

export function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}


