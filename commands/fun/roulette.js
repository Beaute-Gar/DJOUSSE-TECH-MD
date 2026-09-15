const { cmd } = require('../command.cjs');

cmd({
  pattern: 'roulette',
  alias: ['roue'],
  desc: 'Roulette wheel game',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, config) => {
  const outcomes = ['🔴 Rouge', '⚫ Noir', '🟢 Vert'];
  const weights = [0.48, 0.48, 0.04];
  const rand = Math.random();
  let result;
  if (rand < weights[0]) result = outcomes[0];
  else if (rand < weights[0] + weights[1]) result = outcomes[1];
  else result = outcomes[2];

  const color = result.split(' ')[0];
  const name = result.split(' ')[1];

  let reward;
  if (color === '🟢') reward = '💰 JACKPOT! x35!';
  else if (color === '🔴') reward = '📈 Gain modéré! x2.';
  else reward = '📉 Perte...';

  const text = `🎡 [ROBOT] ROULETTE LANÇÉE!\n\nRésultat : ${result}\n${reward}\n\n⚡ [ROBOT] Tour de roulette simulé.`;
  await m.reply(text);
});
