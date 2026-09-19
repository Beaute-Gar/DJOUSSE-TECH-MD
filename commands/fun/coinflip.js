const { cmd } = require('../command.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'coinflip',
  alias: ['cf', 'pile'],
  desc: 'Flip a coin',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, config) => {
  const result = Math.random() > 0.5 ? '🪙 PILE (Heads)' : '🪙 FACE (Tails)';
  const emoji = result.includes('PILE') ? '👑' : '🦅';

  const text = boxWithFooter('🪙 LANCEMENT DE PIÈCE', [
    { label: 'Résultat', value: `${result} ${emoji}` },
  ]);
  await m.reply(text);
});
