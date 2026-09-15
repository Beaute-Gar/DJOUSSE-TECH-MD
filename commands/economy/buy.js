const { cmd } = require('../command.cjs');
const { getUser, updateUser } = require('./economy-db');
const { shopItems } = require('./shop');

cmd({
  pattern: 'buy',
  alias: ['purchase'],
  desc: 'Buy an item from the shop!',
  category: 'economy',
  filename: __filename,
}, async (conn, m, args, config) => {
  if (!args[0]) {
    return m.reply(`⚙️ [SYSTEM] Usage: .buy <item name>. Purchase protocol requires item selection.`);
  }

  const itemName = args.join(' ').toLowerCase();
  const item = shopItems.find(i => i.name.toLowerCase().includes(itemName));

  if (!item) {
    return m.reply(`⚙️ [SYSTEM] Error: Item "${args.join(' ')}" not found in shop catalog. Use .shop to view available items.`);
  }

  const user = getUser(m.sender);
  if ((user.coins || 0) < item.price) {
    return m.reply(`⚙️ [SYSTEM] Insufficient funds! Required: ${item.price} coins | Available: ${user.coins || 0} coins. Keep earning, friend!`);
  }

  user.coins = (user.coins || 0) - item.price;
  user.inventory = [...(user.inventory || []), item.name];
  user.transactions = (user.transactions || 0) + 1;
  updateUser(m.sender, user);

  m.reply(`🤖 [PURCHASE COMPLETE] Item acquired: ${item.name}! Cost: ${item.price} coins. Remaining balance: ${user.coins} coins. Inventory updated! 🛒`);
});