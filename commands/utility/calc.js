module.exports = {
  name: 'calc',
  aliases: ['calc', 'calculator'],
  category: 'utility',
  desc: 'Calculatrice',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,
  botAdminNeeded: false,
  modOnly: false,
  privateOnly: false,
  execute: async (sock, msg, args, ctx) => {
    if (!args.length) return ctx.reply('Écris une expression mathématique.\nExemple: .calc 2 + 2');
    const expr = args.join(' ');
    try {
      const sanitized = expr.replace(/[^0-9+\-*/().%]/g, '');
      if (!sanitized) return ctx.reply('Expression invalide.');
      const result = Function(`"use strict"; return (${sanitized})`)();
      if (typeof result !== 'number' || isNaN(result)) return ctx.reply('Résultat invalide.');
      await ctx.react('🔢');
      ctx.reply(`${expr} = ${result}`);
    } catch (e) {
      ctx.reply('Erreur dans le calcul...');
    }
  }
};
