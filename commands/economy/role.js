const { cmd } = require('../command.cjs');
const { getUser } = require('./economy-db');

cmd({
  pattern: 'role',
  alias: ['rank'],
  desc: 'Check your role based on wealth!',
  category: 'economy',
  filename: __filename,
}, async (conn, m, args, config) => {
  const user = getUser(m.sender);
  const total = (user.coins || 0) + (user.bank || 0);

  let role, emoji;
  if (total < 500) {
    role = 'Newbie';
    emoji = '🌱';
  } else if (total < 2000) {
    role = 'Worker';
    emoji = '⚙️';
  } else if (total < 10000) {
    role = 'Rich';
    emoji = '💰';
  } else if (total < 50000) {
    role = 'Millionaire';
    emoji = '💎';
  } else {
    role = 'Legend';
    emoji = '👑';
  }

  m.reply(`🤖 [ROLE STATUS] ═══════════════════\n${emoji} Current Role: ${role}\n💰 Total Wealth: ${total} coins\n📊 Level: ${user.level || 1}\n═══════════════════\nKeep climbing the ranks, friend! System acknowledges your progress. ⚙️`);
});