const config = require('../../config');

module.exports = {
  name: 'newsletter',
  aliases: ['newsletter', 'ch'],
  category: 'owner',
  desc: 'Gère le newsletter',
  ownerOnly: true,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    if (!args.length) {
      ctx.reply(`Newsletter actuel : ${config.newsletterJid || 'Aucun'}\n\nUtilise .newsletter <action> <jid>`);
      return;
    }

    const action = args[0].toLowerCase();
    const jid = args[1];

    if (action === 'set') {
      if (!jid) return ctx.reply('Écris le JID du newsletter.');
      config.newsletterJid = jid;
      await ctx.react('✅');
      ctx.reply(`Newsletter mis à jour : ${jid}`);
    } else if (action === 'remove') {
      config.newsletterJid = '';
      await ctx.react('✅');
      ctx.reply('Newsletter supprimé.');
    } else if (action === 'follow') {
      if (!config.newsletterJid) return ctx.reply('Aucun newsletter configuré.');
      try {
        await sock.newsletterFollow(config.newsletterJid);
        await ctx.react('✅');
        ctx.reply('Newsletter suivi avec succès !');
      } catch (e) {
        ctx.reply('Erreur lors du follow...');
      }
    } else {
      ctx.reply('Actions disponibles: set, remove, follow');
    }
  }
};
