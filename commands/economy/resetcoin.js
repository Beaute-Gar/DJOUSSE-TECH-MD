const { cmd } = require('../command.cjs');
const { saveDB } = require('./economy-db');

cmd({
  pattern: 'resetcoin',
  alias: ['rc'],
  desc: 'Reset all balances (owner only)!',
  category: 'owner',
  filename: __filename,
}, async (conn, m, args, config) => {
  if (!config.owner || !config.owner.includes(m.sender)) {
    return m.reply(`⚙️ [SYSTEM] Access denied! This command is restricted to system administrator (Beaute Gar). Nuclear option requires authorization.`);
  }

  saveDB({});

  m.reply(`🤖 [ADMIN COMMAND] WARNING: Global economy reset initiated! All balances set to zero. System has been rebooted. New economic cycle begins now! ⚠️`);
});