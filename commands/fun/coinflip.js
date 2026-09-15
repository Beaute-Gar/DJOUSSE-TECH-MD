const { cmd } = require('../command.cjs');

cmd({
  pattern: 'coinflip',
  alias: ['cf', 'pile'],
  desc: 'Flip a coin',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, config) => {
  const result = Math.random() > 0.5 ? '🪙 PILE (Heads)' : '🪙 FACE (Tails)';
  const emoji = result.includes('PILE') ? '👑' : '🦅';

  const text = `🪙 [ROBOT] LANCEMENT DE PIÈCE!\n\nRésultat : ${result} ${emoji}\n\n⚡ [ROBOT] Probabilité exacte : 50/50.`;
  await m.reply(text);
});
