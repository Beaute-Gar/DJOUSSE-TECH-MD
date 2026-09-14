const fetch = require('node-fetch');

module.exports = {
  name: 'github',
  aliases: ['github', 'gh'],
  category: 'general',
  desc: 'Info sur un repo GitHub',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    const repo = args[0];
    if (!repo) {
      return await ctx.reply('Envoie le nom d\'un repo.\nEx: .github Beaute-Gar/DJOUSSE-TECH-MD');
    }
    try {
      await ctx.react('💻');
      const res = await fetch(`https://api.github.com/repos/${repo}`);
      const data = await res.json();
      if (data.message === 'Not Found') {
        return await ctx.reply('Repo introuvable. Vérifie le nom.');
      }
      let text = `*${data.full_name}*\n\n`;
      text += `Description: ${data.description || 'Aucune'}\n`;
      text += `Stars: ${data.stargazers_count}\n`;
      text += `Forks: ${data.forks_count}\n`;
      text += `Langage: ${data.language || 'Inconnu'}\n`;
      text += `Créé le: ${new Date(data.created_at).toLocaleDateString('fr-FR')}\n`;
      text += `Lien: ${data.html_url}`;
      await ctx.reply(text);
    } catch (e) {
      await ctx.reply('Oups, j\'ai pas récupéré les infos.');
    }
  }
};
