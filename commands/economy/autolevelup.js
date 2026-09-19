const { cmd } = require('../command.cjs');
const { getUser, updateUser } = require('./economy-db');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

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

  m.reply(boxWithFooter('AUTO LEVEL UP', [
    { label: 'Status', value: `${icon} ${status}` },
    { raw: 'When enabled, system will automatically level up when sufficient funds detected.' },
  ]));
});
