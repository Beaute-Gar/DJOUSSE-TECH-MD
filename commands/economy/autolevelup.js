const { cmd } = require('../command.cjs');
const { getUser, updateUser } = require('./economy-db');

cmd({
  pattern: 'autolevelup',
  alias: ['alv'],
  desc: 'Toggle automatic level up!',
  category: 'economy',
  filename: __filename,
}, async (conn, m, args, config) => {
  const user = getUser(m.sender);
  user.autoLevelUp = !user.autoLevelUp;
  updateUser(m.sender, user);

  const status = user.autoLevelUp ? 'ENABLED' : 'DISABLED';
  const icon = user.autoLevelUp ? '🟢' : '🔴';

  m.reply(`🤖 [AUTO LEVEL UP] ${icon} Status: ${status}. When enabled, system will automatically level up when sufficient funds detected. Configuration saved! ⚙️`);
});