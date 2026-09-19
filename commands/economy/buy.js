const { cmd } = require('../command.cjs');
const { getUser, updateUser } = require('./economy-db');
const { shopItems } = require('./shop');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'buy',
  alias: ['purchase'],
  desc: 'Buy an item from the shop!',
  category: 'economy',
  filename: __filename,
}, async (conn, m, args, config) => {
  if (!args[0]) {
    return m.reply(boxWithFooter('ERROR', [{ raw: 'Usage: `.buy <item name>`. Purchase protocol requires item selection.' }]));
  }

  const itemName = args.join(' ').toLowerCase();
  const item = shopItems.find(i => i.name.toLowerCase().includes(itemName));

  if (!item) {
    return m.reply(boxWithFooter('ERROR', [{ raw: `Item "${args.join(' ')}" not found in shop catalog. Use \`.shop\` to view available items.` }]));
  }

  const user = getUser(m.sender);
  if ((user.coins || 0) < item.price) {
    return m.reply(boxWithFooter('ERROR', [
      { label: 'Required', value: `${item.price} coins` },
      { label: 'Available', value: `${user.coins || 0} coins` },
    ]));
  }

  user.coins = (user.coins || 0) - item.price;
  user.inventory = [...(user.inventory || []), item.name];
  user.transactions = (user.transactions || 0) + 1;
  updateUser(m.sender, user);

  m.reply(boxWithFooter('PURCHASE COMPLETE', [
    { label: 'Item', value: item.name },
    { label: 'Cost', value: `${item.price} coins` },
    { label: 'Remaining', value: `${user.coins} coins` },
  ]));
});
