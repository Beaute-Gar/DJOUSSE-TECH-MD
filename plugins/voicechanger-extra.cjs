const { cmd } = require('../command.cjs');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

cmd({
  pattern: 'hansfast',
  react: '🎵',
  desc: 'Effet audio fast (voicechanger)',
  category: 'media',
  filename: __filename,
}, async (conn, m, commands, { from, reply }) => {
  if (!m.quoted || m.quoted.mtype !== 'audioMessage') return reply('Réponds à un audio avec .hansfast');
  try {
    await m.react('⏳').catch(() => {});
    const media = await m.quoted.download();
    const tmpDir = os.tmpdir();
    const mediaPath = path.join(tmpDir, `vc_${Date.now()}.webm`);
    const outputPath = path.join(tmpDir, `vc_${Date.now()}.mp3`);
    fs.writeFileSync(mediaPath, media);
    execFile('ffmpeg', ['-i', mediaPath, '-filter:a', 'atempo=1.63,asetrate=44100', '-y', outputPath], { timeout: 30000 }, (err) => {
      try { fs.unlinkSync(mediaPath); } catch (_) {}
      if (err) return reply('Erreur de traitement audio.');
      try {
        const buff = fs.readFileSync(outputPath);
        conn.sendMessage(from, { audio: buff, mimetype: 'audio/mpeg' }, { quoted: m });
      } catch (_) { reply('Erreur de lecture du fichier audio.'); }
      try { fs.unlinkSync(outputPath); } catch (_) {}
    });
  } catch (e) { reply('Erreur: ' + e.message); }
});
