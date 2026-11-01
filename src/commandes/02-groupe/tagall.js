'use strict';

module.exports = function enregistrer(env) {
  const { cmd, groupMeta, num, send } = env;
cmd('tagall', ['all'], { cat: 2, desc: 'Mentionner tout le groupe', usage: 'tagall [message]', group: true, admin: true }, async (ctx) => {
  const meta = await groupMeta(ctx.sock, ctx.from);
  const ids = meta.participants.map((p) => p.id).filter(Boolean);
  const mentions = meta.participants.map((p) => p.phoneNumber || p.id).filter(Boolean);
  const text = `${ctx.q ? ctx.q + '\n\n' : ''}${mentions.map((j) => `@${num(j)}`).join(' ')}`;
  await send(ctx.sock, ctx.from, { text, mentions: ids }, { quoted: ctx.msg });
});
};
module.exports.maison = true;
