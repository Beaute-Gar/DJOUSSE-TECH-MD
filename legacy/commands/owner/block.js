const { cmd } = require('../command.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
  pattern: 'block',
  desc: 'Bloque un utilisateur',
  category: 'owner',
  filename: __filename,
  fromMe: true,
}, async (conn, m, args, { from, reply, react }) => {
  let target;
  if (m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
    target = m.message.extendedTextMessage.contextInfo.mentionedJid[0];
  } else if (args.length > 0) {
    target = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
  } else {
    return reply(boxWithFooter('USAGE', [{ raw: 'Mentionne quelqu\'un ou écris le numéro.' }]));
  }
  try {
    await conn.updateBlockStatus(target, 'block');
    await react('🚫');
    return reply(boxWithFooter('SUCCÈS', [{ raw: 'Bloqué: ' + target.split('@')[0] }]));
  } catch {
    return reply(boxWithFooter('ERREUR', [{ raw: 'Impossible de bloquer cet utilisateur.' }]));
  }
});
