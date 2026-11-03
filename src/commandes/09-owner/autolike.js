'use strict';

module.exports = function enregistrer(env) {
  const { autoStatus, cmd, config, saveState, state } = env;
cmd('autolike', ['autoreact'], { cat: 9, desc: 'Réaction automatique aux statuts', usage: 'autolike on|off | autolike emojis 🔥,💯,😍', owner: true }, async (ctx) => {
  const arg = (ctx.args[0] || '').toLowerCase();
  const o = state.settings.autoStatus || {};

  /* Personnalisation des emojis : .autolike emojis 🔥,💯,😍
     Le cœur vert 💚 est toujours refusé (c'est le « like » par défaut). */
  if (arg === 'emojis' || arg === 'emoji') {
    const list = autoStatus.cleanEmojiList(ctx.args.slice(1).join(' '));
    if (!list.length) {
      return ctx.reply(`❌ Aucun emoji valide.\nExemple : ${config.prefix}autolike emojis 🔥,💯,😍,👏`);
    }
    state.settings.autoStatus = { ...o, emojis: list };
    saveState(true);
    return ctx.reply(`✅ Emojis de réaction enregistrés : ${list.join(' ')}\nIls seront tirés au sort à chaque statut.`);
  }

  if (arg !== 'on' && arg !== 'off') {
    const on = autoStatus.effective(o).react;
    const emojis = autoStatus.listEmojis(o);
    return ctx.reply(
      `👍 *Réaction auto aux statuts* : ${on ? 'ON ✅' : 'OFF ❌'}\n`
      + `Emojis : ${emojis.join(' ')}\n`
      + `Usage : ${config.prefix}autolike on|off\n`
      + `        ${config.prefix}autolike emojis 🔥,💯,😍`,
    );
  }

  state.settings.autoStatus = { ...o, react: arg === 'on' };
  saveState(true);
  await ctx.reply(arg === 'on'
    ? `👍 Réaction auto aux statuts : *ON ✅* — emoji tiré au sort : ${autoStatus.listEmojis(o).join(' ')}`
    : '👍 Réaction auto aux statuts : *OFF ❌*.');
});
};
module.exports.maison = true;
