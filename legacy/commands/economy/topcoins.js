const { cmd } = require('../command.cjs');
const { getLeaderboard } = require('./economy-db');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'topcoins',
  desc: 'View top 10 richest users!',
  category: 'economy',
  filename: __filename,
}, async (conn, m, args, config) => {
  const top = getLeaderboard(10);

  if (top.length === 0) {
    return m.reply(boxWithFooter('ERROR', [{ raw: 'No users found in economy database. System needs data to process rankings.' }]));
  }

  const lines = top.map((user, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
    return { label: `${medal} @${user.id.split('@')[0]}`, value: `${user.total} coins (Level ${user.level})` };
  });

  m.reply(boxWithFooter('LEADERBOARD', lines));
});
