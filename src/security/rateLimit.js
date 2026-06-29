import NodeCache from 'node-cache';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const config = require('../../config.cjs');

const rateLimitCache = new NodeCache({
  stdTTL: Math.ceil(config.RATE_LIMIT_WINDOW_MS / 1000),
  checkperiod: 5,
});

const warnedUsers = new NodeCache({ stdTTL: 60 });
const blockedTemp = new NodeCache({ stdTTL: 300 });

const PERMANENT_BLACKLIST = new Set(
  config.BLACKLIST_NUMBERS.map(n => n + '@s.whatsapp.net')
);

export function checkRateLimit(jid) {
  if (PERMANENT_BLACKLIST.has(jid)) {
    return { allowed: false, reason: 'BLACKLISTED_PERMANENT' };
  }
  if (blockedTemp.has(jid)) {
    return { allowed: false, reason: 'BLOCKED_TEMP' };
  }
  const key = `rl:${jid}`;
  const count = (rateLimitCache.get(key) || 0) + 1;
  rateLimitCache.set(key, count);
  if (count > config.RATE_LIMIT_MAX) {
    blockedTemp.set(jid, true);
    return { allowed: false, reason: 'RATE_LIMIT_EXCEEDED' };
  }
  return { allowed: true };
}

export function banTemporary(jid) {
  blockedTemp.set(jid, true);
}

export function unban(jid) {
  blockedTemp.del(jid);
  rateLimitCache.del(`rl:${jid}`);
}

export function sanitizeInput(text) {
  if (!text || typeof text !== 'string') {
    return { safe: false, reason: 'EMPTY_OR_INVALID_TYPE' };
  }
  const MAX_COMMAND_LENGTH = 512;
  if (text.length > MAX_COMMAND_LENGTH) {
    return { safe: false, reason: 'INPUT_TOO_LONG' };
  }
  const DANGEROUS_PATTERNS = [
    /[\u200b-\u200f\u202a-\u202e\u2060-\u2064\uFEFF]/,
    /\u0000/,
  ];
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(text)) {
      return { safe: false, reason: 'DANGEROUS_CHARACTERS_DETECTED' };
    }
  }
  const sanitized = text.trim().replace(/\s{2,}/g, ' ');
  return { safe: true, sanitized };
}
