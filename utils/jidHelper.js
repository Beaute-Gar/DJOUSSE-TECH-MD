const { jidDecode, jidEncode } = require('@whiskeysockets/baileys');

const normalizeJid = (jid) => {
  if (!jid) return null;
  if (typeof jid !== 'string') return null;
  if (jid.includes(':')) return jid.split(':')[0];
  if (jid.includes('@')) return jid.split('@')[0];
  return jid;
};

const normalizeJidWithLid = (jid) => {
  if (!jid) return jid;
  try {
    const decoded = jidDecode(jid);
    if (!decoded?.user) {
      return `${jid.split(':')[0].split('@')[0]}@s.whatsapp.net`;
    }
    let user = decoded.user;
    let server = decoded.server === 'c.us' ? 's.whatsapp.net' : decoded.server;
    if (server === 'lid' || server === 'hosted.lid') {
      server = 's.whatsapp.net';
    }
    return jidEncode(user, server);
  } catch (e) {
    return jid;
  }
};

const buildComparableIds = (jid) => {
  if (!jid) return [];
  try {
    const decoded = jidDecode(jid);
    if (!decoded?.user) return [normalizeJidWithLid(jid)].filter(Boolean);
    const variants = new Set();
    const server = decoded.server === 'c.us' ? 's.whatsapp.net' : decoded.server;
    variants.add(jidEncode(decoded.user, server));
    return Array.from(variants);
  } catch (e) {
    return [jid];
  }
};

const findParticipant = (participants = [], userIds) => {
  const targets = (Array.isArray(userIds) ? userIds : [userIds])
    .filter(Boolean)
    .flatMap(id => buildComparableIds(id));
  if (!targets.length) return null;
  return participants.find(p => {
    if (!p) return false;
    const ids = [p.id, p.lid, p.userJid].filter(Boolean).flatMap(id => buildComparableIds(id));
    return ids.some(id => targets.includes(id));
  }) || null;
};

module.exports = { normalizeJid, normalizeJidWithLid, buildComparableIds, findParticipant };