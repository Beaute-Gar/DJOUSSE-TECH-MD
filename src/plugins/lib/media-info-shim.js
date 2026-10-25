'use strict';
/**
 * Shim DJOUSSE : accès à mediaInfo de DJOUSE sans importer
 * handler.js au chargement (lazy → pas de cycle de require).
 */
module.exports = {
  mediaInfo: (msg) => require('../handler').mediaInfo(msg),
  TYPE_MAP: {
    image: 'imageMessage', video: 'videoMessage', audio: 'audioMessage',
    sticker: 'stickerMessage', document: 'documentMessage',
  },
};
