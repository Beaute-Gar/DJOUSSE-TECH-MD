'use strict';

module.exports = function enregistrer(env) {
  const { blank, buildFrame, cmd, groupMeta, row } = env;
cmd('groupinfo', ['ginfo'], { cat: 2, desc: 'Infos du groupe', group: true }, async (ctx) => {
  const meta = await groupMeta(ctx.sock, ctx.from);
  if (!meta) return ctx.reply('❌ Groupe introuvable.');
  const admins = meta.participants.filter((p) => p.admin).length;
  await ctx.reply(
    buildFrame('GROUP INFO', [
      row(`*${meta.subject || 'Groupe'}*`),
      blank(),
      row(`ID : ${meta.id}`),
      row(`Membres : ${meta.participants.length}`),
      row(`Admins : ${admins}`),
      row(`Créé : ${meta.creation ? new Date(meta.creation * 1000).toLocaleDateString('fr-FR') : '?'}`),
    ])
  );
});
};
module.exports.maison = true;
