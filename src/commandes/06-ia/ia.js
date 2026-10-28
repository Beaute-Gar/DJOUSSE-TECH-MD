'use strict';

module.exports = function enregistrer(env) {
  const { cmd, commands } = env;
cmd('ia', {
  cat: 6, desc: 'Assistant IA — commandes, contenu, recherche web', usage: 'ia <question>', icon: '🤖',
}, async (ctx) => {
  const entry = commands.get('djousse') || commands.get('silva');
  if (!entry || typeof entry.handler !== 'function') {
    return ctx.error(['ASSISTANT INDISPONIBLE', 'REDEMARRE LE BOT']);
  }
  return entry.handler(ctx);
});
};
module.exports.maison = true;
