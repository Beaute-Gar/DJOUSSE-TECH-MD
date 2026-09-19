const { cmd } = require('../command.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

const games = new Map();

cmd({
  pattern: 'guessnumber',
  alias: ['devinette', 'guess'],
  desc: 'Number guessing game 1-10',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, config) => {
  if (games.has(m.chat)) return m.reply(boxWithFooter('ERREUR', [{ raw: '🤖 [SYSTEM] Un jeu est déjà en cours! Terminez-le d\'abord.' }]));

  const number = Math.floor(Math.random() * 10) + 1;
  games.set(m.chat, { number, attempts: 0 });

  const text = boxWithFooter('🔢 JEU DE DEVINETTE', [
    { raw: 'Devinez un nombre entre 1 et 10.' },
    { raw: 'Tapez un nombre pour jouer.' },
    { blank: true },
    { raw: '⏳ Vous avez 5 tentatives.' },
  ]);
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
    return m.reply(boxWithFooter('🎉 CORRECT', [
      { raw: `Le nombre était ${game.number}.` },
      { label: 'Tentatives', value: `${game.attempts}/5` },
      { raw: '🏆 Félicitations!' },
    ]));
  }

  if (game.attempts >= 5) {
    games.delete(m.chat);
    return m.reply(boxWithFooter('💀 GAME OVER', [
      { raw: `Le nombre était ${game.number}.` },
      { raw: 'Vous avez épuisé vos tentatives.' },
    ]));
  }

  const hint = guess < game.number ? '📈 Plus grand!' : '📉 Plus petit!';
  await m.reply(boxWithFooter('💡 INDICE', [
    { raw: hint },
    { raw: `Tentative ${game.attempts}/5. Essayez encore!` },
  ]));
});
