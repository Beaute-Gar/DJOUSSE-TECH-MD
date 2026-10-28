'use strict';

module.exports = function enregistrer(env) {
  const { cmd, saveState, state } = env;
cmd('self', { cat: 9, desc: 'Mode owner uniquement', owner: true }, async (ctx) => {
  state.settings.selfMode = true;
  saveState(true);
  await ctx.reply('🔒 Mode *SELF* activé : seul le propriétaire peut utiliser les commandes.');
});
};
module.exports.maison = true;
