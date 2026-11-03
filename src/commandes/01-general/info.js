'use strict';

const deadCommands = require('../../config/disabled-commands');

module.exports = function enregistrer(env) {
  const { buildFrame, bullet, cmd, config, formatDuration, state, toUnicode } = env;
cmd('info', { cat: 1, desc: 'Informations du bot', icon: 'ℹ️' }, async (ctx) => {
  await ctx.reply(buildFrame('INFO', [
    bullet('NOM', config.botName),
    bullet('VERSION', config.build.label),
    bullet('BUILD', config.build.dateLabel),
    bullet('COMMIT', config.build.shortRevision || 'local'),
    bullet('PREFIX', `〔${config.prefix}〕`),
    bullet('OWNER', `${config.botOwnerName} (+${config.ownerNumber[0]})`),
    bullet('NODE', process.version),
    bullet('UPTIME', formatDuration(process.uptime() * 1000)),
    bullet('RETRAITS', deadCommands.filterActive()
      ? `${env.removedCount} ${toUnicode('COMMANDES FILTRÉES')}`
      : `${deadCommands.deadCount} ${toUnicode('RÉACTIVÉES · FILTRE OFF')}`),
    bullet('MODE', state.settings.selfMode ? toUnicode('SELF') : toUnicode('PUBLIC')),
  ]));
});
};
module.exports.maison = true;
