'use strict';

module.exports = function enregistrer(env) {
  const { cmd, config, num, send } = env;
cmd('report', { cat: 10, desc: 'Signaler un problème au owner', usage: 'report <message>' }, async (ctx) => {
  if (!ctx.q) return ctx.reply(`❌ Usage : ${config.prefix}report problème...`);
  const ownerJid = `${config.ownerNumber[0]}@s.whatsapp.net`;
  await send(ctx.sock, ownerJid, {
    text: `📬 *REPORT* de +${num(ctx.sender)} (${ctx.from})\n\n${ctx.q}`,
  });
  await ctx.reply('✅ Signalement envoyé au propriétaire. Merci !');
});
};
module.exports.maison = true;
