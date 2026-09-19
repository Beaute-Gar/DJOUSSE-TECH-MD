const { cmd } = require('../command.cjs');
const { getUser, updateUser, loadDB, saveDB } = require('./economy-db');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'resetbalance',
  alias: ['rb'],
  desc: 'Reset a user balance (owner only)!',
  category: 'owner',
  filename: __filename,
}, async (conn, m, args, config) => {
  if (!config.owner || !config.owner.includes(m.sender)) {
    return m.reply(boxWithFooter('ERROR', [{ raw: 'Access denied! This command is restricted to system administrator.' }]));
  }

  if (!args[0]) {
    return m.reply(boxWithFooter('ERROR', [{ raw: 'Usage: `.resetbalance @user`. Target user required for balance reset.' }]));
  }

  const target = args[0].replace(/[@]/g, '') + '@s.whatsapp.net';
  const db = loadDB();

  if (!db[target]) {
    return m.reply(boxWithFooter('ERROR', [{ raw: `User @${target.split('@')[0]} not found in economy database.` }]));
  }

  db[target].wallet = 0;
  db[target].bank = 0;
  saveDB(db);

  m.reply(boxWithFooter('ADMIN COMMAND', [
    { label: 'Target', value: `@${target.split('@')[0]}` },
    { raw: 'Balance reset complete! Wallet: 0 | Bank: 0' },
  ]));
});
