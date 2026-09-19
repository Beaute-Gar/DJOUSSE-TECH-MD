const { cmd } = require('../command.cjs');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { box } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'toimage',
  alias: ['takepic'],
  react: '🖼️',
  desc: 'Convertir sticker en image',
  category: 'convert',
  filename: __filename,
}, async (conn, m, commands, { from, reply }) => {
  const quoted = m.quoted;
  if (!quoted || quoted.mtype !== 'stickerMessage') return reply(box('CONVERTISSEUR', [{ raw: 'Réponds à un sticker avec .toimage' }]));
  try {
    await m.react('⏳').catch(() => {});
    const media = await quoted.download();
    if (!media) throw new Error('Échec du téléchargement.');
    const tmpDir = os.tmpdir();
    const webpFile = path.join(tmpDir, `sticker_${Date.now()}.webp`);
    const pngFile = path.join(tmpDir, `sticker_${Date.now()}.png`);
    fs.writeFileSync(webpFile, media);
    await new Promise((resolve, reject) => {
      execFile('ffmpeg', ['-i', webpFile, '-y', pngFile], { timeout: 15000 }, (error) => {
        if (error) reject(error); else resolve();
      });
    });
    await conn.sendMessage(from, { image: { url: pngFile }, caption: box('SUCCESS', [{ raw: 'Sticker converti !' }]) }, { quoted: m });
    try { fs.unlinkSync(webpFile); } catch (_) {}
    try { fs.unlinkSync(pngFile); } catch (_) {}
    await m.react('✅').catch(() => {});
  } catch (error) { reply(box('ERROR', [{ raw: `Erreur: ${error.message}` }])); }
});
