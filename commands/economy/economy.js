const { cmd } = require('../command.cjs');
const { getAllUsers, getLeaderboard } = require('./economy-db');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'economy',
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

  m.reply(boxWithFooter('ECONOMY REPORT', [
    { label: 'Total Users', value: totalUsers },
    { label: 'Cash in Circulation', value: `${totalCoins} coins` },
    { label: 'Bank Reserves', value: `${totalBank} coins` },
    { label: 'Total Wealth', value: `${totalWealth} coins` },
    { label: 'Total Transactions', value: totalTransactions },
  ]));
});
