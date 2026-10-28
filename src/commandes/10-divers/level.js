'use strict';

module.exports = function enregistrer(env) {
  const { cmd, ctxInfo, getUser, num } = env;
cmd('level', { cat: 10, desc: 'Niveau et expérience', usage: 'level [@user]' }, async (ctx) => {
  const ci = ctxInfo(ctx.content);
  const who = ci?.mentionedJid?.length ? num(ci.mentionedJid[0]) : num(ctx.sender);
  const u = getUser(who);
  const level = Math.floor((u.xp || 0) / 100);
  const progress = (u.xp || 0) % 100;
  const bar = '█'.repeat(Math.floor(progress / 10)) + '░'.repeat(10 - Math.floor(progress / 10));
  await ctx.reply(
    `📊 *Niveau de +${who}*\n\n` +
    `Niveau : *${level}*\n` +
    `XP : ${u.xp || 0}\n` +
    `[${bar}] ${progress}%`
  );
});
};
module.exports.maison = true;
