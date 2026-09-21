const { cmd } = require('../command.cjs');
const { getUser, updateUser } = require('./economy-db');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'dep',
  desc: 'Deposit coins to your bank!',
  category: 'economy',
  filename: __filename,
}, async (conn, m, args, config) => {
  const user = getUser(m.sender);
  let amount = args[0];

  if (!amount) {
    return m.reply(boxWithFooter('ERROR', [{ raw: 'Usage: `.dep <amount>` or `.dep all`. Deposit protocol requires input parameter.' }]));
  }

  if (amount.toLowerCase() === 'all') {
    amount = user.coins || 0;
  } else {
    amount = parseInt(amount);
  }

  if (isNaN(amount) || amount <= 0) {
    return m.reply(boxWithFooter('ERROR', [{ raw: 'Invalid amount detected. Deposit rejected. Please specify positive integer.' }]));
  }

  if (amount > (user.coins || 0)) {
    return m.reply(boxWithFooter('ERROR', [
      { label: 'Available', value: `${user.coins || 0} coins` },
      { raw: 'Deposit amount exceeds balance.' },
    ]));
  }

  user.coins = (user.coins || 0) - amount;
  user.bank = (user.bank || 0) + amount;
  user.transactions = (user.transactions || 0) + 1;
  updateUser(m.sender, user);

  m.reply(boxWithFooter('DEPOSIT COMPLETE', [
    { label: 'Deposited', value: `${amount} coins` },
    { label: 'Cash', value: `${user.coins} coins` },
    { label: 'Bank', value: `${user.bank} coins` },
  ]));
});
