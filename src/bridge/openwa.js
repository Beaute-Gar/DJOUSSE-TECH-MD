/* src/bridge/openwa.cjs — Pont OpenWA (dual-engine anti-ban)
   OpenWA = gateway WhatsApp autonome (NestJS) exposant une REST API avec session(s)
   whatsapp-web.js (moins de bans) ou baileys. Le bot DJOUSSE continue sur Baileys ;
   ce pont permet d'envoyer les messages *sensibles* via OpenWA quand il est configuré.

   Configuration (variables d'environnement) :
     OPENWA_URL        = http://localhost:2785        (URL de l'API OpenWA)
     OPENWA_API_KEY    = clé API OpenWA (obligatoire)
     OPENWA_SESSION    = nom de session OpenWA (défaut: djousse)
     OPENWA_ENABLED    = auto (détecté si URL+clé) | true | false
     OPENWA_CHATID_SUF = suffixe jid, défaut @c.us

   Si non configuré, le pont est inactif et SILENCIEUX (aucun impact sur le bot). */

import { createLogger } from '../../packages/infrastructure/logger.js';
import { guardSend, isIpAllowed } from '../../lib/antiban.cjs';

const log = createLogger('OPENWA-BRIDGE');

let enabled = false;
let baseUrl = '';
let apiKey = '';
let session = 'djousse';
let chatSuffix = '@c.us';
let lastHealthAt = 0;
let healthOk = false;

function cfg() {
  const url = (process.env.OPENWA_URL || '').replace(/\/+$/, '');
  const key = process.env.OPENWA_API_KEY || '';
  const flag = String(process.env.OPENWA_ENABLED || 'auto').toLowerCase();
  const auto = flag === 'auto';
  enabled = flag === 'true' || (auto && Boolean(url && key));
  baseUrl = url;
  apiKey = key;
  session = process.env.OPENWA_SESSION || 'djousse';
  chatSuffix = process.env.OPENWA_CHATID_SUF || '@c.us';
}

function jidToChatId(jid) {
  const clean = String(jid || '').replace(/@[\w.-]+$/, '');
  return clean + chatSuffix;
}

function headers() {
  return {
    'Content-Type': 'application/json',
    'X-API-Key': apiKey,
    'User-Agent': 'DJOUSSE-OpenWA-Bridge/1.0',
  };
}

async function openwaRequest(path, { method = 'GET', body } = {}) {
  const res = await fetch(baseUrl + path, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`OpenWA ${res.status} ${path}: ${(data && (data.message || data.error)) || res.statusText}`);
  }
  return data;
}

/* ── Health check périodique (1/min) ── */
async function checkHealth() {
  if (!enabled) return false;
  const nowMs = Date.now();
  if (nowMs - lastHealthAt < 60 * 1000) return healthOk;
  lastHealthAt = nowMs;
  try {
    const h = await openwaRequest('/health');
    healthOk = !!(h && (h.status === 'ok' || h.status === 'healthy' || h.status === true || h.status === 'up'));
    return healthOk;
  } catch (e) {
    healthOk = false;
    log.warn(`OpenWA injoignable: ${e.message}`);
    return false;
  }
}

/* ── Initialisation (appelée au démarrage du bot, comme le pont WACRM) ── */
export async function initOpenwaBridge(sock) {
  cfg();
  if (!enabled) {
    log.info('OpenWA non configuré (pont inactif)');
    return false;
  }
  try {
    const ok = await checkHealth();
    log[ok ? 'info' : 'warn'](
      ok
        ? `✅ Pont OpenWA actif (${baseUrl}, session "${session}")`
        : `⚠️ OpenWA configuré mais injoignable (${baseUrl})`
    );
    return ok;
  } catch (e) {
    log.warn(`OpenWA init: ${e.message}`);
    return false;
  }
}

/* ── Envoi texte via OpenWA (whatsapp-web.js = risque de ban réduit) ── */
export async function openwaSendText(jid, text, opts = {}) {
  if (!enabled) return { skipped: true, reason: 'not_configured' };
  const guard = guardSend('openwa:' + (opts.session || session), opts.accountAgeMs);
  if (!guard.ok) {
    log.warn(`OpenWA rate limited (${guard.reason}), retry dans ${Math.round(guard.waitMs / 1000)}s`);
    return { skipped: true, reason: guard.reason, retryAfterMs: guard.waitMs };
  }
  if (guard.waitMs) await new Promise(r => setTimeout(r, guard.waitMs));
  try {
    const chatId = jidToChatId(jid);
    const payload = { chatId, text };
    if (opts.session) payload.session = opts.session;
    const result = await openwaRequest(
      `/api/sessions/${session}/messages/send-text`,
      { method: 'POST', body: payload }
    );
    return { skipped: false, result };
  } catch (e) {
    log.error(`OpenWA sendText: ${e.message}`);
    return { skipped: true, reason: e.message };
  }
}

/* ── État du pont ── */
export function openwaStatus() {
  return {
    enabled,
    url: baseUrl,
    session,
    healthOk,
    chatSuffix,
  };
}

/* ── Middleware CIDR pour une éventuelle route dédiée ── */
export function cidrGuard(ip) {
  return isIpAllowed(ip);
}
