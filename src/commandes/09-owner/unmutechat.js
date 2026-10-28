'use strict';

module.exports = function enregistrer(env) {
  const { cmd } = env;
cmd('unmutechat', ['unmutec'], {
  cat: 9, desc: 'Retirer la sourdine du chat', owner: true, icon: '🔊',
}, async (ctx) => {
  try {
    await ctx.sock.chatModify({ mute: null }, ctx.from);
    await ctx.success(['SOURDINE RETIRÉE']);
  } catch (e) {
    await ctx.reply(`❌ Unmute chat impossible : ${e.message}`);
  }
});
};
module.exports.maison = true;
