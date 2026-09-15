const { cmd } = require('../command.cjs');
const { getUser, updateUser } = require('./economy-db');

cmd({
  pattern: 'wd',
  alias: ['withdraw'],
  desc: 'Withdraw coins from your bank!',
  category: 'economy',
  filename: __filename,
}, async (conn, m, args, config) => {
  const user = getUser(m.sender);
  let amount = args[0];

  if (!amount) {
    return m.reply(`⚙️ [SYSTEM] Usage: .wd <amount> or .wd all. Withdrawal protocol requires input parameter.`);
  }

  if (amount.toLowerCase() === 'all') {
    amount = user.bank || 0;
  } else {
    amount = parseInt(amount);
  }

  if (isNaN(amount) || amount <= 0) {
    return m.reply(`⚙️ [SYSTEM] Error: Invalid amount detected. Withdrawal rejected. Please specify positive integer.`);
  }

  if (amount > (user.bank || 0)) {
    return m.reply(`⚙️ [SYSTEM] Insufficient bank funds! Bank balance: ${user.bank || 0} coins. Withdrawal amount exceeds reserves.`);
  }

  user.bank = (user.bank || 0) - amount;
  user.coins = (user.coins || 0) + amount;
  user.transactions = (user.transactions || 0) + 1;
  updateUser(m.sender, user);

  m.reply(`🤖 [WITHDRAWAL COMPLETE] Retrieved ${amount} coins from bank. Cash: ${user.coins} | Bank: ${user.bank}. Funds transferred to wallet! 💰`);
});