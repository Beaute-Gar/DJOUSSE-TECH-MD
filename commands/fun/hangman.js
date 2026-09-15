const { cmd } = require('../command.cjs');

const games = new Map();

const words = ['INFORMATIQUE', 'ROBOT', 'ALGORITHME', 'PROGRAMMATION', 'DISPONIBLE', 'CYBERSECURITE', 'DEVELOPPEUR', 'INTERNET', 'BLUETOOTH', 'LOGICIEL'];

cmd({
  pattern: 'hangman',
  alias: ['pendu'],
  desc: 'Hangman word game',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, config) => {
  if (games.has(m.chat)) return m.reply('🤖 [SYSTEM] Un jeu est déjà en cours!');

  const word = words[Math.floor(Math.random() * words.length)];
  const hidden = '_ '.repeat(word.length).trim();
  games.set(m.chat, { word, guessed: [], wrong: 0, maxWrong: 6 });

  const text = `🎯 [ROBOT] HANGMAN INITIÉ!\n\nMot: ${hidden} (${word.length} lettres)\nVies: ${'❤️'.repeat(6)}\n\nTapez une lettre pour jouer.\n\n⚡ [ROBOT] Mot sélectionné aléatoirement.`;
  await m.reply(text);
});

cmd({
  pattern: /^[a-zA-Z]$/,
  desc: 'Hangman letter guess',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, config) => {
  if (!games.has(m.chat)) return;

  const game = games.get(m.chat);
  const letter = args[0].toUpperCase();

  if (game.guessed.includes(letter)) return m.reply('🤖 [SYSTEM] Lettre déjà essayée!');

  game.guessed.push(letter);

  if (!game.word.includes(letter)) {
    game.wrong++;
    if (game.wrong >= game.maxWrong) {
      games.delete(m.chat);
      return m.reply(`💀 [ROBOT] GAME OVER!\n\nMot: ${game.word}\nVous avez été pendu numériquement.`);
    }
    const lives = '❤️'.repeat(game.maxWrong - game.wrong);
    return m.reply(`❌ [SYSTEM] '${letter}' n'est pas dans le mot!\nVies: ${lives}\nLettres essayées: ${game.guessed.join(', ')}`);
  }

  const display = game.word.split('').map(c => game.guessed.includes(c) ? c : '_').join(' ');
  const won = !game.word.split('').some(c => !game.guessed.includes(c));

  if (won) {
    games.delete(m.chat);
    return m.reply(`🎉 [ROBOT] VICTOIRE!\n\nMot: ${game.word}\nErreurs: ${game.wrong}/${game.maxWrong}\n🏆 Félicitations!`);
  }

  await m.reply(`✅ [SYSTEM] '${letter}' trouvé!\n\nMot: ${display}\nVies: ${'❤️'.repeat(game.maxWrong - game.wrong)}\nLettres: ${game.guessed.join(', ')}`);
});
