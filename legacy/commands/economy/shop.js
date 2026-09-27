const { cmd } = require('../command.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

const shopItems = [
  { name: 'vip badge', price: 5000, desc: 'VIP status badge - exclusive access!' },
  { name: 'custom title', price: 3000, desc: 'Custom title for your profile!' },
  { name: 'extra slots', price: 2000, desc: 'Extra inventory slots!' },
  { name: 'mystery box', price: 1000, desc: 'Random surprise inside!' },
];

cmd({
  pattern: 'shop',
  desc: 'View the economy shop!',
  category: 'economy',
  filename: __filename,
}, async (conn, m, args, config) => {
  const lines = shopItems.map((item, i) => ({
    cmd: `buy ${item.name}`,
    desc: `${item.price} coins — ${item.desc}`,
  }));

  m.reply(boxWithFooter('DJOUSSE TECH SHOP', lines));
});

module.exports = { shopItems };
