const { cmd } = require('../command.cjs');
const { getUser, updateUser } = require('./economy-db');

cmd({
  pattern: 'crime',
  alias: ['rob'],
  desc: 'Attempt a risky crime!',
  category: 'economy',
  filename: __filename,
}, async (conn, m, args, config) => {
  const user = getUser(m.sender);
  const now = Date.now();
  const cooldown = 2 * 60 * 60 * 1000;
  const remaining = cooldown - (now - (user.lastCrime || 0));

  if (remaining > 0) {
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    return m.reply(`⚙️ [SYSTEM] Crime module locked. Time remaining: ${hours}h ${minutes}m. Risk assessment: COOLDOWN.`);
  }

  const success = Math.random() < 0.5;

  if (success) {
    const reward = Math.floor(Math.random() * 401) + 100;
    user.coins = (user.coins || 0) + reward;
    user.lastCrime = now;
    user.transactions = (user.transactions || 0) + 1;
    updateUser(m.sender, user);
    m.reply(`🤖 [MISSION SUCCESS] Crime executed flawlessly! +${reward} coins acquired. Total balance: ${user.coins} coins. Stealth protocol activated! 🎯`);
  } else {
    const loss = Math.floor(Math.random() * 151) + 50;
    user.coins = Math.max(0, (user.coins || 0) - loss);
    user.lastCrime = now;
    user.transactions = (user.transactions || 0) + 1;
    updateUser(m.sender, user);
    m.reply(`🤖 [MISSION FAILED] Crime busted! -${loss} coins confiscated. Total balance: ${user.coins} coins. Recommend safer strategies, friend. ⚠️`);
  }
});