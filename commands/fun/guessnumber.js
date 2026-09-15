const { cmd } = require('../command.cjs');

const games = new Map();

cmd({
  pattern: 'guessnumber',
  alias: ['devinette', 'guess'],
  desc: 'Number guessing game 1-10',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, config) => {
  if (games.has(m.chat)) return m.reply('🤖 [SYSTEM] Un jeu est déjà en cours! Terminez-le d\'abord.');

  const number = Math.floor(Math.random() * 10) + 1;
  games.set(m.chat, { number, attempts: 0 });

  const text = `🔢 [ROBOT] JEU DE DEVINETTE INITIÉ!\n\nDevinez un nombre entre 1 et 10.\nTapez un nombre pour jouer.\n\n⏳ Vous avez 5 tentatives.\n\n⚡ [ROBOT] Algorithme de nombre aléatoire activé.`;
  await m.reply(text);
});

cmd({
  pattern: /^[0-9]+$/,
  desc: 'Guess number input',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, config) => {
  if (!games.has(m.chat)) return;

  const game = games.get(m.chat);
  const guess = parseInt(args[0]);
  game.attempts++;

  if (guess === game.number) {
    games.delete(m.chat);
    return m.reply(`🎉 [ROBOT] CORRECT!\n\nLe nombre était ${game.number}.\nTentatives: ${game.attempts}/5.\n🏆 Félicitations!`);
  }

  if (game.attempts >= 5) {
    games.delete(m.chat);
    return m.reply(`💀 [ROBOT] GAME OVER!\n\nLe nombre était ${game.number}.\nVous avez épuisé vos tentatives.`);
  }

  const hint = guess < game.number ? '📈 Plus grand!' : '📉 Plus petit!';
  await m.reply(`${hint} Tentative ${game.attempts}/5. Essayez encore!`);
});
