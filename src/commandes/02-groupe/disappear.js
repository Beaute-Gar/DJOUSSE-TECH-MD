'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config, parseEphemeral, send } = env;
cmd('disappear', ['ephemeral'], {
  cat: 2, desc: 'Messages éphémères du chat', usage: 'disappear off|24h|7d|90d',
  group: true, admin: true, botAdmin: true, icon: '⏱️',
}, async (ctx) => {
  const arg = (ctx.args[0] || '').toLowerCase();
  const seconds = parseEphemeral(arg);
  if (seconds === null) {
    return ctx.reply(`❌ Usage : ${config.prefix}disappear off|24h|7d|90d`);
  }
  try {
    await send(ctx.sock, ctx.from, { disappearingMessagesInChat: seconds });
    await ctx.success([
      seconds === 0 ? 'MESSAGES ÉPHÉMÈRES DÉSACTIVÉS' : `MESSAGES ÉPHÉMÈRES : ${arg.toUpperCase()}`,
    ]);
  } catch (e) {
    await ctx.reply(`❌ Éphémère impossible : ${e.message}`);
  }
});
};
module.exports.maison = true;
