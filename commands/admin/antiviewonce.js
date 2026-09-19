const { cmd } = require('../command.cjs');
const viewOnceSaver = require('../../lib/view-once.cjs');
const { boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'antiviewonce',
  alias: ['avv', 'autoviewonce'],
  desc: 'Active/désactive l\'interception des messages view-once',
  category: 'owner',
  filename: __filename,
  fromMe: true,
}, async (conn, m, args, { from, reply }) => {
  const arg = (args[0] || '').toLowerCase();
  if (arg === 'on') {
    viewOnceSaver.enable();
    return reply(boxWithFooter('SUCCESS', [{ raw: '✅ Anti-view-once activé. Les messages éphémères seront interceptés et renvoyés.' }]));
  } else if (arg === 'off') {
    viewOnceSaver.disable();
    return reply(boxWithFooter('ERROR', [{ raw: '❌ Anti-view-once désactivé.' }]));
  } else {
    const st = viewOnceSaver.status();
    return reply(boxWithFooter('ANTI-VIEW-ONCE', [
      { raw: `🔓 Anti-view-once: ${st.enabled ? '✅ activé' : '❌ désactivé'}` },
      { raw: 'Usage: .antiviewonce on/off' },
    ]));
  }
});
