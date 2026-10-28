'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config, withNetworkTimeout } = env;
cmd('github', { cat: 8, desc: 'Profil GitHub', usage: 'github <utilisateur>' }, async (ctx) => {
  if (!ctx.q) return ctx.reply(`❌ Usage : ${config.prefix}github Beaute-Gar`);
  try {
    const j = await withNetworkTimeout(async (signal) => {
      const res = await fetch(`https://api.github.com/users/${encodeURIComponent(ctx.args[0])}`, { signal });
      if (!res.ok) throw new Error('utilisateur introuvable');
      return res.json();
    }, 15000, 'GitHub');
    await ctx.reply(
      `🐙 *@${j.login}*\n` +
      `Nom : ${j.name || '—'}\n` +
      `Bio : ${j.bio || '—'}\n` +
      `Repos : ${j.public_repos} · Followers : ${j.followers}\n` +
      `📍 ${j.location || '—'}\n` +
      `🔗 ${j.html_url}`
    );
  } catch (e) {
    await ctx.reply(`❌ GitHub : ${e.message}`);
  }
});
};
module.exports.maison = true;
