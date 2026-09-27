const { cmd } = require('../command.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');
cmd({ pattern: 'delete', desc: 'Supprimer le message du bot (répondre au message)', category: 'moderation', filename: __filename, fromMe: true }, async (conn, m, commands, config) => {
if (!m.quoted) return m.reply(boxWithFooter('ERREUR', [{ raw: '❌ Réponds au message du bot à supprimer.' }]));
const key = { remoteJid: m.chat, fromMe: m.quoted.fromMe, id: m.quoted.id, participant: m.quoted.sender };
await conn.sendMessage(m.chat, { delete: key });
});