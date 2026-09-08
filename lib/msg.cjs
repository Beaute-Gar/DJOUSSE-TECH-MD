/* lib/msg.cjs — Moteur whatsapp-web.js seul (legacy Baileys retiré).
   Toute la logique (sms, downloadMediaMessage, wrapBox, getContentType) est
   désormais portée par lib/wwebjs-msg.cjs. Ce fichier reste en place pour les
   imports existants (plugins, core-server, account-pipeline, adapter). */
module.exports = require('./wwebjs-msg.cjs');