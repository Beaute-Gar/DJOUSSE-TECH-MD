const { cmd } = require('../command.cjs');
const { getUser, updateUser } = require('./economy-db');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'crime',
  alias: ['rob'],
  desc: 'Attempt a risky crime!',
  category: 'economy',
  filename: __filename,
}, async (conn, m, args, config) => {
  const user = getUser(m.sender);
  const now = Date.now();
  const cooldown = 2 * 60 * 60 * 1000;
  const remaining = cooldown - (now - (user.lastCrime || 0));

  if (remaining > 0) {
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    return m.reply(boxWithFooter('COOLDOWN', [{ raw: `Crime module locked. Time remaining: ${hours}h ${minutes}m.` }]));
  }

  const success = Math.random() < 0.5;

  if (success) {
    const reward = Math.floor(Math.random() * 401) + 100;
    user.coins = (user.coins || 0) + reward;
    user.lastCrime = now;
    user.transactions = (user.transactions || 0) + 1;
    updateUser(m.sender, user);
    m.reply(boxWithFooter('MISSION SUCCESS', [
      { label: 'Reward', value: `+${reward} coins` },
      { label: 'Total', value: `${user.coins} coins` },
    ]));
  } else {
    const loss = Math.floor(Math.random() * 151) + 50;
    user.coins = Math.max(0, (user.coins || 0) - loss);
    user.lastCrime = now;
    user.transactions = (user.transactions || 0) + 1;
    updateUser(m.sender, user);
    m.reply(boxWithFooter('MISSION FAILED', [
      { label: 'Loss', value: `-${loss} coins` },
      { label: 'Total', value: `${user.coins} coins` },
    ]));
  }
});
