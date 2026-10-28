'use strict';

module.exports = function enregistrer(env) {
  const { CATEGORIES, buildFrame, bullet, catBox, cmd, config, frameFooter, numItem, signature, state, title, toUnicode, visibleCommands } = env;
cmd('list', { cat: 1, desc: 'Toutes les commandes', icon: '📜' }, async (ctx) => {
  /* En-tête façon `.info` : BOT / PREFIX / TOTAL / MODE */
  const cats = CATEGORIES
    .map((c) => ({ ...c, list: visibleCommands(c.n, ctx) }))
    .filter((c) => c.list.length > 0);
  const total = cats.reduce((n, c) => n + c.list.length, 0);

  const header = buildFrame('ALL COMMANDS', [
    bullet('BOT', config.botName),
    bullet('PREFIX', `〔${config.prefix}〕`),
    bullet('TOTAL', `${total} ${toUnicode('COMMANDES')}`),
    bullet('MODE', state.settings.selfMode ? toUnicode('SELF') : toUnicode('PUBLIC')),
    title(toUnicode('REPLY WITH A NUMBER TO OPEN')),
  ]);

  /* Corps : une catégorie = un cadre ┏━┓, chaque commande numérotée ┊ 01 ⟩ */
  const blocks = [];
  for (const c of cats) {
    blocks.push(catBox(c.emoji, c.label, c.list.length));
    blocks.push(c.list.map((cmd, i) => numItem(i + 1, cmd.name)).join('\n'));
    blocks.push('');
  }

  await ctx.reply(
    `${header}\n\n${blocks.join('\n').trimEnd()}\n\n${frameFooter()}\n\n${signature()}`
  );
});
};
module.exports.maison = true;
