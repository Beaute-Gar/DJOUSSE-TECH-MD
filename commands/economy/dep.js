const { cmd } = require('../command.cjs');
const { getUser, updateUser } = require('./economy-db');

cmd({
  pattern: 'dep',
  alias: ['deposit'],
  desc: 'Deposit coins to your bank!',
  category: 'economy',
  filename: __filename,
}, async (conn, m, args, config) => {
  const user = getUser(m.sender);
  let amount = args[0];

  if (!amount) {
    return m.reply(`⚙️ [SYSTEM] Usage: .dep <amount> or .dep all. Deposit protocol requires input parameter.`);
  }

  if (amount.toLowerCase() === 'all') {
    amount = user.coins || 0;
  } else {
    amount = parseInt(amount);
  }

  if (isNaN(amount) || amount <= 0) {
    return m.reply(`⚙️ [SYSTEM] Error: Invalid amount detected. Deposit rejected. Please specify positive integer.`);
  }

  if (amount > (user.coins || 0)) {
    return m.reply(`⚙️ [SYSTEM] Insufficient funds! Cash available: ${user.coins || 0} coins. Deposit amount exceeds balance.`);
  }

  user.coins = (user.coins || 0) - amount;
  user.bank = (user.bank || 0) + amount;
  user.transactions = (user.transactions || 0) + 1;
  updateUser(m.sender, user);

  m.reply(`🤖 [DEPOSIT COMPLETE] Transferred ${amount} coins to bank. Cash: ${user.coins} | Bank: ${user.bank}. Funds secured in digital vault! 🏦`);
});