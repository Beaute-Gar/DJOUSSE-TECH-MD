'use strict';

module.exports = function enregistrer(env) {
  const { cmd, commands, formatDuration, state } = env;
cmd('stats', { cat: 10, desc: 'Statistiques du bot' }, async (ctx) => {
  const s = state.stats;
  await ctx.reply(
    `📈 *STATISTIQUES*\n\n` +
    `Messages reçus : ${s.messages}\n` +
    `Commandes exécutées : ${s.commands}\n` +
    `Uptime : ${formatDuration(process.uptime() * 1000)}\n` +
    `Groupes suivis : ${Object.keys(state.groups).length}\n` +
    `Depuis : ${new Date(s.since).toLocaleDateString('fr-FR')}`
  );
});
};
module.exports.maison = true;
