'use strict';

module.exports = function enregistrer(env) {
  const { autoStatus, cmd, config, saveState, state } = env;
cmd('autolike', ['autoreact'], { cat: 9, desc: 'Réaction automatique aux statuts', usage: 'autolike on|off', owner: true }, async (ctx) => {
  const arg = (ctx.args[0] || '').toLowerCase();
  if (arg !== 'on' && arg !== 'off') {
    const on = autoStatus.effective(state.settings.autoStatus || {}).react;
    return ctx.reply(`👍 *Réaction auto aux statuts* : ${on ? 'ON ✅' : 'OFF ❌'}\nUsage : ${config.prefix}autolike on|off`);
  }
  state.settings.autoStatus = { ...(state.settings.autoStatus || {}), react: arg === 'on' };
  saveState(true);
  await ctx.reply(arg === 'on'
    ? '👍 Réaction auto aux statuts : *ON ✅* — emoji tiré au sort à chaque statut.'
    : '👍 Réaction auto aux statuts : *OFF ❌*.');
});
};
module.exports.maison = true;
