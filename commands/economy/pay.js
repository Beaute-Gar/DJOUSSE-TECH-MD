const { cmd } = require('../command.cjs');
const { getUser, updateUser } = require('./economy-db');

cmd({
  pattern: 'pay',
  alias: ['transfer'],
  desc: 'Transfer coins to another user!',
  category: 'economy',
  filename: __filename,
}, async (conn, m, args, config) => {
  if (!args[0] || !args[1]) {
    return m.reply(`⚙️ [SYSTEM] Usage: .pay @user <amount>. Transfer protocol requires target and amount.`);
  }

  let target = args[0].replace(/[@]/g, '') + '@s.whatsapp.net';
  const amount = parseInt(args[1]);

  if (isNaN(amount) || amount <= 0) {
    return m.reply(`⚙️ [SYSTEM] Error: Invalid amount detected. Transfer rejected. Please specify positive integer.`);
  }

  if (target === m.sender) {
    return m.reply(`⚙️ [SYSTEM] Error: Self-transfer detected. Cannot pay yourself, friend. That would be recursive!`);
  }

  const senderUser = getUser(m.sender);
  if (amount > (senderUser.coins || 0)) {
    return m.reply(`⚙️ [SYSTEM] Insufficient funds! Cash available: ${senderUser.coins || 0} coins. Transfer amount exceeds balance.`);
  }

  const targetUser = getUser(target);

  senderUser.coins = (senderUser.coins || 0) - amount;
  senderUser.transactions = (senderUser.transactions || 0) + 1;
  updateUser(m.sender, senderUser);

  targetUser.coins = (targetUser.coins || 0) + amount;
  targetUser.transactions = (targetUser.transactions || 0) + 1;
  updateUser(target, targetUser);

  m.reply(`🤖 [TRANSFER COMPLETE] Sent ${amount} coins to @${target.split('@')[0]}. Your balance: ${senderUser.coins} coins. Transaction verified by blockchain! 🔗`);
});