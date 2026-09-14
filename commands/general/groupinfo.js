module.exports = {
  name: 'groupinfo',
  aliases: ['groupinfo', 'gi'],
  category: 'general',
  desc: 'Affiche les infos du groupe',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: true,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    if (!ctx.isGroup) {
      return await ctx.reply('C est une commande de groupe ça.');
    }
    try {
      await ctx.react('ℹ️');
      const meta = ctx.groupMetadata;
      const creation = meta.creation ? new Date(meta.creation * 1000).toLocaleDateString('fr-FR') : 'Inconnue';
      let text = `*Infos du groupe*\n\n`;
      text += `Nom: ${meta.subject}\n`;
      text += `Description: ${meta.desc || 'Aucune'}\n`;
      text += `Membres: ${meta.participants.length}\n`;
      text += `Créé le: ${creation}\n`;
      text += `Owner: ${meta.owner ? '@' + meta.owner.split('@')[0] : 'Inconnu'}`;
      await ctx.reply(text);
    } catch (e) {
      await ctx.reply('Oups, j\'ai pas pu récupérer les infos du groupe.');
    }
  }
};
