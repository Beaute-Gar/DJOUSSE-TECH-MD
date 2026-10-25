'use strict';
const config = require('../config');

const cache = new Map();
const jidNum = (j) => String(j || '').split('@')[0].split(':')[0];

async function groupMeta(sock, gid, force = false) {
  const c = cache.get(gid);
  if (!force && c && Date.now() - c.t < config.metaTtlMs) return c.meta;
  try {
    const meta = await sock.groupMetadata(gid);
    cache.set(gid, { t: Date.now(), meta });
    return meta;
  } catch (e) {
    return c ? c.meta : null;
  }
}
const invalidate = (gid) => cache.delete(gid);

// Compatible JID classique ET LID : on compare toutes les identités connues du participant.
const idsOf = (p) => [p.id, p.lid, p.phoneNumber, p.jid].filter(Boolean).map(jidNum);
const findParticipant = (meta, jid) => {
  const n = jidNum(jid);
  return meta && meta.participants ? meta.participants.find((p) => idsOf(p).includes(n)) : undefined;
};

function isParticipantAdmin(meta, jid) {
  const p = findParticipant(meta, jid);
  return !!p && (p.admin === 'admin' || p.admin === 'superadmin');
}

function botIsAdmin(sock, meta) {
  const me = [sock.user && sock.user.id, sock.user && sock.user.lid].filter(Boolean);
  return me.some((j) => isParticipantAdmin(meta, j));
}

function isBotJid(sock, jid) {
  const n = jidNum(jid);
  return [sock.user && sock.user.id, sock.user && sock.user.lid].filter(Boolean).map(jidNum).includes(n);
}

function isOwner(...jids) {
  return jids.filter(Boolean).some((j) => config.owners.includes(jidNum(j)));
}

module.exports = { groupMeta, invalidate, jidNum, findParticipant, isParticipantAdmin, botIsAdmin, isBotJid, isOwner };
