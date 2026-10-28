'use strict';

module.exports = function enregistrer(env) {
  const { cmd, getCache } = env;
cmd('archive', {
  cat: 9, desc: 'Archiver / désarchiver le chat', usage: 'archive [on|off]', owner: true, icon: '📦',
}, async (ctx) => {
  const on = !/^(off|0|false|no)$/i.test(ctx.args[0] || 'on');
  try {
    // lastMessages requis par Baileys pour archive
    const last = getCache(ctx.from, ctx.msg.key.id);
    const lastMessages = last?.msg ? [{ key: last.msg.key, messageTimestamp: last.msg.messageTimestamp }] : [];
    await ctx.sock.chatModify({ archive: on, lastMessages }, ctx.from);
    await ctx.success([on ? 'CHAT ARCHIVÉ' : 'CHAT DÉSARCHIVÉ']);
  } catch (e) {
    await ctx.reply(`❌ Archive impossible : ${e.message}`);
  }
});
};
module.exports.maison = true;
