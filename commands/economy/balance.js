const { cmd } = require('../command.cjs');
const { getUser } = require('./economy-db');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'balance',
  alias: ['bal'],
  desc: 'Check your coin balance!',
  category: 'economy',
  filename: __filename,
}, async (conn, m, args, config) => {
  const user = getUser(m.sender);
  const total = (user.coins || 0) + (user.bank || 0);

  m.reply(boxWithFooter('WALLET STATUS', [
    { label: 'Cash', value: `${user.coins || 0} coins` },
    { label: 'Bank', value: `${user.bank || 0} coins` },
    { label: 'Total', value: `${total} coins` },
    { label: 'Level', value: `${user.level || 1}` },
  ]));
});
