const { cmd } = require('../command.cjs');
const { getUser, updateUser } = require('./economy-db');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'weekly',
  desc: 'Collect your weekly coins!',
  category: 'economy',
  filename: __filename,
}, async (conn, m, args, config) => {
  const user = getUser(m.sender);
  const now = Date.now();
  const cooldown = 7 * 24 * 60 * 60 * 1000;
  const remaining = cooldown - (now - (user.lastWeekly || 0));

  if (remaining > 0) {
    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return m.reply(boxWithFooter('COOLDOWN', [{ raw: `Weekly rewards on cooldown. Time remaining: ${days}d ${hours}h.` }]));
  }

  const reward = 700;
  user.coins = (user.coins || 0) + reward;
  user.lastWeekly = now;
  user.transactions = (user.transactions || 0) + 1;
  updateUser(m.sender, user);

  m.reply(boxWithFooter('WEEKLY COLLECTED', [
    { label: 'Reward', value: `+${reward} coins` },
    { label: 'Total', value: `${user.coins} coins` },
  ]));
});
