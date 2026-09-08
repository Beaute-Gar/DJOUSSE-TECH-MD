const { cmd } = require('../command.cjs');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const { box } = require('../lib/djousse-ui.cjs');

ffmpeg.setFfmpegPath(ffmpegPath);

async function convertWithFfmpeg(inputPath, outputPath, format) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .toFormat(format)
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err))
      .save(outputPath);
  });
}

cmd({ pattern: 'sticker', alias: ['s', 'st'], desc: 'Convert image/video to sticker', category: 'MATHTOOL', filename: __filename }, async (conn, m, commands, { reply }) => {
  try {
    /* La cible média est le message cité (réponse) sinon le message lui-même (envoi direct) */
    const src = (m.quoted && m.quoted.msg) ? m.quoted : m;
    if (src.type !== 'imageMessage' && src.type !== 'videoMessage') {
      return reply(box('🎨 *STICKER*', [
        { raw: '❌ *Utilisation :* envoie ou réponds à une image ou une courte vidéo avec .sticker' },
        { raw: '✨ *Exemple :* .sticker' },
      ]));
    }
    const media = await conn.downloadMediaMessage(src);
    await conn.sendMessage(m.chat, { sticker: media }, { quoted: m });
  } catch (err) {
    reply(box('🎨 *STICKER*', [
      { raw: '⚠️ *Failed to make sticker:* ' + err.message },
    ]));
  }
});

cmd({ pattern: 'toimg', desc: 'Convert sticker to image', category: 'MATHTOOL', filename: __filename }, async (conn, m, commands, { reply }) => {
  try {
    const src = (m.quoted && m.quoted.msg) ? m.quoted : m;
    if (src.type !== 'stickerMessage') {
      return reply(box('🖼️ *TOIMG*', [
        { raw: '❌ *Utilisation :* réponds à un sticker avec .toimg' },
        { raw: '✨ *Exemple :* .toimg' },
      ]));
    }
    const media = await conn.downloadMediaMessage(src);
    await conn.sendMessage(m.chat, { image: media, caption: box('🖼️ *TOIMG*', [
      { raw: 'Here is your image!' },
    ]) }, { quoted: m });
  } catch (err) {
    reply(box('🖼️ *TOIMG*', [
      { raw: '⚠️ *Failed to convert sticker:* ' + err.message },
    ]));
  }
});

cmd({ pattern: 'tomp3', desc: 'Convert video/voice to mp3', category: 'MATHTOOL', filename: __filename }, async (conn, m, commands, { reply }) => {
  try {
    const src = (m.quoted && m.quoted.msg) ? m.quoted : m;
    if (src.type !== 'videoMessage' && src.type !== 'audioMessage') {
      return reply(box('🎵 *TOMP3*', [
        { raw: '❌ *Utilisation :* réponds à une vidéo ou une note vocale avec .tomp3' },
        { raw: '✨ *Exemple :* .tomp3' },
      ]));
    }
    const inputPath = path.join(__dirname, '../tmp/input.mp4');
    const outputPath = path.join(__dirname, '../tmp/output.mp3');
    const media = await conn.downloadMediaMessage(src);
    fs.writeFileSync(inputPath, media);
    await convertWithFfmpeg(inputPath, outputPath, 'mp3');
    const audio = fs.readFileSync(outputPath);
    await conn.sendMessage(m.chat, { audio, mimetype: 'audio/mpeg' }, { quoted: m });
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);
  } catch (err) {
    reply(box('🎵 *TOMP3*', [
      { raw: '⚠️ *Failed to convert:* ' + err.message },
    ]));
  }
});

cmd({ pattern: 'tovideo', desc: 'Convert animated sticker to video', category: 'MATHTOOL', filename: __filename }, async (conn, m, commands, { reply }) => {
  try {
    const src = (m.quoted && m.quoted.msg) ? m.quoted : m;
    if (src.type !== 'stickerMessage') {
      return reply(box('🎬 *TOVIDEO*', [
        { raw: '❌ *Utilisation :* réponds à un sticker animé avec .tovideo' },
        { raw: '✨ *Exemple :* .tovideo' },
      ]));
    }
    const media = await conn.downloadMediaMessage(src);
    await conn.sendMessage(m.chat, { video: media, caption: box('🎬 *TOVIDEO*', [
      { raw: 'Here is your video!' },
    ]) }, { quoted: m });
  } catch (err) {
    reply(box('🎬 *TOVIDEO*', [
      { raw: '⚠️ *Failed to convert sticker to video:* ' + err.message },
    ]));
  }
});

cmd({ pattern: 'togif', desc: 'Convert animated sticker to gif', category: 'MATHTOOL', filename: __filename }, async (conn, m, commands, { reply }) => {
  try {
    const src = (m.quoted && m.quoted.msg) ? m.quoted : m;
    if (src.type !== 'stickerMessage') {
      return reply(box('🎞️ *TOGIF*', [
        { raw: '❌ *Utilisation :* réponds à un sticker animé avec .togif' },
        { raw: '✨ *Exemple :* .togif' },
      ]));
    }
    const media = await conn.downloadMediaMessage(src);
    await conn.sendMessage(m.chat, { video: media, gifPlayback: true, caption: box('🎞️ *TOGIF*', [
      { raw: 'Here is your GIF!' },
    ]) }, { quoted: m });
  } catch (err) {
    reply(box('🎞️ *TOGIF*', [
      { raw: '⚠️ *Failed to convert sticker to gif:* ' + err.message },
    ]));
  }
});

cmd({ pattern: 'toaudio', desc: 'Convert video to audio', category: 'MATHTOOL', filename: __filename }, async (conn, m, commands, { reply }) => {
  try {
    const src = (m.quoted && m.quoted.msg) ? m.quoted : m;
    if (src.type !== 'videoMessage') {
      return reply(box('🔊 *TOAUDIO*', [
        { raw: '❌ *Utilisation :* réponds à une vidéo avec .toaudio' },
        { raw: '✨ *Exemple :* .toaudio' },
      ]));
    }
    const inputPath = path.join(__dirname, '../tmp/input.mp4');
    const outputPath = path.join(__dirname, '../tmp/output.m4a');
    const media = await conn.downloadMediaMessage(src);
    fs.writeFileSync(inputPath, media);
    await convertWithFfmpeg(inputPath, outputPath, 'm4a');
    const audio = fs.readFileSync(outputPath);
    await conn.sendMessage(m.chat, { audio, mimetype: 'audio/mp4' }, { quoted: m });
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);
  } catch (err) {
    reply(box('🔊 *TOAUDIO*', [
      { raw: '⚠️ *Failed to convert video to audio:* ' + err.message },
    ]));
  }
});
