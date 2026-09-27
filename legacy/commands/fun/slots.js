const { cmd } = require('../command.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'slots',
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
    text = boxWithFooter('🎰 JACKPOT!', [
      { raw: `| ${e1} | ${e2} | ${e3} |` },
      { raw: `🎉 Trois identiques! +${reward} pièces virtuelles!` },
    ]);
  } else if (e1 === e2 || e2 === e3 || e1 === e3) {
    reward = 30;
    text = boxWithFooter('🎰 PETIT GAGNANT', [
      { raw: `| ${e1} | ${e2} | ${e3} |` },
      { raw: `😊 Deux identiques! +${reward} pièces virtuelles.` },
    ]);
  } else {
    reward = 0;
    text = boxWithFooter('🎰 PERDU', [
      { raw: `| ${e1} | ${e2} | ${e3} |` },
      { raw: '😭 Aucune correspondance. +0 pièces.' },
    ]);
  }

  await m.reply(text);
});
