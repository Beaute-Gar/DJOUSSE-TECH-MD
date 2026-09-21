const { cmd } = require('../command.cjs');
const { boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'goodbye',
  desc: 'Active/désactive les messages d\'au revoir',
  category: 'group',
  filename: __filename,
  adminOnly: true,
  groupOnly: true,
}, async (conn, m, args, { from, reply, react }) => {
  await react('👋');
  return reply(boxWithFooter('GOODBYE', [{ raw: "Messages d'au revoir activés." }]));
});
