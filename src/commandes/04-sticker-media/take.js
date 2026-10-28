'use strict';

module.exports = function enregistrer(env) {
  const { Sticker, StickerTypes, cmd, config, downloadFrom, mediaInfo, send } = env;
cmd('take', { cat: 4, desc: 'Re-sticker avec ton pack', usage: 'take [pack|author]' }, async (ctx) => {
  const info = mediaInfo(ctx.msg);
  if (!info || info.type !== 'stickerMessage') return ctx.reply(`❌ Réponds à un sticker.\nUsage : ${config.prefix}take MonPack|moi`);
  try {
    const [pack, author] = (ctx.q || '').split('|').map((s) => (s || '').trim());
    const buffer = await downloadFrom(ctx.sock, info);
    const sticker = new Sticker(buffer, {
      pack: pack || config.packname,
      author: author || config.author,
      type: StickerTypes.FULL,
      quality: 75,
    });
    await send(ctx.sock, ctx.from, { sticker: await sticker.toBuffer() }, { quoted: ctx.msg });
  } catch (e) {
    await ctx.reply(`❌ Échec : ${e.message}`);
  }
});
};
module.exports.maison = true;
