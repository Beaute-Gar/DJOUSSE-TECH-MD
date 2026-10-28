'use strict';

module.exports = function enregistrer(env) {
  const { Sticker, StickerTypes, cmd, config, downloadFrom, mediaInfo, send } = env;
cmd('sticker', ['s'], { cat: 4, desc: 'Image/vidéo → sticker', usage: 'sticker (réponds à une image)' }, async (ctx) => {
  const info = mediaInfo(ctx.msg);
  if (!info) return ctx.reply(`❌ Réponds à une image ou une vidéo.\nUsage : ${config.prefix}sticker`);
  if (!['imageMessage', 'videoMessage', 'stickerMessage'].includes(info.type)) {
    return ctx.reply('❌ Seules les images et vidéos sont acceptées.');
  }
  await ctx.reply(config.messages.wait);
  try {
    const buffer = await downloadFrom(ctx.sock, info);
    const sticker = new Sticker(buffer, {
      pack: config.packname,
      author: config.author,
      type: StickerTypes.FULL,
      quality: 75,
    });
    await send(ctx.sock, ctx.from, { sticker: await sticker.toBuffer() }, { quoted: ctx.msg });
  } catch (e) {
    await ctx.reply(`❌ Sticker impossible : ${e.message}`);
  }
});
};
module.exports.maison = true;
