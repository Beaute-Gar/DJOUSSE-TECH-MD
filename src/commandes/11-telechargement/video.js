'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config, formatDuration, send, title, ytDownloadVideo, ytFail, ytResolve } = env;
cmd(['video', 'ytmp4'], { cat: 11, desc: 'Télécharger une vidéo YouTube', usage: 'video <titre ou lien>', requiresInput: true }, async (ctx) => {
  if (!ctx.q) return ctx.reply(`❌ Usage : ${config.prefix}video <titre ou lien YouTube>`);
  await ctx.react('⏳');
  await ctx.reply(`${config.messages.wait}\n🎬 Recherche de *${ctx.q}*...`);
  let meta;
  try {
    meta = await ytResolve(ctx.q);
  } catch (e) {
    await ctx.react('❌');
    return ctx.reply(ytFail(e));
  }
  if (!meta) return ctx.reply('❌ Aucune vidéo trouvée. Précise le titre.');
  if (meta.seconds > 20 * 60) return ctx.reply(`❌ Durée trop longue (${formatDuration(meta.seconds * 1000)}) — limite 20 min.`);
  try {
    const buf = await ytDownloadVideo(meta.url);
    await send(ctx.sock, ctx.from, {
      video: buf,
      mimetype: 'video/mp4',
      caption: `🎬 *${meta.title}*\n👤 ${meta.author}\n⏱ ${formatDuration(meta.seconds * 1000)} · ${(buf.length / 1048576).toFixed(1)} Mo`,
      fileName: `${meta.title.replace(/[^\w\s.-]/g, '').trim().slice(0, 60) || 'video'}.mp4`,
    }, { quoted: ctx.msg });
    await ctx.react('✅');
  } catch (e) {
    await ctx.react('❌');
    console.error('[DL video]', e.message);
    await ctx.reply(ytFail(e));
  }
});
};
module.exports.maison = true;
