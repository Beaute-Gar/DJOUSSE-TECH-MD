'use strict';

module.exports = function enregistrer(env) {
  const { cmd, saveState, state } = env;
cmd('public', { cat: 9, desc: 'Mode tout le monde', owner: true }, async (ctx) => {
  state.settings.selfMode = false;
  saveState(true);
  await ctx.reply('🌐 Mode *PUBLIC* activé : tout le monde peut utiliser les commandes.');
});
};
module.exports.maison = true;
