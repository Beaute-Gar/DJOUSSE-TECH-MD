'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config, downloadVV, mediaInfo, send } = env;
cmd('viewonce', ['vo'], {
  cat: 4, desc: 'Renvoyer un média en vue unique',
  usage: 'viewonce (réponds à une image/vidéo)', icon: '👁️',
}, async (ctx) => {
  const info = mediaInfo(ctx.msg);
  if (!info || !['imageMessage', 'videoMessage'].includes(info.type)) {
    return ctx.reply(`❌ Réponds à une image ou une vidéo.\nUsage : ${config.prefix}viewonce`);
  }
  await ctx.reply(config.messages.wait);
  try {
    const result = await downloadVV(ctx.sock, info);
    const payload = info.type === 'videoMessage'
      ? { video: result.buffer, viewOnce: true }
      : { image: result.buffer, viewOnce: true };
    await send(ctx.sock, ctx.from, payload, { quoted: ctx.msg });
  } catch (e) {
    await ctx.reply(`❌ Envoi impossible : ${e.message}`);
  }
});
};
module.exports.maison = true;
