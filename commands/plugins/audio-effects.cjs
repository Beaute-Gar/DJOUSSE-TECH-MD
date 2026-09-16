const { cmd } = require('../command.cjs');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { getRandom } = require('../lib/myfunc.cjs');

const effects = {
  bass: ['-af', 'equalizer=f=54:width_type=o:width=2:g=20'],
  blown: ['-af', 'acrusher=.1:1:64:0:log'],
  deep: ['-af', 'atempo=4/4,asetrate=44500*2/3'],
  earrape: ['-af', 'volume=12'],
  fast: ['-filter:a', 'atempo=1.63,asetrate=44100'],
  nightcore: ['-filter:a', 'atempo=1.06,asetrate=44100*1.25'],
  robot: ['-filter_complex', 'afftfilt=real=\'hypot(re,im)*sin(0)\':imag=\'hypot(re,im)*cos(0)\':win_size=512:overlap=0.75'],
  slow: ['-filter:a', 'atempo=0.7,asetrate=44100'],
  tupai: ['-filter:a', 'atempo=0.5,asetrate=65100'],
};

for (const [name, filterArgs] of Object.entries(effects)) {
  cmd({
    pattern: name,
    react: '🎵',
    desc: 'Effet audio ' + name,
    category: 'media',
    filename: __filename,
  }, async (conn, m, commands, { from, reply }) => {
    if (!m.quoted || m.quoted.mtype !== 'audioMessage') return reply('Réponds à un audio avec .' + name);
    try {
      await m.react('⏳').catch(() => {});
      const media = await m.quoted.download();
      const tmpDir = os.tmpdir();
      const mediaPath = path.join(tmpDir, `audio_${Date.now()}.webm`);
      const outputPath = path.join(tmpDir, `audio_${Date.now()}.mp3`);
      fs.writeFileSync(mediaPath, media);
      execFile('ffmpeg', ['-i', mediaPath, ...filterArgs, '-y', outputPath], { timeout: 30000 }, (err) => {
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
}
