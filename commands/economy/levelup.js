const { cmd } = require('../command.cjs');
const { getUser, updateUser } = require('./economy-db');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

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
    return m.reply(boxWithFooter('ERROR', [
      { label: 'Required', value: `${cost} coins` },
      { label: 'Available', value: `${totalBalance} coins` },
    ]));
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

  m.reply(boxWithFooter('LEVEL UP!', [
    { label: 'Level', value: `${currentLevel} → ${user.level}` },
    { label: 'Cost', value: `${cost} coins` },
    { label: 'Cash', value: `${user.coins} coins` },
    { label: 'Bank', value: `${user.bank} coins` },
  ]));
});
