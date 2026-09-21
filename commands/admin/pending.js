const { cmd } = require('../command.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'pending',
  desc: 'Liste les demandes d\'adhésion en attente',
  category: 'group',
  filename: __filename,
  adminOnly: true,
  groupOnly: true,
  botAdminNeeded: true,
}, async (conn, m, args, { from, reply, react }) => {
  try {
    const requests = await conn.groupRequestParticipantsList(from);
    if (!requests || requests.length === 0) return reply(boxWithFooter('PENDING', [{ raw: 'Aucune demande en attente.' }]));
    const lines = [{ raw: `Demandes en attente (${requests.length}):` }];
    for (const req of requests) {
      const num = req.jid ? req.jid.split('@')[0] : req.split('@')[0];
      lines.push({ raw: `@${num}` });
    }
    const mentions = requests.map(r => r.jid || r);
    await react('📋');
    await conn.sendMessage(from, { text: box('PENDING', lines), mentions });
  } catch {
    return reply(boxWithFooter('ERROR', [{ raw: 'Impossible de récupérer les demandes.' }]));
  }
});
