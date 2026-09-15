const { cmd } = require('../command.cjs');
const axios = require('axios');

/* Migré 2026-08-29 : legacy Baileys (stream download Baileys) → adapter wwebjs.
   Le téléchargement passe par ctx.wa.getMedia() (multi-stratégie vue-unique
   incluse). Seule l'API externe imgbb est conservée à l'identique. */
const IMGBB_URL = 'https://api.imgbb.com/1/upload?key=87aec8ffa13473e9eb6cbfd0ffd309ba';

cmd({
  pattern: 'imageurl',
  desc: 'Upload an image to get its URL',
  category: 'tools',
  react: '🖼',
  filename: __filename,
  fromMe: false,
}, async (conn, m, commands, { reply, ctx }) => {
  try {
    const quoted = (ctx && ctx.getQuoted()) || (m && m.quoted);
    const qmsg = quoted && quoted.msg;
    const isImage = !!(qmsg && (qmsg.imageMessage || qmsg.stickerMessage)) || (quoted && quoted.type === 'image');
    if (!quoted || !isImage) {
      return reply('❌ Please reply to an image.');
    }

    if (ctx && ctx.wa && !ctx.wa.supports('media')) {
      return reply('❌ La récupération de média n\'est pas disponible avec ce moteur.');
    }

    let buf = null;
    try {
      buf = ctx ? await ctx.getMedia(quoted) : await conn.downloadMediaMessage(quoted);
    } catch (e) {}

    if (!buf || !Buffer.isBuffer(buf) || buf.length === 0) {
      return readRawFallback(conn, quoted, reply);
    }

    const fd = new FormData();
    fd.append('image', buf, { filename: 'image.jpg', contentType: 'image/jpeg' });
    const r = await axios.post(IMGBB_URL, fd, { headers: fd.getHeaders() });
    const url = r.data && r.data.data && r.data.data.url;
    if (url) return reply('Here\'s the URL of the image:\n' + url);
    return reply('❌ An error occurred while processing the image.');
  } catch (e) {
    console.error('imageurl:', e.message);
    try {
      reply('❌ An error occurred while processing the image.');
    } catch (e2) {}
  }
});

async function readRawFallback(conn, quoted, reply) {
  try {
    const raw = quoted && (quoted._be_raw || (quoted.msg && quoted.msg._be_raw));
    if (raw && typeof raw.downloadMedia === 'function') {
      const media = await raw.downloadMedia();
      if (media && media.data) {
        const fd = new FormData();
        fd.append('image', Buffer.from(media.data, 'base64'), { filename: 'image.jpg', contentType: media.mimetype || 'image/jpeg' });
        const r = await axios.post(IMGBB_URL, fd, { headers: fd.getHeaders() });
        const url = r.data && r.data.data && r.data.data.url;
        if (url) return reply('Here\'s the URL of the image:\n' + url);
      }
    }
  } catch (e) {}
  return reply('❌ Failed to download the image.');
}