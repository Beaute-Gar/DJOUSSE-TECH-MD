const { cmd } = require('../command.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'hidetag',
  desc: 'Mentionne tous les membres (message caché)',
  category: 'group',
  filename: __filename,
  adminOnly: true,
  groupOnly: true,
}, async (conn, m, args, { from, reply }) => {
  try {
    const meta = await conn.groupMetadata(from);
    const participants = meta.participants || [];
    const mentions = participants.map(p => p.id);
    const text = args.join(' ') || ' ';
    await conn.sendMessage(from, { text: box('HIDETAG', [{ raw: text }]), mentions });
  } catch {
    return reply(boxWithFooter('ERROR', [{ raw: 'Impossible de récupérer la liste des membres.' }]));
  }
});
