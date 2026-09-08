import { createLogger } from '../../infrastructure/logger.js';
import { rawGet, rawRun } from '../../infrastructure/database/database.js';

const log = createLogger('OWNERSILENCE');

const TABLE = 'owner_silence';

async function ensureTable() {
  await rawRun(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      jid TEXT PRIMARY KEY,
      owner_jid TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      last_message_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);
}

export async function enableSilence(jid, ownerJid) {
  await ensureTable();
  await rawRun(
    `INSERT OR REPLACE INTO ${TABLE} (jid, owner_jid, active, last_message_at, created_at) VALUES (?, ?, 1, ?, ?)`,
    [jid, ownerJid, Date.now(), Date.now()]
  );
}

export async function disableSilence(jid, ownerJid) {
  await rawRun(`DELETE FROM ${TABLE} WHERE jid = ? AND owner_jid = ?`, [jid, ownerJid]);
}

export async function isSilenced(jid, ownerJid) {
  const row = await rawGet(`SELECT active FROM ${TABLE} WHERE jid = ? AND owner_jid = ?`, [jid, ownerJid]);
  return row?.active === 1;
}

export async function updateActivity(jid, ownerJid) {
  await rawRun(
    `UPDATE ${TABLE} SET last_message_at = ? WHERE jid = ? AND owner_jid = ?`,
    [Date.now(), jid, ownerJid]
  );
}

export async function cleanupOldSilence(maxAgeMs = 24 * 60 * 60 * 1000) {
  const cutoff = Date.now() - maxAgeMs;
  await rawRun(`DELETE FROM ${TABLE} WHERE last_message_at < ?`, [cutoff]);
}

export async function getActiveSilences(ownerJid) {
  return await rawAll(`SELECT jid, last_message_at FROM ${TABLE} WHERE owner_jid = ? AND active = 1`, [ownerJid]);
}

export const ownersilenceName = 'silence';
export const ownersilenceAliases = ['muet', 'shh'];
export const ownersilenceDescription = 'Activer/désactiver le silence du bot dans ce PV (pour le propriétaire)';
export const ownersilenceCategory = 'owner';
export const ownersilenceLevel = 'owner';

export async function ownersilenceHandler(sock, m, { args, text, prefix, reply, sender }) {
  const config = await import('../../../config.cjs').then(c => c.default);
  const ownerNum = config.OWNER_NUMBER?.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
  
  if (sender !== ownerNum) {
    return reply('❌ Réservé au propriétaire');
  }
  
  const jid = m.key.remoteJid;
  const isGroup = jid?.endsWith('@g.us');
  
  if (isGroup) {
    return reply('❌ Cette commande ne fonctionne qu\'en message privé');
  }
  
  const argsText = args.join(' ').toLowerCase();
  const silenced = await isSilenced(jid, ownerNum);
  
  if (!argsText || argsText === 'toggle' || argsText === 't') {
    if (silenced) {
      await disableSilence(jid, ownerNum);
      return reply('🔊 *Silence désactivé* — Le bot répondra à nouveau dans cette conversation');
    } else {
      await enableSilence(jid, ownerNum);
      return reply('🔇 *Silence activé* — Le bot ne répondra plus automatiquement ici\nPour réactiver: `.silence`');
    }
  }
  
  if (argsText === 'on' || argsText === 'activé' || argsText === 'active') {
    if (silenced) return reply('ℹ️ Déjà en mode silence');
    await enableSilence(jid, ownerNum);
    return reply('🔇 Silence activé');
  }
  
  if (argsText === 'off' || argsText === 'désactivé' || argsText === 'desactive') {
    if (!silenced) return reply('ℹ️ Pas en mode silence');
    await disableSilence(jid, ownerNum);
    return reply('🔊 Silence désactivé');
  }
  
  if (argsText === 'status' || argsText === 'statut') {
    return reply(silenced ? '🔇 Silence ACTIF dans cette conversation' : '🔊 Silence INACTIF — Bot répond normalement');
  }
  
  return reply(`Usage: ${prefix}silence [on|off|toggle|status]\nSans argument: bascule le mode`);
}

export async function checkOwnerSilence(jid, sender) {
  const config = await import('../../../config.cjs').then(c => c.default);
  const ownerNum = config.OWNER_NUMBER?.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
  
  if (sender !== ownerNum) return false;
  return await isSilenced(jid, ownerNum);
}

export async function trackOwnerMessage(jid, sender) {
  const config = await import('../../../config.cjs').then(c => c.default);
  const ownerNum = config.OWNER_NUMBER?.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
  
  if (sender === ownerNum) {
    await updateActivity(jid, ownerNum);
  }
}