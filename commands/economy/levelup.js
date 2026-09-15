const { cmd } = require('../command.cjs');
const { getUser, updateUser } = require('./economy-db');

cmd({
  pattern: 'levelup',
  alias: ['lvl'],
  desc: 'Level up your profile!',
  category: 'economy',
  filename: __filename,
}, async (conn, m, args, config) => {
  const user = getUser(m.sender);
  const currentLevel = user.level || 1;
  const cost = currentLevel * 500;
  const totalBalance = (user.coins || 0) + (user.bank || 0);

  if (totalBalance < cost) {
    return m.reply(`⚙️ [SYSTEM] Insufficient funds for level up! Required: ${cost} coins | Available: ${totalBalance} coins. Keep accumulating resources!`);
  }

  if ((user.coins || 0) >= cost) {
    user.coins = (user.coins || 0) - cost;
  } else {
    const fromBank = cost - (user.coins || 0);
    user.coins = 0;
    user.bank = (user.bank || 0) - fromBank;
  }

  user.level = currentLevel + 1;
  user.transactions = (user.transactions || 0) + 1;
  updateUser(m.sender, user);

  m.reply(`🤖 [LEVEL UP!] Level ${currentLevel} → Level ${user.level}! Cost deducted: ${cost} coins. New balance - Cash: ${user.coins} | Bank: ${user.bank}. Achievement unlocked! 🎮`);
});