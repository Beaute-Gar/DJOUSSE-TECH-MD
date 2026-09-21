const { cmd } = require('../command.cjs');
const { getUser, updateUser } = require('./economy-db');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'daily',
  desc: 'Collect your daily coins!',
  category: 'economy',
  filename: __filename,
}, async (conn, m, args, config) => {
  const user = getUser(m.sender);
  const now = Date.now();
  const cooldown = 24 * 60 * 60 * 1000;
  const remaining = cooldown - (now - (user.lastDaily || 0));

  if (remaining > 0) {
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    return m.reply(boxWithFooter('COOLDOWN', [{ raw: `Daily rewards on cooldown. Time remaining: ${hours}h ${minutes}m.` }]));
  }

  const reward = 100;
  user.coins = (user.coins || 0) + reward;
  user.lastDaily = now;
  user.transactions = (user.transactions || 0) + 1;
  updateUser(m.sender, user);

  m.reply(boxWithFooter('DAILY COLLECTED', [
    { label: 'Reward', value: `+${reward} coins` },
    { label: 'Total', value: `${user.coins} coins` },
  ]));
});
