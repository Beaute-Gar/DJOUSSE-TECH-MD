'use strict';
const { db } = require('./db');
const perms = require('./utils/perms');
const journal = require('./journal');
const { send } = require('../../lib/wa-send');
const ui = require('./ui');

const idOf = (p) => (typeof p === 'string' ? p : p && (p.id || p.jid || p.phoneNumber)) || '';

/**
 * Anti-fake : expulse les nouveaux membres dont l'indicatif n'est pas autorisé.
 * Retourne la liste des JID expulsés (handler.js les retire du message de bienvenue).
 */
async function enforceAntiFake(sock, { id: gid, participants = [], action }) {
  if (action !== 'add') return [];
  const g = db().getGroup(gid);
  if (!g.antifake || !g.allowedCodes.length) return [];

  const ids = participants.map(idOf).filter(Boolean);
  const meta = await perms.groupMeta(sock, gid, true);
  if (!perms.botIsAdmin(sock, meta)) return [];

  const removed = [];
  for (const jid of ids) {
    const part = perms.findParticipant(meta, jid);
    const phone = perms.jidNum((part && part.phoneNumber) || (jid.endsWith('@s.whatsapp.net') ? jid : ''));
    if (!phone) continue; // identité LID sans numéro : impossible de juger
    if (perms.isBotJid(sock, jid) || perms.isOwner(jid, part && part.phoneNumber) || perms.isParticipantAdmin(meta, jid)) continue;
    if (!g.allowedCodes.some((c) => phone.startsWith(c))) removed.push(jid);
  }
  if (!removed.length) return [];

  await sock.groupParticipantsUpdate(gid, removed, 'remove').catch(() => {});
  g.stats.antifake += removed.length;
  g.stats.kicked += removed.length;
  db().saveGroup(gid, g);
  await send(sock, gid, {
    text: ui.frame('ANTI-FAKE', [
      ...removed.map((j) => `🚫 @${perms.jidNum(j)}`),
      ui.kv('CAUSE', 'INDICATIF NON AUTORISÉ'),
      ui.kv('AUTORISÉS', g.allowedCodes.join(', ')),
    ]),
    mentions: removed,
  }).catch(() => {});
  await journal.notifyOwner(sock, [ui.kv('GROUPE', (meta && meta.subject) || gid), ui.kv('ANTI-FAKE', `${removed.length} EXPULSÉ(S)`)]);
  return removed;
}

module.exports = { enforceAntiFake };
