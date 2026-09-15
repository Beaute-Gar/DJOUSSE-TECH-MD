const { cmd } = require('../command.cjs');
const { getUser } = require('./economy-db');

cmd({
  pattern: 'balance',
  alias: ['bal'],
  desc: 'Check your coin balance!',
  category: 'economy',
  filename: __filename,
}, async (conn, m, args, config) => {
  const user = getUser(m.sender);
  const total = (user.coins || 0) + (user.bank || 0);

  m.reply(`🤖 [WALLET STATUS] ═══════════════════\n📊 Cash: ${user.coins || 0} coins\n🏦 Bank: ${user.bank || 0} coins\n💰 Total: ${total} coins\n📈 Level: ${user.level || 1}\n═══════════════════\nSystem status: OPTIMAL. Keep earning, friend! ⚙️`);
});