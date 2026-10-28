'use strict';

module.exports = function enregistrer(env) {
  const { cmd, groupMeta, send } = env;
cmd('hidetag', { cat: 2, desc: 'Mention invisible', usage: 'hidetag [message]', group: true, admin: true }, async (ctx) => {
  const meta = await groupMeta(ctx.sock, ctx.from);
  const ids = meta.participants.map((p) => p.id).filter(Boolean);
  await send(ctx.sock, ctx.from, { text: ctx.q || '👋', mentions: ids }, { quoted: ctx.msg });
});
};
module.exports.maison = true;
