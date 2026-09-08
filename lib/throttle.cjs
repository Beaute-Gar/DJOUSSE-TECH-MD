'use strict';

/* Régulateur d'envois sortants — discipline opérationnelle, PAS d'évasion.
   Espace les rafales d'envois (broadcasts, welcome, ajouts) pour rester dans un
   volume humain. En régime normal communautaire, il ne se déclenche jamais. */

const CONFIG = {
  maxPerMinute: parseInt(process.env.THROTTLE_MAX_PER_MIN || '20', 10),
  maxPerHour: parseInt(process.env.THROTTLE_MAX_PER_HOUR || '120', 10),
  minGapMs: parseInt(process.env.THROTTLE_MIN_GAP_MS || '1200', 10),
  jitterMs: parseInt(process.env.THROTTLE_JITTER_MS || '400', 10),
};

const state = { minute: [], hour: [], lastSent: 0 };

function jitter(base) {
  return base + Math.floor(Math.random() * (CONFIG.jitterMs + 1));
}

function allow() {
  const now = Date.now();
  state.minute = state.minute.filter(t => now - t < 60e3);
  state.hour = state.hour.filter(t => now - t < 3600e3);
  if (state.minute.length >= CONFIG.maxPerMinute) return false;
  if (state.hour.length >= CONFIG.maxPerHour) return false;
  if (now - state.lastSent < CONFIG.minGapMs) return false;
  return true;
}

function markSent() {
  const now = Date.now();
  state.minute.push(now);
  state.hour.push(now);
  state.lastSent = now;
}

async function throttledSend(sock, jid, content) {
  if (!allow()) {
    const wait = jitter(CONFIG.minGapMs);
    await new Promise(r => setTimeout(r, wait));
  }
  if (!allow()) return { ok: false, reason: 'rate_limit_exceeded' };
  markSent();
  try {
    await sock.sendMessage(jid, content);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: (e && e.message) || String(e) };
  }
}

module.exports = { throttledSend, allow, markSent, CONFIG };