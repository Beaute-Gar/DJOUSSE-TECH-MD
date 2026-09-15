const { cmd } = require('../command.cjs');

cmd({
  pattern: 'slots',
  alias: ['slot'],
  desc: 'Slot machine game',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, config) => {
  const emojis = ['🍒', '🍋', '🍇', '🍊', '🍉', '🍓', '🫐', '🍑'];
  const e1 = emojis[Math.floor(Math.random() * emojis.length)];
  const e2 = emojis[Math.floor(Math.random() * emojis.length)];
  const e3 = emojis[Math.floor(Math.random() * emojis.length)];

  let text, reward;
  if (e1 === e2 && e2 === e3) {
    reward = 100;
    text = `🎰 [ROBOT] JACKPOT!\n\n| ${e1} | ${e2} | ${e3} |\n\n🎉 Trois identiques! +${reward} pièces virtuelles!`;
  } else if (e1 === e2 || e2 === e3 || e1 === e3) {
    reward = 30;
    text = `🎰 [ROBOT] PETIT GAGNANT!\n\n| ${e1} | ${e2} | ${e3} |\n\n😊 Deux identiques! +${reward} pièces virtuelles.`;
  } else {
    reward = 0;
    text = `🎰 [ROBOT] PERDU!\n\n| ${e1} | ${e2} | ${e3} |\n\n😭 Aucune correspondance. +0 pièces.`;
  }

  text += `\n\n⚡ [ROBOT] Machine à sous exécutée.`;
  await m.reply(text);
});
