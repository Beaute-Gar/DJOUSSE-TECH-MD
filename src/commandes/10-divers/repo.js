'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config, withNetworkTimeout } = env;
cmd(['repo', 'repository'], {
  cat: 10, desc: 'Dépôt officiel — étoiles, forks, dernière MAJ', usage: 'repo', icon: '📦',
}, async (ctx) => {
  try {
    const j = await withNetworkTimeout(async (signal) => {
      const res = await fetch('https://api.github.com/repos/Beaute-Gar/DJOUSSE-TECH-MD', { signal });
      if (!res.ok) throw new Error(`GitHub HTTP ${res.status}`);
      return res.json();
    }, 15000, 'Dépôt GitHub');
    const maj = j.pushed_at ? new Date(j.pushed_at).toLocaleString('fr-FR', { timeZone: 'Africa/Douala' }) : '—';
    await ctx.reply(
      `📦 *${j.full_name}*\n` +
      `📝 ${j.description || '—'}\n` +
      `⭐ ${j.stargazers_count} · 🍴 ${j.forks_count} · 🐛 ${j.open_issues_count} ouverts\n` +
      `🧩 ${j.language || 'JavaScript'} · 📄 ${j.license?.spdx_id || 'MIT'} · ${(Number(j.size || 0) / 1024).toFixed(1)} Mo\n` +
      `🕒 Dernier push : ${maj}\n\n` +
      `🔗 ${j.html_url}\n` +
      `🌐 ${config.social.website}\n\n` +
      `_${config.slogan}_`
    );
  } catch (e) {
    await ctx.reply(`❌ GitHub : ${e.message}`);
  }
});
};
module.exports.maison = true;
