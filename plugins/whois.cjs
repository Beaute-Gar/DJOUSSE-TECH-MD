const { cmd } = require('../command.cjs');
cmd({ pattern: 'whois', desc: 'Afficher les infos d\'un utilisateur', category: 'profile', filename: __filename }, async (conn, m, commands, config) => {
const user = m.quoted ? m.quoted.sender : (m.mention ? m.mention[0] : m.body.split(' ')[1]);
const jid = user ? (user.includes('@') ? user : `${user}@s.whatsapp.net`) : m.sender;
const name = m.pushName || jid.split('@')[0];
let msg = `👤 Whois\n\n📛 Nom: ${name}\n📱 Numéro: ${jid.split('@')[0]}\n🆔 JID: ${jid}`;
try {
const pp = await conn.profilePictureUrl(jid, 'image');
msg += `\n📸 Photo: ✅`;
if (m.isGroup) {
const meta = await conn.groupMetadata(m.chat);
const part = meta.participants.find(p => p.id === jid);
if (part) {
msg += `\n👑 Admin: ${part.admin === 'admin' ? '✅' : part.admin === 'superadmin' ? '🌟' : '❌'}`;
}
}
return m.replyImg({ url: pp }, msg, m.chat, { mentions: [jid] });
} catch { m.reply(msg, m.chat, { mentions: [jid] }); }
});