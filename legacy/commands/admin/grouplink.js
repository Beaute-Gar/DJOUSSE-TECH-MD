const { cmd } = require('../command.cjs');
const { boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'grouplink',
  desc: 'Lien d\'invitation du groupe',
  category: 'group',
  filename: __filename,
  adminOnly: true,
  groupOnly: true,
  botAdminNeeded: true,
}, async (conn, m, args, { from, reply, react }) => {
  try {
    const code = await conn.groupInviteCode(from);
    const link = `https://chat.whatsapp.com/${code}`;
    await react('🔗');
    return reply(boxWithFooter('GROUP LINK', [{ raw: `Lien d'invitation:\n${link}` }]));
  } catch {
    return reply(boxWithFooter('ERROR', [{ raw: 'Impossible de récupérer le lien. Vérifie que le bot est admin.' }]));
  }
});
