const { cmd } = require('../command.cjs');
const { downloadMediaMessage } = require('../lib/msg.cjs');
cmd({ pattern: 'contact', desc: 'Sauvegarder un contact (vCard)', category: 'communication', filename: __filename }, async (conn, m, commands, config) => {
const args = m.body.split(' ').slice(1);
const name = args[0] || 'Contact';
const number = m.quoted ? m.quoted.sender : (args[1] || m.sender);
const jid = number.includes('@') ? number : `${number}@s.whatsapp.net`;
const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL;type=CELL;type=VOICE;waid=${jid.split('@')[0]}:+${jid.split('@')[0]}\nEND:VCARD`;
await conn.sendMessage(m.chat, { contacts: { displayName: name, contacts: [{ vcard }] } }, { quoted: m });
});