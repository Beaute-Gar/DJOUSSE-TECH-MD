const { cmd } = require('../command.cjs');
const fetch = require('node-fetch');

cmd({
  pattern: 'mf',
  alias: ['mediafire'],
  react: '📥',
  desc: 'Télécharger depuis MediaFire',
  category: 'download',
  filename: __filename,
}, async (conn, m, commands, { from, q, reply }) => {
  if (!q || !q.startsWith('http')) return reply('❌ Fournis un lien MediaFire.');
  try {
    await m.react('⏳').catch(() => {});
    const { data } = await (await fetch('https://bk9.fun/download/mediafire?url=' + encodeURIComponent(q))).json();
    if (!data?.BK9?.link) throw new Error('Lien non trouvé.');
    await conn.sendMessage(from, { document: { url: data.BK9.link }, caption: '📥 *' + (data.BK9.name || 'fichier') + '*\n_Powered by DJOUSSE-TECH-MD_', mimetype: data.BK9.mime || 'application/octet-stream', fileName: data.BK9.name || 'file' }, { quoted: m });
    await m.react('✅').catch(() => {});
  } catch (error) { reply('❌ Erreur: ' + error.message); }
});
