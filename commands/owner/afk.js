const { cmd } = require('../command.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'afk',
  alias: [],
  desc: 'Mode AFK (absent)',
  category: 'owner',
  filename: __filename,
  fromMe: true,
}, async (conn, m, args, { from, reply, react }) => {
  const msg = args.length > 0 ? args.join(' ') : 'Je suis pas là.';
  await react('😴');
  return reply(boxWithFooter('AFK', ['Mode AFK activé.', 'Message: ' + msg]));
});
