const { cmd } = require('../command.cjs');
const { getUser, updateUser } = require('./economy-db');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

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
    return m.reply(boxWithFooter('ERROR', [{ raw: 'Usage: `.wd <amount>` or `.wd all`. Withdrawal protocol requires input parameter.' }]));
  }

  if (amount.toLowerCase() === 'all') {
    amount = user.bank || 0;
  } else {
    amount = parseInt(amount);
  }

  if (isNaN(amount) || amount <= 0) {
    return m.reply(boxWithFooter('ERROR', [{ raw: 'Invalid amount detected. Withdrawal rejected. Please specify positive integer.' }]));
  }

  if (amount > (user.bank || 0)) {
    return m.reply(boxWithFooter('ERROR', [
      { label: 'Bank Balance', value: `${user.bank || 0} coins` },
      { raw: 'Withdrawal amount exceeds reserves.' },
    ]));
  }

  user.bank = (user.bank || 0) - amount;
  user.coins = (user.coins || 0) + amount;
  user.transactions = (user.transactions || 0) + 1;
  updateUser(m.sender, user);

  m.reply(boxWithFooter('WITHDRAWAL COMPLETE', [
    { label: 'Withdrawn', value: `${amount} coins` },
    { label: 'Cash', value: `${user.coins} coins` },
    { label: 'Bank', value: `${user.bank} coins` },
  ]));
});
