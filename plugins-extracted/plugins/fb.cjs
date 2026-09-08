const { cmd } = require('../command.cjs');
const { box, truncate } = require('../lib/djousse-ui.cjs');
const getFBInfo = require('@xaviabot/fb-downloader');

/* fb.cjs — Téléchargement Facebook via @xaviabot/fb-downloader */

cmd({
  pattern: 'facebook',
  alias: ['fb', 'fbdl'],
  react: '📘',
  desc: 'Télécharger une vidéo Facebook',
  category: 'download',
  filename: __filename,
}, async (conn, m, commands, { q, reply }) => {
  if (!q) return reply(box('📘 *FACEBOOK DOWNLOADER*', [{ label: 'Utilisation', value: '.facebook <lien>' }]));
  try {
    await m.react('🕐').catch(() => {});
    const fbData = await getFBInfo(q);
    if (!fbData || (!fbData.sd && !fbData.hd)) {
      await m.react('❌').catch(() => {});
      return reply('❌ Aucun résultat trouvé. Vérifie le lien.');
    }

    const qualities = [];
    if (fbData.sd) qualities.push({ label: 'SD', value: fbData.sd });
    if (fbData.hd) qualities.push({ label: 'HD', value: fbData.hd });

    const url = qualities.find(q => q.label === 'HD')?.value || qualities[0].value;
    const res = await fetch(url);
    const buffer = Buffer.from(await res.arrayBuffer());

    const sizeMB = (buffer.length / (1024 * 1024)).toFixed(1);
    if (parseFloat(sizeMB) > 300) return reply('❌ Fichier trop volumineux (' + sizeMB + 'MB).');

    await conn.sendMessage(m.chat, {
      video: buffer,
      mimetype: 'video/mp4',
      caption: box('📘 *FACEBOOK*', [
        { label: 'Titre', value: truncate(fbData.title || 'Facebook Video', 100) },
        { label: 'Qualité', value: qualities.length > 1 ? 'HD disponible' : 'SD' },
      ]),
    }, { quoted: m });
    await m.react('✅').catch(() => {});
  } catch (e) {
    await m.react('❌').catch(() => {});
    reply(box('❌ *ERREUR*', [{ raw: truncate(e.message, 200) }]));
  }
});
