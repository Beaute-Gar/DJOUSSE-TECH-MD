const { cmd } = require('../command.cjs');
const { exec } = require('child_process');
const fs = require('fs');
const { getRandom } = require('../lib/myfunc.cjs');

const effects = {
  bass: '-af equalizer=f=54:width_type=o:width=2:g=20',
  blown: '-af acrusher=.1:1:64:0:log',
  deep: '-af atempo=4/4,asetrate=44500*2/3',
  earrape: '-af volume=12',
  fast: '-filter:a "atempo=1.63,asetrate=44100"',
  nightcore: '-filter:a atempo=1.06,asetrate=44100*1.25',
  robot: '-filter_complex "afftfilt=real=\'hypot(re,im)*sin(0)\':imag=\'hypot(re,im)*cos(0)\':win_size=512:overlap=0.75"',
  slow: '-filter:a "atempo=0.7,asetrate=44100"',
  tupai: '-filter:a "atempo=0.5,asetrate=65100"',
};

for (const [name, filter] of Object.entries(effects)) {
  cmd({
    pattern: name,
    react: '🎵',
    desc: 'Effet audio ' + name,
    category: 'media',
    filename: __filename,
  }, async (conn, m, commands, { from, reply }) => {
    if (!m.quoted || m.quoted.mtype !== 'audioMessage') return reply('❌ Réponds à un audio avec .' + name);
    try {
      await m.react('⏳').catch(() => {});
      const media = await m.quoted.download();
      const mediaPath = './' + getR() + '.webm';
      fs.writeFileSync(mediaPath, media);
      const outputPath = './' + getR() + '.mp3';
      exec('ffmpeg -i ' + mediaPath + ' ' + filter + ' ' + outputPath, (err) => {
        fs.unlinkSync(mediaPath);
        if (err) return reply('❌ Erreur de traitement audio.');
        const buff = fs.readFileSync(outputPath);
        conn.sendMessage(from, { audio: buff, mimetype: 'audio/mpeg' }, { quoted: m });
        fs.unlinkSync(outputPath);
      });
    } catch (e) { reply('❌ Erreur: ' + e.message); }
  });
}

function getR() { return Math.random().toString(36).substring(7); }
