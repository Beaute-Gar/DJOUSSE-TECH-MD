const { cmd } = require('../command.cjs');
cmd({ pattern: 'vcf', desc: 'Générer un fichier vCard/vCF de contacts', category: 'utility', filename: __filename }, async (conn, m, commands, config) => {
const args = m.body.split(' ').slice(1);
const contacts = args.join(' ').split(',').filter(c => c.trim());
if (!contacts.length && !m.mention) return conn.sendMessage(m.chat, { text: '❌ Usage: .vcf nom1,numéro1, nom2,numéro2\nOu mentionne des utilisateurs.' }, { quoted: m });
let vcards = '';
if (m.mention) {
for (const jid of m.mention) {
const name = m.pushName || jid.split('@')[0];
vcards += `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL;type=CELL;type=VOICE;waid=${jid.split('@')[0]}:+${jid.split('@')[0]}\nEND:VCARD\n`;
}
}
contacts.forEach(c => {
const [name, num] = c.split(',').map(s => s.trim());
if (name && num) {
vcards += `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL;type=CELL;type=VOICE;waid=${num}:+${num}\nEND:VCARD\n`;
}
});
if (!vcards) return m.reply('❌ Aucun contact valide.');
const fs = require('fs');
const path = `./database/${Date.now()}.vcf`;
fs.writeFileSync(path, vcards);
conn.sendMessage(m.chat, { document: fs.readFileSync(path), mimetype: 'text/vcard', fileName: 'contacts.vcf', caption: `✅ ${vcards.split('END:VCARD').length - 1} contact(s)` }, { quoted: m });
});