'use strict';

module.exports = function enregistrer(env) {
  const { buildFrame, cmd, config, fmtTs, localDb, noSqlite, note, num, renderInfo, row, shortChat, useSqlite } = env;
cmd('journal', ['events'], {
  cat: 9, desc: 'Journal d’événements (base locale)', icon: '📒',
  usage: 'journal [type] [n] · journal purge [jours]', owner: true,
}, async (ctx) => {
  if (!useSqlite) return ctx.error(noSqlite());
  const a = String(ctx.args?.[0] || '').toLowerCase();
  const b = String(ctx.args?.[1] || '');

  if (a === 'purge') {
    const days = Number(b) || 30;
    const gone = localDb.purgeJournal(days);
    return ctx.success(['JOURNAL PURGÉ', `${gone} ÉVÉNEMENT(S) SUPPRIMÉ`, `RÉTENTION : ${days} JOURS`]);
  }

  const limit = Math.min(100, Number(/^\d+$/.test(a) ? a : b) || 15);
  const type = a && !/^\d+$/.test(a) ? a : '';
  const rows = localDb.recentEvents({ limit, type });

  if (!rows.length) {
    return ctx.reply(renderInfo([
      'JOURNAL VIDE',
      type ? `AUCUN ÉVÉNEMENT DE TYPE « ${type.toUpperCase()} »` : 'AUCUN ÉVÉNEMENT ENREGISTRÉ',
      `TYPES : CMD · PROTECT · JOIN · LEAVE · CONNECT · DISCONNECT`,
    ]));
  }
  const lines = rows.map((r) => row(
    `${fmtTs(r.ts)} · ${r.type.toUpperCase()}`
    + `${r.actor ? ` · +${num(r.actor)}` : ''}`
    + `${r.chat ? ` · ${shortChat(r.chat)}` : ''}`
    + `${r.detail ? `\n   ${r.detail}` : ''}`,
  ));
  await ctx.reply(buildFrame(
    `JOURNAL${type ? ` ${type.toUpperCase()}` : ''}`,
    [...lines, note(`${rows.length} ÉVÉNEMENT(S) · ${config.prefix}JOURNAL [TYPE] [N] · ${config.prefix}JOURNAL PURGE [JOURS]`)],
  ));
});
};
module.exports.maison = true;
