'use strict';

/* lib/antiban.cjs — Garde-fous anti-ban inspirés d'OpenWA (rate limit, warm-up,
   jitter, CIDR whitelist, HMAC webhook) adaptés au moteur Baileys du bot.
   Toutes les limites sont configurables par variables d'environnement. */

const RATE_MAX = parseInt(process.env.RATE_LIMIT_MAX || '30', 10);          /* envois / fenêtre */
const RATE_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10); /* 60 s */
const JITTER_MS = parseInt(process.env.SEND_JITTER_MS || '1500', 10);       /* délai max avant envoi */
const WARMUP_DAYS = parseInt(process.env.WARMUP_DAYS || '7', 10);           /* compte "jeune" < 7 jours */

/* Buckets d'envoi par session + jitter timers */
const sendBuckets = new Map();
const lastSendAt = new Map();

function now() { return Date.now(); }

/* ── 1. Rate limit d'envoi par session (fenêtre glissante simple) ── */
function allowSend(key) {
  const b = sendBuckets.get(key);
  if (!b || now() > b.resetAt) {
    sendBuckets.set(key, { count: 0, resetAt: now() + RATE_WINDOW_MS });
  }
  const bucket = sendBuckets.get(key);
  bucket.count += 1;
  if (bucket.count > RATE_MAX) return { allowed: false, retryAfterMs: bucket.resetAt - now() };
  return { allowed: true, remaining: RATE_MAX - bucket.count };
}

/* ── 2. Warm-up : un compte récent voit son budget réduit (facteur multiplicatif) ──
   En jours d'ancienneté de session → facteur appliqué au rate limit.
   J1-2 = 20% du budget, J3-4 = 50%, J5-6 = 80%, J7+ = 100%. */
function warmupFactor(accountAgeMs) {
  const days = Math.max(0, Math.floor((accountAgeMs || 0) / (24 * 3600 * 1000)));
  if (days >= WARMUP_DAYS) return 1;
  if (days >= 5) return 0.8;
  if (days >= 3) return 0.5;
  if (days >= 1) return 0.3;
  return 0.2;
}

/* ── 3. Jitter : petit délai aléatoire avant l'envoi (comportement humain) ──
   Retourne la durée à attendre. Appeler en amont de sock.sendMessage. */
function jitter(key) {
  const last = lastSendAt.get(key) || 0;
  const since = now() - last;
  let wait = 0;
  if (since < 4000) wait = Math.floor(Math.random() * JITTER_MS); /* envois rapprochés → pause */
  lastSendAt.set(key, now());
  return wait;
}

/* ── 4. CIDR whitelisting (accès API par IP) ──
   Var env : CIDR_WHITELIST="192.168.1.0/24,10.0.0.0/8,1.2.3.4/32" */
function getCidrWhitelist() {
  return (process.env.CIDR_WHITELIST || '').split(',').map(s => s.trim()).filter(Boolean);
}

function ipToUint(ip) {
  return ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
}

function isIpInCidr(ip, cidr) {
  const [base, prefixRaw] = cidr.split('/');
  const prefix = parseInt(prefixRaw || '32', 10);
  if (!base || ip.split('.').length !== 4) return false;
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipToUint(ip) & mask) === (ipToUint(base) & mask);
}

function isIpAllowed(ip) {
  const list = getCidrWhitelist();
  if (!list.length) return true; /* pas de whitelist → tout autorisé */
  return list.some(cidr => isIpInCidr(ip, cidr));
}

/* ── 5. HMAC webhook signing (intégrité des payloads) ── */
const crypto = require('crypto');
const HMAC_SECRET = process.env.WEBHOOK_HMAC_SECRET || '';

function signPayload(payload) {
  if (!HMAC_SECRET) return null;
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return 'sha256=' + crypto.createHmac('sha256', HMAC_SECRET).update(body).digest('hex');
}

function verifySignature(signature, body) {
  if (!HMAC_SECRET || !signature) return false;
  const expected = signPayload(body);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

/* ── 6. Guarde complète : warm-up × rate limit + jitter ── */
/* Retourne { ok: bool, waitMs: number, reason?: string }. */
function guardSend(key, accountAgeMs) {
  const wf = warmupFactor(accountAgeMs);
  const effectiveMax = Math.max(1, Math.floor(RATE_MAX * wf));
  const b = sendBuckets.get(key);
  if (!b || now() > b.resetAt) {
    sendBuckets.set(key, { count: 0, resetAt: now() + RATE_WINDOW_MS, effectiveMax });
  }
  const bucket = sendBuckets.get(key);
  if (bucket.count >= bucket.effectiveMax) {
    return { ok: false, waitMs: bucket.resetAt - now(), reason: 'rate_limited' };
  }
  bucket.count += 1;
  const waitMs = jitter(key);
  return { ok: true, waitMs, budget: bucket.effectiveMax - bucket.count, warmupFactor: wf };
}

/* Nettoyage périodique des buckets */
setInterval(() => {
  const t = now();
  for (const [k, v] of sendBuckets) if (t > v.resetAt) sendBuckets.delete(k);
  for (const [k, v] of lastSendAt) if (t - v > 60000) lastSendAt.delete(k);
}, 60000).unref();

module.exports = {
  allowSend, warmupFactor, jitter, isIpAllowed, signPayload, verifySignature, guardSend,
  RATE_MAX, RATE_WINDOW_MS, JITTER_MS, WARMUP_DAYS,
};
