const { cmd } = require('../command.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'broadcast',
  desc: 'Envoie un message à tous les groupes',
  category: 'owner',
  filename: __filename,
  fromMe: true,
}, async (conn, m, args, { from, reply, react }) => {
  if (!args.length) return reply(boxWithFooter('USAGE', [{ raw: 'Écris le message à broadcaster.' }]));
  const text = args.join(' ');
  try {
    await react('📢');
    const groups = await conn.groupFetchAllParticipating();
    const groupIds = Object.keys(groups);
    let sent = 0;
    for (const gid of groupIds) {
      try {
        await conn.sendMessage(gid, { text: box('BROADCAST', ['📢 Broadcast', '', text]) });
        sent++;
        await new Promise(r => setTimeout(r, 2000));
      } catch {}
    }
    return reply(boxWithFooter('SUCCÈS', [{ raw: 'Message envoyé dans ' + sent + ' groupes.' }]));
  } catch {
    return reply(boxWithFooter('ERREUR', [{ raw: 'Erreur lors du broadcast...' }]));
  }
});
