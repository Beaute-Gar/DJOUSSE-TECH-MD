const { cmd } = require('../command.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'tagall',
  alias: ['everyone'],
  desc: 'Mentionne tous les membres du groupe',
  category: 'group',
  filename: __filename,
  adminOnly: true,
  groupOnly: true,
}, async (conn, m, args, { from, reply }) => {
  try {
    const meta = await conn.groupMetadata(from);
    const participants = meta.participants || [];
    const mentions = participants.map(p => p.id);
    const text = args.join(' ') || 'Appel général !';
    const lines = [{ raw: text }, { blank: true }];
    for (const p of participants) {
      lines.push({ raw: `@${p.id.split('@')[0]}` });
    }
    await conn.sendMessage(from, { text: box('TAGALL', lines), mentions });
  } catch {
    return reply(boxWithFooter('ERROR', [{ raw: 'Impossible de récupérer la liste des membres.' }]));
  }
});
