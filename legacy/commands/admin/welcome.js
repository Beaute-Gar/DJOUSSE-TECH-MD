const { cmd } = require('../command.cjs');
const { boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'welcome',
  desc: 'Active/désactive les messages de bienvenue',
  category: 'group',
  filename: __filename,
  adminOnly: true,
  groupOnly: true,
}, async (conn, m, args, { from, reply, react }) => {
  await react('👋');
  return reply(boxWithFooter('WELCOME', [{ raw: 'Messages de bienvenue activés. Nouveaux membres accueillis automatiquement.' }]));
});
