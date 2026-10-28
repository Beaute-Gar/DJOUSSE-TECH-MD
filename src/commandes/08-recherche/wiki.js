'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config, title, withNetworkTimeout } = env;
cmd('wiki', { cat: 8, desc: 'Résumé Wikipédia', usage: 'wiki <sujet>' }, async (ctx) => {
  if (!ctx.q) return ctx.reply(`❌ Usage : ${config.prefix}wiki Cameroun`);
  const query = ctx.q.slice(0, 120);
  try {
    const j = await withNetworkTimeout(async (signal) => {
      let res = await fetch(`https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`, { signal });
      if (!res.ok) res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`, { signal });
      if (!res.ok) throw new Error('article introuvable');
      return res.json();
    }, 15000, 'Wikipédia');
    await ctx.reply(`📖 *${j.title}*\n\n${(j.extract || '').slice(0, 1500)}\n\n🔗 ${j.content_urls?.desktop?.page || ''}`);
  } catch (e) {
    await ctx.reply(`❌ Wikipédia : ${e.message}`);
  }
});
};
module.exports.maison = true;
