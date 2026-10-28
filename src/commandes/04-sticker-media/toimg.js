'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config, downloadFrom, mediaInfo, send, sharp } = env;
cmd('toimg', { cat: 4, desc: 'Sticker → image', usage: 'toimg (réponds à un sticker)' }, async (ctx) => {
  const info = mediaInfo(ctx.msg);
  if (!info || info.type !== 'stickerMessage') return ctx.reply(`❌ Réponds à un sticker.\nUsage : ${config.prefix}toimg`);
  try {
    const buffer = await downloadFrom(ctx.sock, info);
    const png = await sharp(buffer).png().toBuffer();
    await send(ctx.sock, ctx.from, { image: png, caption: '🖼️' }, { quoted: ctx.msg });
  } catch (e) {
    await ctx.reply(`❌ Conversion impossible : ${e.message}`);
  }
});
};
module.exports.maison = true;
