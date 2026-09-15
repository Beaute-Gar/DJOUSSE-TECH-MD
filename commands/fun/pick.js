const { cmd } = require('../command.cjs');

cmd({
  pattern: 'pick',
  alias: ['choisir', 'random'],
  desc: 'Randomly pick one item',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, config) => {
  if (args.length < 2) return m.reply('🤖 [SYSTEM] Usage: .pick <item1> <item2> ...\n\nExemple: .pick chat chien poisson');

  const items = args;
  const picked = items[Math.floor(Math.random() * items.length)];
  const index = items.indexOf(picked) + 1;

  const text = `🎲 [ROBOT] CHOIX ALÉATOIRE!\n\nOptions: ${items.join(', ')}\n🎯 Sélectionné: ${picked} (option ${index}/${items.length})\n\n⚡ [ROBOT] Algorithme de sélection exécuté.`;
  await m.reply(text);
});
