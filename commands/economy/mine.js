const { cmd } = require('../command.cjs');
const { getUser, updateUser } = require('./economy-db');

cmd({
  pattern: 'mine',
  alias: ['dig'],
  desc: 'Mine for coins!',
  category: 'economy',
  filename: __filename,
}, async (conn, m, args, config) => {
  const user = getUser(m.sender);
  const now = Date.now();
  const cooldown = 30 * 60 * 1000;
  const remaining = cooldown - (now - (user.lastMine || 0));

  if (remaining > 0) {
    const minutes = Math.floor(remaining / (1000 * 60));
    return m.reply(`⚙️ [SYSTEM] Mining equipment recalibrating. Time remaining: ${minutes}m. Patience yields ore.`);
  }

  const finds = [
    { item: 'Copper nugget', bonus: 0 },
    { item: 'Silver fragment', bonus: 20 },
    { item: 'Gold shard', bonus: 50 },
    { item: 'Diamond chip', bonus: 80 },
    { item: 'Mysterious crystal', bonus: 100 },
  ];

  const find = finds[Math.floor(Math.random() * finds.length)];
  const reward = Math.floor(Math.random() * 131) + 10 + find.bonus;

  user.coins = (user.coins || 0) + reward;
  user.lastMine = now;
  user.transactions = (user.transactions || 0) + 1;
  updateUser(m.sender, user);

  m.reply(`🤖 [MINING REPORT] Digging complete! Found: ${find.item}. Earnings: +${reward} coins. Total balance: ${user.coins} coins. Mining efficiency: MAXIMUM! ⛏️`);
});