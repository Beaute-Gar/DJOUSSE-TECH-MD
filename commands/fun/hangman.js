const { cmd } = require('../command.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

const games = new Map();

const words = ['INFORMATIQUE', 'ROBOT', 'ALGORITHME', 'PROGRAMMATION', 'DISPONIBLE', 'CYBERSECURITE', 'DEVELOPPEUR', 'INTERNET', 'BLUETOOTH', 'LOGICIEL'];

cmd({
  pattern: 'hangman',
  desc: 'Hangman word game',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, config) => {
  if (games.has(m.chat)) return m.reply(boxWithFooter('ERREUR', [{ raw: '🤖 [SYSTEM] Un jeu est déjà en cours!' }]));

  const word = words[Math.floor(Math.random() * words.length)];
  const hidden = '_ '.repeat(word.length).trim();
  games.set(m.chat, { word, guessed: [], wrong: 0, maxWrong: 6 });

  const text = boxWithFooter('🎯 HANGMAN', [
    { label: 'Mot', value: hidden + ` (${word.length} lettres)` },
    { label: 'Vies', value: '❤️'.repeat(6) },
    { raw: 'Tapez une lettre pour jouer.' },
  ]);
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

  if (game.guessed.includes(letter)) return m.reply(boxWithFooter('ERREUR', [{ raw: '🤖 [SYSTEM] Lettre déjà essayée!' }]));

  game.guessed.push(letter);

  if (!game.word.includes(letter)) {
    game.wrong++;
    if (game.wrong >= game.maxWrong) {
      games.delete(m.chat);
      return m.reply(boxWithFooter('💀 GAME OVER', [
        { label: 'Mot', value: game.word },
        { raw: 'Vous avez été pendu numériquement.' },
      ]));
    }
    const lives = '❤️'.repeat(game.maxWrong - game.wrong);
    return m.reply(boxWithFooter('❌ ERREUR', [
      { raw: `'${letter}' n'est pas dans le mot!` },
      { label: 'Vies', value: lives },
      { label: 'Lettres essayées', value: game.guessed.join(', ') },
    ]));
  }

  const display = game.word.split('').map(c => game.guessed.includes(c) ? c : '_').join(' ');
  const won = !game.word.split('').some(c => !game.guessed.includes(c));

  if (won) {
    games.delete(m.chat);
    return m.reply(boxWithFooter('🎉 VICTOIRE', [
      { label: 'Mot', value: game.word },
      { label: 'Erreurs', value: `${game.wrong}/${game.maxWrong}` },
      { raw: '🏆 Félicitations!' },
    ]));
  }

  await m.reply(boxWithFooter('✅ TROUVÉ', [
    { raw: `'${letter}' trouvé!` },
    { label: 'Mot', value: display },
    { label: 'Vies', value: '❤️'.repeat(game.maxWrong - game.wrong) },
    { label: 'Lettres', value: game.guessed.join(', ') },
  ]));
});
