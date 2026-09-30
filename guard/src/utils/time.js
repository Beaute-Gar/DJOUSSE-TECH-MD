'use strict';
/** "30m" | "2h" | "1d" | "45" (minutes) -> millisecondes, ou null */
function parseDuration(s) {
  const m = /^(\d+)\s*(s|m|h|d)?$/i.exec(String(s || '').trim());
  if (!m) return null;
  const mult = { s: 1e3, m: 6e4, h: 36e5, d: 864e5 }[(m[2] || 'm').toLowerCase()];
  return parseInt(m[1], 10) * mult;
}

/** ms -> "1j 2h 3m 4s" */
function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts = [];
  if (d) parts.push(`${d}j`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${sec}s`);
  return parts.join(' ');
}

module.exports = { parseDuration, formatDuration };
