const { cmd } = require('../command.cjs');
const { getAllUsers, getLeaderboard } = require('./economy-db');

cmd({
  pattern: 'economy',
  alias: ['ecostat'],
  desc: 'View economy statistics!',
  category: 'economy',
  filename: __filename,
}, async (conn, m, args, config) => {
  const allUsers = getAllUsers();
  const users = Object.entries(allUsers);

  let totalCoins = 0;
  let totalBank = 0;
  let totalTransactions = 0;

  users.forEach(([id, data]) => {
    totalCoins += data.wallet || 0;
    totalBank += data.bank || 0;
    totalTransactions += data.transactions || 0;
  });

  const totalUsers = users.length;
  const totalWealth = totalCoins + totalBank;

  m.reply(`🤖 [DJOUSSE TECH ECONOMY REPORT] ═══════════════\n📊 System Statistics:\n\n👥 Total Users: ${totalUsers}\n💰 Cash in Circulation: ${totalCoins} coins\n🏦 Bank Reserves: ${totalBank} coins\n💎 Total Wealth: ${totalWealth} coins\n📈 Total Transactions: ${totalTransactions}\n\n═══════════════════\n⚙️ Economy status: OPERATIONAL. System running at optimal efficiency!`);
});