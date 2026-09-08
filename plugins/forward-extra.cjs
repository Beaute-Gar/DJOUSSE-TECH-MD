const { cmd } = require('../command.cjs');

cmd({
  pattern: 'forward',
  react: '📤',
  desc: 'Forward un message à des JIDs',
  category: 'owner',
  filename: __filename,
  fromMe: true,
}, async (conn, m, commands, { from, q, reply }) => {
  if (!q) return reply('❌ Utilisation:\n.forward <message>\n<jid1>\n<jid2>');
  const splitText = q.split('\n');
  const message = splitText[0];
  const jids = splitText.slice(1).map(jid => jid.trim()).filter(jid => jid.endsWith('@s.whatsapp.net'));
  if (jids.length === 0) return reply('❌ Aucun JID valide.');
  try {
    for (const jid of jids) await conn.sendMessage(jid, { text: message });
    reply('✅ Message envoyé à ' + jids.length + ' destinataire(s).');
  } catch (error) { reply('❌ Erreur lors de l\'envoi.'); }
});

cmd({
  pattern: 'getall',
  react: '👥',
  desc: 'Liste des membres du groupe',
  category: 'admin',
  filename: __filename,
  fromMe: true,
}, async (conn, m, commands, { from, reply }) => {
  if (!m.isGroup) return reply('❌ Groupe uniquement.');
  try {
    const groupMetadata = await conn.groupMetadata(from);
    const participants = groupMetadata.participants.map(p => p.id);
    reply('👥 *Membres (' + participants.length + '):*\n\n' + participants.join('\n'));
  } catch (error) { reply('❌ Erreur.'); }
});
