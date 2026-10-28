'use strict';

module.exports = function enregistrer(env) {
  const { buildFrame, cmd, config, ctxInfo, fmtTs, localDb, noSqlite, note, num, renderInfo, row, shortChat, useSqlite } = env;
cmd('chatlog', ['msgs'], {
  cat: 9, desc: 'Historique des messages (base locale)', icon: '💬',
  usage: 'chatlog [n] [@mention] [ici]', owner: true,
}, async (ctx) => {
  if (!useSqlite) return ctx.error(noSqlite());
  const ci = ctxInfo(ctx.content);
  const mention = ci?.mentionedJid?.[0];
  const nums = (ctx.args || []).filter((x) => /^\d+$/.test(x)).map(Number);
  const here = (ctx.args || []).some((x) => ['ici', 'here'].includes(String(x).toLowerCase()));
  const limit = Math.min(500, nums[0] || 20);
  const senderFilter = mention ? num(mention) : (nums[1] ? String(nums[1]) : '');

  const rows = localDb.recentMessages({
    limit,
    chat: here ? ctx.from : '',
    sender: senderFilter,
  });
  if (!rows.length) {
    return ctx.reply(renderInfo(['AUCUN MESSAGE', here ? 'DANS CE CHAT' : '', senderFilter ? `POUR +${senderFilter}` : ''].filter(Boolean)));
  }
  const lines = rows.map((r) => row(
    `${fmtTs(r.ts)} · ${shortChat(r.chat)} · +${num(r.sender)}${r.cmd ? ` ▸ ${r.cmd}` : ''}`
    + `${r.text ? `\n   ${String(r.text).slice(0, 160)}` : `   [${(r.kind || 'media').toUpperCase()} ${r.len || 0}]`}`,
  ));
  await ctx.reply(buildFrame('CHATLOG', [
    ...lines,
    note(`${rows.length} MESSAGE(S) · ${config.prefix}CHATLOG [N] [@USER] [ICI]`),
  ]));
});
};
module.exports.maison = true;
