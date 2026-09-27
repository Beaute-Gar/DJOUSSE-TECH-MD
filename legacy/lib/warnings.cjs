'use strict';

/**
 * ============================================================
 * DJOUSSE TECH — WARNING SYSTEM
 * ============================================================
 *
 * Système d'avertissements progressifs :
 * - Warn → Mute → Kick → Ban
 * - Persistance dans data/warnings.json
 * - Auto-expiration des warns
 * - Historique des actions
 *
 * Adapté de WhatsAppAIModerateur (Python) → Node.js
 *
 * ============================================================
 */

const fs = require('fs');
const path = require('path');

// ─── Paths ─────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, '..', 'database');
const WARNINGS_FILE = path.join(DATA_DIR, 'warnings.json');
const ACTION_LOG_FILE = path.join(DATA_DIR, 'moderation-log.json');

// ─── Config par défaut ─────────────────────────────────
const DEFAULT_CONFIG = {
  maxWarnings: 3,           // 3 warnings → ban
  warnExpiryDays: 30,       // Warning expire après 30j
  muteDurations: [          // Durées de mute progressif
    5 * 60 * 1000,          // 5 minutes
    30 * 60 * 1000,         // 30 minutes
    60 * 60 * 1000,         // 1 heure
  ],
  autoBan: true,            // Ban automatique après maxWarnings
  autoDeleteSpam: true,     // Supprimer les messages spam
};

// ─── State ─────────────────────────────────────────────
let warnings = {};      // { "jid:user": [{reason, timestamp, level}] }
let actionLog = [];     // [{action, user, group, reason, timestamp}]

// ═══════════════════════════════════════════════════════
// LOGGING
// ═══════════════════════════════════════════════════════

function log(msg) { console.log(`[WARNINGS] ${msg}`); }

// ═══════════════════════════════════════════════════════
// PERSISTANCE
// ═══════════════════════════════════════════════════════

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadWarnings() {
  try {
    ensureDataDir();
    if (fs.existsSync(WARNINGS_FILE)) {
      warnings = JSON.parse(fs.readFileSync(WARNINGS_FILE, 'utf8'));
    }
  } catch {
    warnings = {};
  }
}

function saveWarnings() {
  try {
    ensureDataDir();
    fs.writeFileSync(WARNINGS_FILE, JSON.stringify(warnings, null, 2), 'utf8');
  } catch (e) {
    log(`Erreur écriture: ${e.message}`);
  }
}

function loadActionLog() {
  try {
    ensureDataDir();
    if (fs.existsSync(ACTION_LOG_FILE)) {
      actionLog = JSON.parse(fs.readFileSync(ACTION_LOG_FILE, 'utf8'));
    }
  } catch {
    actionLog = [];
  }
}

function saveActionLog() {
  try {
    ensureDataDir();
    if (actionLog.length > 500) actionLog = actionLog.slice(-500);
    fs.writeFileSync(ACTION_LOG_FILE, JSON.stringify(actionLog, null, 2), 'utf8');
  } catch {}
}

// ═══════════════════════════════════════════════════════
// CLÉS
// ═══════════════════════════════════════════════════════

function getKey(jid, sender) {
  const phone = sender.split('@')[0].split(':')[0];
  return `${jid}:${phone}`;
}

function getPhone(sender) {
  return sender.split('@')[0].split(':')[0];
}

// ═══════════════════════════════════════════════════════
// NETTOYAGE EXPIRATION
// ═══════════════════════════════════════════════════════

function cleanExpiredWarnings() {
  const now = Date.now();
  const expiryMs = DEFAULT_CONFIG.warnExpiryDays * 24 * 60 * 60 * 1000;
  let cleaned = 0;

  for (const key of Object.keys(warnings)) {
    const before = warnings[key].length;
    warnings[key] = warnings[key].filter(w => now - w.timestamp < expiryMs);
    cleaned += before - warnings[key].length;
    if (warnings[key].length === 0) delete warnings[key];
  }

  if (cleaned > 0) {
    log(`${cleaned} warnings expirés supprimés`);
    saveWarnings();
  }
}

// ═══════════════════════════════════════════════════════
// WARN
// ═══════════════════════════════════════════════════════

/**
 * Ajoute un warning à un utilisateur
 * @returns {{ action: string, warnCount: number, muted?: boolean, banned?: boolean }}
 */
function warn(jid, sender, reason = 'Non spécifié') {
  loadWarnings();
  cleanExpiredWarnings();

  const key = getKey(jid, sender);
  const phone = getPhone(sender);

  if (!warnings[key]) warnings[key] = [];

  warnings[key].push({
    reason,
    timestamp: Date.now(),
    level: warnings[key].length + 1,
  });

  const warnCount = warnings[key].length;
  saveWarnings();

  // Log action
  logAction('warn', phone, jid, reason, warnCount);

  log(`⚠️ ${phone} — warning ${warnCount}/${DEFAULT_CONFIG.maxWarnings} — ${reason}`);

  // ── Actions automatiques ──
  if (warnCount >= DEFAULT_CONFIG.maxWarnings && DEFAULT_CONFIG.autoBan) {
    logAction('ban', phone, jid, `Auto-ban après ${warnCount} warnings`);
    return { action: 'ban', warnCount, banned: true };
  }

  if (warnCount <= DEFAULT_CONFIG.muteDurations.length) {
    const muteDuration = DEFAULT_CONFIG.muteDurations[warnCount - 1];
    logAction('mute', phone, jid, `Mute ${muteDuration / 60000}min`, warnCount);
    return { action: 'mute', warnCount, muted: true, muteDuration };
  }

  return { action: 'warned', warnCount };
}

// ═══════════════════════════════════════════════════════
// REMOVE WARN
// ═══════════════════════════════════════════════════════

function removeWarning(jid, sender, index = -1) {
  loadWarnings();
  const key = getKey(jid, sender);

  if (!warnings[key] || warnings[key].length === 0) return false;

  if (index === -1) {
    // Supprimer le dernier
    warnings[key].pop();
  } else if (index >= 0 && index < warnings[key].length) {
    warnings[key].splice(index, 1);
  }

  if (warnings[key].length === 0) delete warnings[key];
  saveWarnings();
  return true;
}

function clearWarnings(jid, sender) {
  loadWarnings();
  const key = getKey(jid, sender);
  delete warnings[key];
  saveWarnings();
  log(`🗑️ Warnings effacés pour ${getPhone(sender)}`);
}

// ═══════════════════════════════════════════════════════
// QUERIES
// ═══════════════════════════════════════════════════════

function getWarnings(jid, sender) {
  loadWarnings();
  cleanExpiredWarnings();
  const key = getKey(jid, sender);
  return warnings[key] || [];
}

function getWarnCount(jid, sender) {
  return getWarnings(jid, sender).length;
}

function getGroupWarnings(jid) {
  loadWarnings();
  cleanExpiredWarnings();
  const result = {};
  for (const [key, warns] of Object.entries(warnings)) {
    if (key.startsWith(`${jid}:`)) {
      const phone = key.split(':')[1];
      result[phone] = warns;
    }
  }
  return result;
}

// ═══════════════════════════════════════════════════════
// LOG DES ACTIONS
// ═══════════════════════════════════════════════════════

function logAction(action, user, group, reason, extra = null) {
  loadActionLog();
  actionLog.push({
    action,
    user,
    group,
    reason,
    extra,
    timestamp: new Date().toISOString(),
  });
  saveActionLog();
}

function getActionLog(limit = 20) {
  loadActionLog();
  return actionLog.slice(-limit);
}

// ═══════════════════════════════════════════════════════
// FORMAT RAPPORT
// ═══════════════════════════════════════════════════════

function formatUserWarnings(jid, sender) {
  const warns = getWarnings(jid, sender);
  if (warns.length === 0) {
    return `✅ Aucun warning pour cet utilisateur.`;
  }

  const lines = warns.map((w, i) => {
    const date = new Date(w.timestamp).toLocaleDateString('fr-FR');
    return `  ${i + 1}. ⚠️ ${w.reason} (${date})`;
  });

  return `⚠️ *Warnings:* ${warns.length}/${DEFAULT_CONFIG.maxWarnings}\n\n${lines.join('\n')}`;
}

function formatGroupReport(jid) {
  const groupWarns = getGroupWarnings(jid);
  const users = Object.keys(groupWarns);

  if (users.length === 0) {
    return `✅ Aucun warning dans ce groupe.`;
  }

  const lines = users.map(phone => {
    const count = groupWarns[phone].length;
    return `  📱 ${phone} — ${count} warning(s)`;
  });

  return `⚠️ *Groupe — ${users.length} utilisateur(s) avec warnings:*\n\n${lines.join('\n')}`;
}

function formatModerationLog(limit = 10) {
  const log = getActionLog(limit);
  if (log.length === 0) return `📋 Aucune action de modération.`;

  const lines = log.map(a => {
    const date = new Date(a.timestamp).toLocaleDateString('fr-FR');
    const icons = { warn: '⚠️', mute: '🔇', ban: '🚫', kick: '👢' };
    return `  ${icons[a.action] || '•'} ${a.action.toUpperCase()} ${a.user} — ${a.reason} (${date})`;
  });

  return `📋 *Dernières actions:*\n\n${lines.join('\n')}`;
}

// ═══════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════

module.exports = {
  warn,
  removeWarning,
  clearWarnings,
  getWarnings,
  getWarnCount,
  getGroupWarnings,
  getActionLog,
  logAction,
  formatUserWarnings,
  formatGroupReport,
  formatModerationLog,
  DEFAULT_CONFIG,
};
