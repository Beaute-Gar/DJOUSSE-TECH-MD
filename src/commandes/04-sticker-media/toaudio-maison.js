'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config, downloadFrom, mediaInfo, send, toAudioBuffer } = env;
cmd('toaudio', { cat: 4, desc: 'Vidéo → mp3', usage: 'toaudio (réponds à une vidéo)' }, async (ctx) => {
  const info = mediaInfo(ctx.msg);
  if (!info || !['videoMessage', 'audioMessage'].includes(info.type)) {
    return ctx.reply(`❌ Réponds à une vidéo.\nUsage : ${config.prefix}toaudio`);
  }
  await ctx.reply(config.messages.wait);
  try {
    const buffer = await downloadFrom(ctx.sock, info);
    const ext = (info.mimetype.split('/')[1] || 'mp4').split(';')[0];
    const mp3 = await toAudioBuffer(buffer, ext);
    await send(ctx.sock, ctx.from, { audio: mp3, mimetype: 'audio/mpeg' }, { quoted: ctx.msg });
  } catch (e) {
    await ctx.reply(`❌ Conversion impossible : ${e.message}`);
  }
});
};
module.exports.maison = true;
