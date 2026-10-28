'use strict';

module.exports = function enregistrer(env) {
  const { cmd } = env;
cmd('mutechat', ['mutec'], {
  cat: 9, desc: 'Mettre le chat en sourdine (8h)', usage: 'mutechat [heures]', owner: true, icon: '🔇',
}, async (ctx) => {
  const hours = Math.min(168, Math.max(1, parseInt(ctx.args[0] || '8', 10) || 8));
  const muteEnd = Math.floor(Date.now() / 1000) + hours * 3600;
  try {
    await ctx.sock.chatModify({ mute: muteEnd }, ctx.from);
    await ctx.success([`CHAT EN SOURDINE ${hours}H`]);
  } catch (e) {
    await ctx.reply(`❌ Mute chat impossible : ${e.message}`);
  }
});
};
module.exports.maison = true;
