const { cmd } = require('../command.cjs');
const config = require('../config-djousse.cjs');
const { boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'antidelete',
  alias: ['adel'],
  desc: 'Active/désactive l\'anti-suppression (renvoie les messages supprimés)',
  category: 'owner',
  filename: __filename,
  fromMe: true,
}, async (conn, m, args, { from, reply }) => {
  const arg = (args[0] || '').toLowerCase();
  if (arg === 'on') {
    config.ANTI_DELETE = true;
    return reply(boxWithFooter('SUCCESS', [{ raw: '✅ Anti-delete activé. Les messages supprimés seront renvoyés.' }]));
  } else if (arg === 'off') {
    config.ANTI_DELETE = false;
    return reply(boxWithFooter('ERROR', [{ raw: '❌ Anti-delete désactivé.' }]));
  } else {
    return reply(boxWithFooter('ANTI-DELETE', [
      { raw: `🗑️ Anti-delete: ${config.ANTI_DELETE ? '✅ activé' : '❌ désactivé'}` },
      { raw: 'Usage: .antidelete on/off' },
    ]));
  }
});
