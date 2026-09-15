const { cmd } = require('../command.cjs');
const { getLeaderboard } = require('./economy-db');

cmd({
  pattern: 'topcoins',
  alias: ['rich'],
  desc: 'View top 10 richest users!',
  category: 'economy',
  filename: __filename,
}, async (conn, m, args, config) => {
  const top = getLeaderboard(10);

  if (top.length === 0) {
    return m.reply(`⚙️ [SYSTEM] No users found in economy database. System needs data to process rankings.`);
  }

  let text = '🤖 [DJOUSSE TECH LEADERBOARD] ═══════════════\n';
  text += '🏆 Top 10 Richest Users:\n\n';

  top.forEach((user, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
    text += `${medal} @${user.id.split('@')[0]} - ${user.total} coins (Level ${user.level})\n`;
  });

  text += '═══════════════════\n';
  text += '📊 Rankings updated in real-time!';

  m.reply(text);
});