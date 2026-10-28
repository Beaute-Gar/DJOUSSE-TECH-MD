'use strict';

module.exports = function enregistrer(env) {
  const { autoStatus, buildFrame, bullet, cmd, config, state } = env;
cmd('autostatus', ['statusconfig'], { cat: 9, desc: 'Panneau Auto-Status (vue · réaction · réponse)', owner: true }, async (ctx) => {
  const o = state.settings.autoStatus || {};
  const eff = autoStatus.effective(o);
  const src = (key, envVal) => (o[key] !== undefined ? 'commande 📱' : `.env (${envVal ? 'on' : 'off'}) 📄`);
  const mark = (v) => (v ? 'ON ✅' : 'OFF ❌');
  await ctx.reply(buildFrame('AUTO-STATUS', [
    bullet('VUE', `${mark(eff.seen)} — ${src('seen', config.autoStatusSeen)}`),
    bullet('RÉACTION', `${mark(eff.react)} — ${src('react', config.autoStatusReact)}`),
    bullet('RÉPONSE', `${mark(eff.reply)} — ${src('reply', config.autoStatusReply)}`),
    bullet('EMOJIS', (config.statusEmojis || []).map((e) => e.trim()).filter(Boolean).join(' ') || '👍'),
    bullet('MSG RÉPONSE', config.autoStatusMsg || '(aucun)'),
    `Commandes : ${config.prefix}autoview on|off · ${config.prefix}autolike on|off`,
  ]));
});
};
module.exports.maison = true;
