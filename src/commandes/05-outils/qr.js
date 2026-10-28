'use strict';

module.exports = function enregistrer(env) {
  const { QRCode, cmd, config, send } = env;
cmd('qr', { cat: 5, desc: 'Générer un QR code', usage: 'qr <texte>' }, async (ctx) => {
  if (!ctx.q) return ctx.reply(`❌ Usage : ${config.prefix}qr https://...`);
  try {
    const png = await QRCode.toBuffer(ctx.q.slice(0, 800), { type: 'png', margin: 1, width: 500 });
    await send(ctx.sock, ctx.from, { image: png, caption: `🔲 QR : ${ctx.q.slice(0, 100)}` }, { quoted: ctx.msg });
  } catch (e) {
    await ctx.reply(`❌ QR impossible : ${e.message}`);
  }
});
};
module.exports.maison = true;
