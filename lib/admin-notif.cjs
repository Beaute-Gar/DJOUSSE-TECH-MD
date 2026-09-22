'use strict';

/**
 * ============================================================
 * DJOUSSE TECH — ADMIN NOTIFICATIONS
 * ============================================================
 *
 * Système de notification automatique aux admins :
 * - Spam détecté
 * - Warning ajouté
 * - Utilisateur banni
 - Groupe en danger
 * - Statut du bot
 *
 * Adapté de WhatsAppAIModerateur (Python) → Node.js
 *
 * ============================================================
 */

const config = require('../config');

// ─── Admins ────────────────────────────────────────────
const OWNER_NUMBER = config.ownerNumber?.replace(/[^0-9]/g, '') || '';
const BOT_NUMBER = config.botNumber?.replace(/[^0-9]/g, '') || '';

// ═══════════════════════════════════════════════════════
// LOGGING
// ═══════════════════════════════════════════════════════

function log(msg) { console.log(`[ADMIN-NOTIF] ${msg}`); }

// ═══════════════════════════════════════════════════════
// ENVOI DE NOTIFICATION
// ═══════════════════════════════════════════════════════

/**
 * Envoie une notification à l'owner du bot
 */
async function notifyOwner(sock, text) {
  if (!OWNER_NUMBER) {
    log('⚠️ Pas de numéro owner configuré');
    return false;
  }

  try {
    const jid = `${OWNER_NUMBER}@s.whatsapp.net`;
    await sock.sendMessage(jid, { text });
    log(`✅ Notification envoyée à l'owner`);
    return true;
  } catch (e) {
    log(`❌ Erreur envoi: ${e.message}`);
    return false;
  }
}

/**
 * Envoie une notification à un groupe d'admins
 */
async function notifyAdmins(sock, adminJids, text) {
  if (!adminJids || adminJids.length === 0) return false;

  let sent = 0;
  for (const jid of adminJids) {
    try {
      await sock.sendMessage(jid, { text });
      sent++;
    } catch {}
  }

  log(`✅ Notification envoyée à ${sent}/${adminJids.length} admins`);
  return sent > 0;
}

// ═══════════════════════════════════════════════════════
// TEMPLATES DE NOTIFICATION
// ═══════════════════════════════════════════════════════

/**
 * Spam détecté
 */
function spamDetected(data) {
  const { sender, group, message, score, reasons } = data;
  const phone = sender.split('@')[0].split(':')[0];
  const groupName = group?.split('@')[0] || 'Privé';

  return `🛡️ *SPAM DÉTECTÉ*

▸ Utilisateur · ${phone}
▸ Groupe      · ${groupName}
▸ Score       · ${score}/100
▸ Raisons     · ${reasons.join(', ')}

_msg supprimé automatiquement_`;
}

/**
 * Warning ajouté
 */
function warnAdded(data) {
  const { sender, group, reason, warnCount, maxWarnings } = data;
  const phone = sender.split('@')[0].split(':')[0];
  const groupName = group?.split('@')[0] || 'Privé';

  return `⚠️ *WARNING ${warnCount}/${maxWarnings}*

▸ Utilisateur · ${phone}
▸ Groupe      · ${groupName}
▸ Raison      · ${reason}

${warnCount >= maxWarnings ? '🚫 *BANNISSEMENT AUTOMATIQUE*' : `_Prochain warning → action automatique_`}`;
}

/**
 * Utilisateur banni
 */
function userBanned(data) {
  const { sender, group, reason, by } = data;
  const phone = sender.split('@')[0].split(':')[0];
  const groupName = group?.split('@')[0] || 'Privé';
  const byPhone = by?.split('@')[0] || 'Système';

  return `🚫 *UTILISATEUR BANNI*

▸ Utilisateur · ${phone}
▸ Groupe      · ${groupName}
▸ Raison      · ${reason}
▸ Par         · ${byPhone}`;
}

/**
 * Utilisateur muted
 */
function userMuted(data) {
  const { sender, group, duration, reason } = data;
  const phone = sender.split('@')[0].split(':')[0];
  const groupName = group?.split('@')[0] || 'Privé';
  const durationMin = Math.round(duration / 60000);

  return `🔇 *UTILISATEUR MUET*

▸ Utilisateur · ${phone}
▸ Groupe      · ${groupName}
▸ Durée       · ${durationMin} minutes
▸ Raison      · ${reason}`;
}

/**
 * Groupe en danger (flood, raid, etc.)
 */
function groupDanger(data) {
  const { group, threat, details } = data;
  const groupName = group?.split('@')[0] || 'Inconnu';

  return `🚨 *ALERTE GROUPE*

▸ Groupe  · ${groupName}
▸ Menace  · ${threat}
▸ Détails · ${details}`;
}

/**
 * Statut du bot
 */
function botStatus(data) {
  const { status, uptime, version } = data;

  return `🤖 *STATUT DU BOT*

▸ Statut   · ${status}
▸ Uptime   · ${uptime}
▸ Version  · ${version}`;
}

/**
 * Nouveau membre (optionnel)
 */
function newMember(data) {
  const { sender, group, totalMembers } = data;
  const phone = sender.split('@')[0].split(':')[0];
  const groupName = group?.split('@')[0] || 'Inconnu';

  return `👋 *NOUVEAU MEMBRE*

▸ Utilisateur · ${phone}
▸ Groupe      · ${groupName}
▸ Total       · ${totalMembers} membres`;
}

// ═══════════════════════════════════════════════════════
// ENVOI AVEC TEMPLATES
// ═══════════════════════════════════════════════════════

async function sendSpamAlert(sock, data) {
  const text = spamDetected(data);
  log(`🛡️ Spam: ${data.sender} dans ${data.group}`);
  return notifyOwner(sock, text);
}

async function sendWarnAlert(sock, data) {
  const text = warnAdded(data);
  log(`⚠️ Warn: ${data.sender} (${data.warnCount}/${data.maxWarnings})`);
  return notifyOwner(sock, text);
}

async function sendBanAlert(sock, data) {
  const text = userBanned(data);
  log(`🚫 Ban: ${data.sender}`);
  return notifyOwner(sock, text);
}

async function sendMuteAlert(sock, data) {
  const text = userMuted(data);
  log(`🔇 Mute: ${data.sender} (${data.duration / 60000}min)`);
  return notifyOwner(sock, text);
}

async function sendGroupAlert(sock, data) {
  const text = groupDanger(data);
  log(`🚨 Alerte groupe: ${data.group}`);
  return notifyOwner(sock, text);
}

// ═══════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════

module.exports = {
  notifyOwner,
  notifyAdmins,
  sendSpamAlert,
  sendWarnAlert,
  sendBanAlert,
  sendMuteAlert,
  sendGroupAlert,
  spamDetected,
  warnAdded,
  userBanned,
  userMuted,
  groupDanger,
  botStatus,
  newMember,
};
