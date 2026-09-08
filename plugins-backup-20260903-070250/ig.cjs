const { cmd } = require('../command.cjs');
const dl = require('../lib/dl.cjs');

cmd({ pattern: 'ig', alias: ['instagram', 'insta', 'igdl'], desc: 'Télécharger une photo/vidéo Instagram', category: 'download', filename: __filename }, async (conn, m) => {
  const url = dl.pickUrl(m, []);
  if (!url) return m.reply('❌ Usage: .ig <url Instagram>');
  if (!/(instagram\.com|instagr\.am)/.test(url)) return m.reply('❌ Ce lien n\'est pas Instagram.');
  m.reply('⬇️ Téléchargement Instagram...');
  const res = await dl.downloadInstagram(url);
  if (!res.ok) return m.reply('❌ Échec du téléchargement Instagram.\nℹ️ Vidéo privée ou URL invalide.');
  const caption = `⬇️ *Instagram*\n${res.title ? '📌 ' + res.title : ''}\n\n© DJOUSSE TECH`;
  try {
    await conn.sendMessage(m.chat, { video: res.buffer, caption }, { quoted: m });
  } catch (e) {
    try { await conn.sendMessage(m.chat, { image: res.buffer, caption }, { quoted: m }); }
    catch (e2) { m.reply('❌ Échec envoi du média.'); }
  }
});