const { cmd } = require('../command.cjs');
const { saveDB } = require('./economy-db');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'resetcoin',
  desc: 'Reset all balances (owner only)!',
  category: 'owner',
  filename: __filename,
}, async (conn, m, args, config) => {
  if (!config.owner || !config.owner.includes(m.sender)) {
    return m.reply(boxWithFooter('ERROR', [{ raw: 'Access denied! This command is restricted to system administrator.' }]));
  }

  saveDB({});

  m.reply(boxWithFooter('ADMIN COMMAND', [{ raw: 'WARNING: Global economy reset initiated! All balances set to zero. New economic cycle begins now!' }]));
});
