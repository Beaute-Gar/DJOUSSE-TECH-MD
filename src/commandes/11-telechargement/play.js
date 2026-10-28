'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config, formatDuration, send, title, ytDownloadAudio, ytFail, ytResolve } = env;
cmd(['play', 'mp3'], { cat: 11, desc: 'Télécharger une musique en MP3', usage: 'play <titre ou lien>', requiresInput: true }, async (ctx) => {
  if (!ctx.q) return ctx.reply(`❌ Usage : ${config.prefix}play <titre ou lien YouTube>`);
  await ctx.react('⏳');
  await ctx.reply(`${config.messages.wait}\n🎵 Recherche de *${ctx.q}*...`);
  let meta;
  try {
    meta = await ytResolve(ctx.q);
  } catch (e) {
    await ctx.react('❌');
    return ctx.reply(ytFail(e));
  }
  if (!meta) return ctx.reply('❌ Aucune vidéo trouvée. Précise le titre.');
  if (meta.seconds > 15 * 60) return ctx.reply(`❌ Durée trop longue (${formatDuration(meta.seconds * 1000)}) — limite 15 min.`);
  try {
    const audio = await ytDownloadAudio(meta.url);
    await send(ctx.sock, ctx.from, {
      audio,
      mimetype: 'audio/mpeg',
      ptt: false,
      fileName: `${meta.title.replace(/[^\w\s.-]/g, '').trim().slice(0, 60) || 'audio'}.mp3`,
    }, { quoted: ctx.msg });
    await ctx.reply(`🎵 *${meta.title}*\n👤 ${meta.author}\n⏱ ${formatDuration(meta.seconds * 1000)}`);
    await ctx.react('✅');
  } catch (e) {
    await ctx.react('❌');
    console.error('[DL play]', e.message);
    await ctx.reply(ytFail(e));
  }
});
};
module.exports.maison = true;
