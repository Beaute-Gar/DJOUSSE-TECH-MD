const { cmd } = require('../command.cjs');
const { getUser, updateUser } = require('./economy-db');

cmd({
  pattern: 'weekly',
  alias: ['wk'],
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
    return m.reply(`⚙️ [SYSTEM] Weekly rewards on cooldown. Time remaining: ${days}d ${hours}h. System recommends patience protocol.`);
  }

  const reward = 700;
  user.coins = (user.coins || 0) + reward;
  user.lastWeekly = now;
  user.transactions = (user.transactions || 0) + 1;
  updateUser(m.sender, user);

  m.reply(`🤖 [BEEP BOOP] Weekly collection complete! +${reward} coins deposited. Total balance: ${user.coins} coins. Reward cycle synchronized! 💰`);
});