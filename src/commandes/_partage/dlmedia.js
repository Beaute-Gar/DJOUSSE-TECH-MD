'use strict';
/**
 * Shim DJOUSSE : '../lib/dlmedia' (téléchargement de médias).
 * Télécharge via l'API Baileys officielle (downloadMediaMessage)
 * + notre média-info interne. Autonome : aucune dépendance à handler.js.
 */
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { mediaInfo } = require('./media-info-shim');

/* core : dlBuffer(msg, sock|type) → Buffer ou null */
async function dlBuffer(msg, sockOrType, maybeSock) {
  try {
    const info = mediaInfo(msg);
    if (!info) return null;
    const node = info.content?.[info.type] || msg.message?.[info.type];
    const cible = node && typeof node === 'object' ? { ...node, mediaType: info.type } : null;
    if (cible) return await downloadMediaMessage(cible, 'buffer', {});
    /* repli : certains plugins passent déjà un node média */
    return null;
  } catch {
    return null;
  }
}

const TYPE_MAP = {
  image: 'imageMessage', video: 'videoMessage', audio: 'audioMessage',
  sticker: 'stickerMessage', document: 'documentMessage',
};

module.exports = { dlBuffer, TYPE_MAP };
