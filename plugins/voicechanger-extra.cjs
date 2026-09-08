const { cmd } = require('../command.cjs');
const { exec } = require('child_process');
const fs = require('fs');

cmd({
  pattern: 'hansfast',
  react: '🎵',
  desc: 'Effet audio fast (voicechanger)',
  category: 'media',
  filename: __filename,
}, async (conn, m, commands, { from, reply }) => {
  if (!m.quoted || m.quoted.mtype !== 'audioMessage') return reply('❌ Réponds à un audio avec .hansfast');
  try {
    await m.react('⏳').catch(() => {});
    const media = await m.quoted.download();
    const mediaPath = './' + Math.random().toString(36).substring(7) + '.webm';
    fs.writeFileSync(mediaPath, media);
    const outputPath = './' + Math.random().toString(36).substring(7) + '.mp3';
    exec('ffmpeg -i ' + mediaPath + ' -filter:a "atempo=1.63,asetrate=44100" ' + outputPath, (err) => {
      fs.unlinkSync(mediaPath);
      if (err) return reply('❌ Erreur de traitement audio.');
      const buff = fs.readFileSync(outputPath);
      conn.sendMessage(from, { audio: buff, mimetype: 'audio/mpeg' }, { quoted: m });
      fs.unlinkSync(outputPath);
    });
  } catch (e) { reply('❌ Erreur: ' + e.message); }
});
