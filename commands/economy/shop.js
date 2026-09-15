const { cmd } = require('../command.cjs');

const shopItems = [
  { name: 'vip badge', price: 5000, desc: 'VIP status badge - exclusive access!' },
  { name: 'custom title', price: 3000, desc: 'Custom title for your profile!' },
  { name: 'extra slots', price: 2000, desc: 'Extra inventory slots!' },
  { name: 'mystery box', price: 1000, desc: 'Random surprise inside!' },
];

cmd({
  pattern: 'shop',
  alias: ['store'],
  desc: 'View the economy shop!',
  category: 'economy',
  filename: __filename,
}, async (conn, m, args, config) => {
  let shopText = '🤖 [DJOUSSE TECH SHOP] ═══════════════\n';
  shopText += '📦 Available items for purchase:\n\n';

  shopItems.forEach((item, i) => {
    shopText += `${i + 1}. ${item.name} - ${item.price} coins\n   📝 ${item.desc}\n\n`;
  });

  shopText += '═══════════════════\n';
  shopText += '💡 Use .buy <item name> to purchase!';

  m.reply(shopText);
});

module.exports = { shopItems };