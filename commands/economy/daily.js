const { cmd } = require('../command.cjs');
const { getUser, updateUser } = require('./economy-db');

cmd({
  pattern: 'daily',
  alias: ['dl'],
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
    return m.reply(`⚙️ [SYSTEM] Daily rewards on cooldown. Time remaining: ${hours}h ${minutes}m. Please wait, patient robot.`);
  }

  const reward = 100;
  user.coins = (user.coins || 0) + reward;
  user.lastDaily = now;
  user.transactions = (user.transactions || 0) + 1;
  updateUser(m.sender, user);

  m.reply(`🤖 [BEEP BOOP] Daily collection complete! +${reward} coins deposited. Total balance: ${user.coins} coins. Come back tomorrow for more, friend! 🎯`);
});