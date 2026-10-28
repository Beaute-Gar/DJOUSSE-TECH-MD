'use strict';

module.exports = function enregistrer(env) {
  const { autoStatus, cmd, config, saveState, state } = env;
cmd('autoview', { cat: 9, desc: 'Vue automatique des statuts', usage: 'autoview on|off', owner: true }, async (ctx) => {
  const arg = (ctx.args[0] || '').toLowerCase();
  if (arg !== 'on' && arg !== 'off') {
    const on = autoStatus.effective(state.settings.autoStatus || {}).seen;
    return ctx.reply(`👁️ *Vue auto des statuts* : ${on ? 'ON ✅' : 'OFF ❌'}\nUsage : ${config.prefix}autoview on|off`);
  }
  state.settings.autoStatus = { ...(state.settings.autoStatus || {}), seen: arg === 'on' };
  saveState(true);
  await ctx.reply(arg === 'on'
    ? '👁️ Vue auto des statuts : *ON ✅* — chaque statut reçu est marqué comme vu.'
    : '👁️ Vue auto des statuts : *OFF ❌*.');
});
};
module.exports.maison = true;
