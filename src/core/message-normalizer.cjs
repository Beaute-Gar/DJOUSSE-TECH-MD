/* MessageNormalizer — contrat stable pour MESSAGE et GROUP, indépendant du moteur.
   Convertit n'importe quel message (Baileys, wwebjs, service) en un objet normalisé. */

function getQuoted(m) {
  return (m && m.quoted) ? m.quoted : null;
}

function normalizeMessage(m) {
  if (!m) return null;
  const key = m.key || {};
  const chatId = m.chat || key.remoteJid || null;
  const senderId = m.sender || key.participant || key.remoteJid || null;
  const isGroup = !!(m.isGroup || /@g\.us$/.test(String(chatId || '')));
  const body = String(m.body || m.text || '');

  let type = m.type || '';
  if (!type && m.msg) type = m.msg._type || (m.msg.constructor ? m.msg.constructor.name : '') || '';
  if (!type && m.message) {
    const entries = Object.keys(m.message);
    const known = ['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage', 'documentMessage',
      'conversation', 'extendedTextMessage', 'pollCreationMessage', 'contactMessage', 'locationMessage',
      'viewOnceMessage', 'buttonMessage', 'templateMessage', 'buttonsResponseMessage'];
    const hit = entries.find(e => known.includes(e));
    type = hit || (entries[0] || '');
  }

  const msg = m.msg || {};
  const isMedia = !!(msg.imageMessage || msg.videoMessage || msg.audioMessage || msg.stickerMessage || msg.documentMessage);

  return {
    id: key.id || m.id || null,
    key,
    chatId,
    senderId,
    isGroup,
    fromMe: !!m.fromMe,
    body,
    type,
    isMedia,
    hasQuoted: !!getQuoted(m),
    quoted: getQuoted(m),
    timestamp: m.timestamp || null,
    raw: m,
  };
}

function normalizeGroup(g) {
  if (!g) return null;
  const participants = (g.participants || []).map(p => {
    if (typeof p === 'string') return p;
    if (p.id && p.id._serialized) return p.id._serialized;
    return p.id || p.jid || null;
  });
  const rawAdmins = Array.isArray(g.adminJids)
    ? g.adminJids
    : (g.participants || []).filter(p => p && p.isAdmin).map(p => (p.id && p.id._serialized) || p.id);
  return {
    id: g.id || g.jid || null,
    subject: g.subject || g.name || g._serialized || '',
    desc: g.desc || g.description || '',
    owner: g.owner || g.ownerId || null,
    participantIds: participants.filter(Boolean),
    size: participants.filter(Boolean).length,
    adminJids: rawAdmins,
    ephemeralDuration: g.ephemeralDuration || null,
    raw: g,
  };
}

module.exports = { normalizeMessage, normalizeGroup, getQuoted };