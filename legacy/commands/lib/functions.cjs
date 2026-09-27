const https = require('https');
const http = require('http');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function runtime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d > 0) parts.push(`${d}j`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

function h2k(num) {
  if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return num.toString();
}

function fetchJson(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    if (!url || typeof url !== 'string') return reject(new Error('Invalid URL'));
    const timer = setTimeout(() => reject(new Error('Timeout')), timeout);
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { clearTimeout(timer); try { resolve(JSON.parse(data)); } catch { resolve(data); } });
    });
    req.on('error', e => { clearTimeout(timer); reject(e); });
    req.on('timeout', () => { req.destroy(); clearTimeout(timer); reject(new Error('Timeout')); });
  });
}

function getBuffer(url, timeout = 30000) {
  return new Promise((resolve, reject) => {
    if (!url || typeof url !== 'string') return reject(new Error('Invalid URL'));
    const timer = setTimeout(() => reject(new Error('Timeout')), timeout);
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        clearTimeout(timer);
        return getBuffer(res.headers.location, timeout).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => { clearTimeout(timer); resolve(Buffer.concat(chunks)); });
    });
    req.on('error', e => { clearTimeout(timer); reject(e); });
    req.on('timeout', () => { req.destroy(); clearTimeout(timer); reject(new Error('Timeout')); });
  });
}

function getGroupAdmins(participants) {
  if (!participants) return [];
  return participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin').map(p => p.id);
}

module.exports = { sleep, runtime, h2k, fetchJson, getBuffer, getGroupAdmins };
