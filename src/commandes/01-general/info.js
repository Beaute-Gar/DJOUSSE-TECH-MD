'use strict';

module.exports = function enregistrer(env) {
  const { buildFrame, bullet, cmd, config, formatDuration, state, toUnicode } = env;
cmd('info', { cat: 1, desc: 'Informations du bot', icon: 'ℹ️' }, async (ctx) => {
  await ctx.reply(buildFrame('INFO', [
    bullet('NOM', config.botName),
    bullet('VERSION', config.version),
    bullet('PREFIX', `〔${config.prefix}〕`),
    bullet('OWNER', `${config.botOwnerName} (+${config.ownerNumber[0]})`),
    bullet('NODE', process.version),
    bullet('UPTIME', formatDuration(process.uptime() * 1000)),
    bullet('MODE', state.settings.selfMode ? toUnicode('SELF') : toUnicode('PUBLIC')),
  ]));
});
};
module.exports.maison = true;
