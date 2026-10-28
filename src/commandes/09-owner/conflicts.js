'use strict';

module.exports = function enregistrer(env) {
  const { cmd, conflict, shortChat } = env;
cmd('conflicts', ['conflit'], {
  cat: 9, desc: 'Lister les chats en pause (conflit bot↔bot)',
  usage: 'conflicts', owner: true, icon: '⛔',
}, async (ctx) => {
  const liste = conflict.status();
  if (!liste.length) return ctx.success(['AUCUN CONFLIT', 'ZÉRO CHAT EN PAUSE']);
  return ctx.success(['CHATS EN PAUSE', ...liste.map((c) => `⛔ ${shortChat(c.chat)} — ${c.reason}`)]);
});
};
module.exports.maison = true;
