const { cmd } = require('../command.cjs');
const { getUser, updateUser, loadDB, saveDB } = require('./economy-db');

cmd({
  pattern: 'resetbalance',
  alias: ['rb'],
  desc: 'Reset a user balance (owner only)!',
  category: 'owner',
  filename: __filename,
}, async (conn, m, args, config) => {
  if (!config.owner || !config.owner.includes(m.sender)) {
    return m.reply(`⚙️ [SYSTEM] Access denied! This command is restricted to system administrator (Beaute Gar). Authorization required.`);
  }

  if (!args[0]) {
    return m.reply(`⚙️ [SYSTEM] Usage: .resetbalance @user. Target user required for balance reset.`);
  }

  const target = args[0].replace(/[@]/g, '') + '@s.whatsapp.net';
  const db = loadDB();

  if (!db[target]) {
    return m.reply(`⚙️ [SYSTEM] Error: User @${target.split('@')[0]} not found in economy database.`);
  }

  db[target].wallet = 0;
  db[target].bank = 0;
  saveDB(db);

  m.reply(`🤖 [ADMIN COMMAND] Balance reset complete! @${target.split('@')[0]} now has 0 coins. System rebooted for this user. ⚙️`);
});