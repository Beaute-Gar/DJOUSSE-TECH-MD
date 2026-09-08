const { cmd } = require('../command.cjs');
const baileysDl = (() => { try { return require('@whiskeysockets/baileys').downloadMediaMessage; } catch { return null; } })();
const fallbackDl = require('../lib/msg.cjs').downloadMediaMessage;

/* vv.cjs — Récupère un média "vue unique" (view once) cité, ou le dernier reçu.
   Utilise Baileys natif pour le téléchargement. */

cmd({
  pattern: 'vv',
  alias: ['viewonce', 'vu', 'once'],
  react: '👻',
  desc: 'Récupère un média vue unique cité',
  category: 'tools',
  filename: __filename
}, async (conn, m, commands, { q, reply }) => {
  try {
    let target = m.quoted;
    let mediaType, msg;

    if (target && target.message) {
      /* média cité */
      msg = target.message;
      if (msg.viewOnceMessageV2) msg = msg.viewOnceMessageV2.message;
      else if (msg.viewOnceMessage) msg = msg.viewOnceMessage.message;
      
      mediaType = Object.keys(msg)[0];
    } else {
      /* chercher dans le cache des vue-unique reçus */
      const cache = global.__recentViewOnce || [];
      if (cache.length === 0) {
        return reply('👻 *Réponds à un message vue unique avec .vv*');
      }
      const entry = cache[0];
      target = entry.msg || entry.m?.msg;
      if (!target || !target.message) {
        return reply('👻 *Pas de vue unique en cache*');
      }
      msg = target.message;
      if (msg.viewOnceMessageV2) msg = msg.viewOnceMessageV2.message;
      else if (msg.viewOnceMessage) msg = msg.viewOnceMessage.message;
      
      mediaType = Object.keys(msg)[0];
    }

    if (!mediaType) return reply('❌ Pas de média trouvé');

    await conn.sendMessage(m.chat, { react: { text: '⏳', key: m.key } }).catch(() => {});

    let buffer;
    if (baileysDl) {
      try {
        buffer = await baileysDl(target, 'buffer');
      } catch (e) {
        console.error('❌ vv baileys dl:', e.message);
      }
    }
    if (!buffer && fallbackDl) {
      try {
        buffer = await fallbackDl(target, 'vv_media');
      } catch (e) {
        console.error('❌ vv fallback dl:', e.message);
      }
    }
    if (!buffer) return reply('❌ Impossible de télécharger le média');

    const caption = '👻 *VUE UNIQUE* — récupéré par DJOUSSE-TECH-MD';

    if (mediaType === 'imageMessage') {
      await conn.sendMessage(m.chat, { image: buffer, caption }, { quoted: m });
    } else if (mediaType === 'videoMessage') {
      await conn.sendMessage(m.chat, { video: buffer, caption, mimetype: 'video/mp4' }, { quoted: m });
    } else if (mediaType === 'audioMessage') {
      await conn.sendMessage(m.chat, { audio: buffer, mimetype: msg.audioMessage?.mimetype || 'audio/ogg', ptt: true }, { quoted: m });
    } else if (mediaType === 'stickerMessage') {
      await conn.sendMessage(m.chat, { sticker: buffer }, { quoted: m });
    } else if (mediaType === 'documentMessage') {
      await conn.sendMessage(m.chat, { document: buffer, fileName: msg.documentMessage?.fileName || 'file.bin', mimetype: msg.documentMessage?.mimetype }, { quoted: m });
    } else {
      return reply('❌ Type non supporté: ' + mediaType);
    }

    await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } }).catch(() => {});
  } catch (e) {
    console.error('❌ vv:', e.message);
    reply('❌ Erreur: ' + e.message);
  }
});
