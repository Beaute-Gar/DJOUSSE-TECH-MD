const { cmd } = require('../command.cjs');
const fs = require('fs');
const { exec } = require('child_process');

cmd({
  pattern: 'toimage',
  alias: ['takepic'],
  react: '🖼️',
  desc: 'Convertir sticker en image',
  category: 'convert',
  filename: __filename,
}, async (conn, m, commands, { from, reply }) => {
  const quoted = m.quoted;
  if (!quoted || quoted.mtype !== 'stickerMessage') return reply('❌ Réponds à un sticker avec .toimage');
  try {
    await m.react('⏳').catch(() => {});
    const media = await quoted.download();
    if (!media) throw new Error('Échec du téléchargement.');
    const fileName = './' + Date.now() + '.webp';
    const pngFile = fileName.replace('.webp', '.png');
    fs.writeFileSync(fileName, media);
    await new Promise((resolve, reject) => { exec('ffmpeg -i ' + fileName + ' ' + pngFile, (error) => { if (error) reject(error); else resolve(); }); });
    await conn.sendMessage(from, { image: { url: pngFile }, caption: '✅ *Sticker converti avec succès !*' }, { quoted: m });
    fs.unlinkSync(fileName); fs.unlinkSync(pngFile);
    await m.react('✅').catch(() => {});
  } catch (error) { reply('❌ Erreur: ' + error.message); }
});
