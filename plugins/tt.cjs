const { cmd } = require('../command.cjs');
const dl = require('../lib/dl.cjs');

cmd({ pattern: 'tt', alias: ['ttdl', 'tiktok'], desc: 'Télécharger une vidéo TikTok', category: 'download', filename: __filename }, async (conn, m) => {
  const url = dl.pickUrl(m, []);
  if (!url) return m.reply('❌ Usage: .tt <url TikTok>');
  if (!/tiktok\.com/.test(url)) return m.reply('❌ Ce lien n\'est pas TikTok.');
  m.reply('⬇️ Téléchargement TikTok...');
  const res = await dl.downloadTiktok(url);
  if (!res.ok) return m.reply('❌ Échec du téléchargement TikTok.');
  const caption = `⬇️ *TikTok*\n${res.title ? '📌 ' + res.title : ''}\n\n© DJOUSSE TECH`;
  try {
    await conn.sendMessage(m.chat, { video: res.buffer, caption }, { quoted: m });
  } catch (e) {
    try { await conn.sendMessage(m.chat, { image: res.buffer, caption }, { quoted: m }); }
    catch (e2) { m.reply('❌ Échec envoi du média.'); }
  }
});