'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config, title, yts } = env;
cmd(['yt', 'ytsearch'], { cat: 11, desc: 'Rechercher une vidéo YouTube', usage: 'yt <titre>', requiresInput: true }, async (ctx) => {
  if (!ctx.q) return ctx.reply(`❌ Usage : ${config.prefix}yt <titre>`);
  await ctx.react('⏳');
  const r = await yts(ctx.q);
  const list = r?.videos?.slice(0, 5);
  if (!list?.length) return ctx.reply('❌ Aucun résultat trouvé.');
  const lines = list.map((v, i) =>
    `${i + 1}. *${v.title}*\n   ⏱ ${v.timestamp || '?'} · 👤 ${v.author?.name || '?'}\n   ${v.url}`
  );
  await ctx.reply(`🔎 *Résultats pour :* ${ctx.q}\n\n${lines.join('\n\n')}`);
  await ctx.react('✅');
});
};
module.exports.maison = true;
