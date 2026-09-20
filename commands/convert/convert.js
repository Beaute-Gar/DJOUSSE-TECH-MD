const { cmd } = require('../command.cjs');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

ffmpeg.setFfmpegPath(ffmpegPath);

// Conversion locale via anyform (sans API externe)
let anyform = null;
try { anyform = require('@bloopstudio/anyform'); } catch (_) {}

async function convertWithFfmpeg(inputPath, outputPath, format) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .toFormat(format)
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err))
      .save(outputPath);
  });
}

cmd({ pattern: 'toimg', desc: 'Convert sticker to image', category: 'convert', filename: __filename }, async (conn, m, commands, { reply }) => {
  try {
    const src = (m.quoted && m.quoted.msg) ? m.quoted : m;
    if (src.type !== 'stickerMessage') {
      return reply(boxWithFooter('🖼️ *TOIMG*', [
        { raw: '❌ *Utilisation :* réponds à un sticker avec .toimg' },
      ]));
    }
    const media = await conn.downloadMediaMessage(src);
    // Utiliser anyform si disponible, sinon ffmpeg
    if (anyform && anyform.convertImage) {
      const png = await anyform.convertImage(media, 'png');
      await conn.sendMessage(m.chat, { image: png, caption: box('🖼️ *TOIMG*', [{ raw: 'Sticker converti !' }]) }, { quoted: m });
    } else {
      const tmpDir = require('os').tmpdir();
      const webpFile = path.join(tmpDir, `stk_${Date.now()}.webp`);
      const pngFile = path.join(tmpDir, `stk_${Date.now()}.png`);
      fs.writeFileSync(webpFile, media);
      await convertWithFfmpeg(webpFile, pngFile, 'png');
      const img = fs.readFileSync(pngFile);
      await conn.sendMessage(m.chat, { image: img, caption: box('🖼️ *TOIMG*', [{ raw: 'Sticker converti !' }]) }, { quoted: m });
      try { fs.unlinkSync(webpFile); } catch (_) {}
      try { fs.unlinkSync(pngFile); } catch (_) {}
    }
  } catch (err) {
    reply(boxWithFooter('🖼️ *TOIMG*', [{ raw: '⚠️ *Erreur :* ' + err.message }]));
  }
});

cmd({ pattern: 'tomp3', desc: 'Convert video/voice to mp3', category: 'convert', filename: __filename }, async (conn, m, commands, { reply }) => {
  try {
    const src = (m.quoted && m.quoted.msg) ? m.quoted : m;
    if (src.type !== 'videoMessage' && src.type !== 'audioMessage') {
      return reply(boxWithFooter('🎵 *TOMP3*', [
        { raw: '❌ *Utilisation :* réponds à une vidéo ou note vocale avec .tomp3' },
      ]));
    }
    const inputPath = path.join(__dirname, '../tmp/input.mp4');
    const outputPath = path.join(__dirname, '../tmp/output.mp3');
    const media = await conn.downloadMediaMessage(src);
    fs.writeFileSync(inputPath, media);
    // Utiliser anyform si disponible
    if (anyform && anyform.convertAudio) {
      const mp3 = await anyform.convertAudio(media, 'mp3');
      await conn.sendMessage(m.chat, { audio: mp3, mimetype: 'audio/mpeg' }, { quoted: m });
    } else {
      await convertWithFfmpeg(inputPath, outputPath, 'mp3');
      const audio = fs.readFileSync(outputPath);
      await conn.sendMessage(m.chat, { audio, mimetype: 'audio/mpeg' }, { quoted: m });
    }
    try { fs.unlinkSync(inputPath); } catch (_) {}
    try { fs.unlinkSync(outputPath); } catch (_) {}
  } catch (err) {
    reply(boxWithFooter('🎵 *TOMP3*', [{ raw: '⚠️ *Erreur :* ' + err.message }]));
  }
});

cmd({ pattern: 'tovideo', desc: 'Convert animated sticker to video', category: 'convert', filename: __filename }, async (conn, m, commands, { reply }) => {
  try {
    const src = (m.quoted && m.quoted.msg) ? m.quoted : m;
    if (src.type !== 'stickerMessage') {
      return reply(boxWithFooter('🎬 *TOVIDEO*', [
        { raw: '❌ *Utilisation :* réponds à un sticker animé avec .tovideo' },
      ]));
    }
    const media = await conn.downloadMediaMessage(src);
    // Utiliser anyform si disponible
    if (anyform && anyform.convertImage) {
      const video = await anyform.convertImage(media, 'mp4');
      await conn.sendMessage(m.chat, { video, caption: box('🎬 *TOVIDEO*', [{ raw: 'Sticker converti en vidéo !' }]) }, { quoted: m });
    } else {
      await conn.sendMessage(m.chat, { video: media, caption: box('🎬 *TOVIDEO*', [{ raw: 'Sticker converti !' }]) }, { quoted: m });
    }
  } catch (err) {
    reply(boxWithFooter('🎬 *TOVIDEO*', [{ raw: '⚠️ *Erreur :* ' + err.message }]));
  }
});

cmd({ pattern: 'togif', desc: 'Convert animated sticker to gif', category: 'convert', filename: __filename }, async (conn, m, commands, { reply }) => {
  try {
    const src = (m.quoted && m.quoted.msg) ? m.quoted : m;
    if (src.type !== 'stickerMessage') {
      return reply(boxWithFooter('🎞️ *TOGIF*', [
        { raw: '❌ *Utilisation :* réponds à un sticker animé avec .togif' },
      ]));
    }
    const media = await conn.downloadMediaMessage(src);
    await conn.sendMessage(m.chat, { video: media, gifPlayback: true, caption: box('🎞️ *TOGIF*', [{ raw: 'GIF créé !' }]) }, { quoted: m });
  } catch (err) {
    reply(boxWithFooter('🎞️ *TOGIF*', [{ raw: '⚠️ *Erreur :* ' + err.message }]));
  }
});

cmd({ pattern: 'toaudio', desc: 'Convert video to audio', category: 'convert', filename: __filename }, async (conn, m, commands, { reply }) => {
  try {
    const src = (m.quoted && m.quoted.msg) ? m.quoted : m;
    if (src.type !== 'videoMessage') {
      return reply(boxWithFooter('🔊 *TOAUDIO*', [
        { raw: '❌ *Utilisation :* réponds à une vidéo avec .toaudio' },
      ]));
    }
    const inputPath = path.join(__dirname, '../tmp/input.mp4');
    const outputPath = path.join(__dirname, '../tmp/output.m4a');
    const media = await conn.downloadMediaMessage(src);
    fs.writeFileSync(inputPath, media);
    // Utiliser anyform si disponible
    if (anyform && anyform.convertAudio) {
      const audio = await anyform.convertAudio(media, 'm4a');
      await conn.sendMessage(m.chat, { audio, mimetype: 'audio/mp4' }, { quoted: m });
    } else {
      await convertWithFfmpeg(inputPath, outputPath, 'm4a');
      const audio = fs.readFileSync(outputPath);
      await conn.sendMessage(m.chat, { audio, mimetype: 'audio/mp4' }, { quoted: m });
    }
    try { fs.unlinkSync(inputPath); } catch (_) {}
    try { fs.unlinkSync(outputPath); } catch (_) {}
  } catch (err) {
    reply(boxWithFooter('🔊 *TOAUDIO*', [{ raw: '⚠️ *Erreur :* ' + err.message }]));
  }
});
