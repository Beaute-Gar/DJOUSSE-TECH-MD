const { cmd } = require('../command.cjs');
const { downloadMediaMessage } = require('../lib/msg.cjs');
cmd({ pattern: 'pp', desc: 'Afficher ou changer la photo de profil', category: 'profile', filename: __filename }, async (conn, m, commands, config) => {
const args = m.body.split(' ').slice(1);
const sub = args[0]?.toLowerCase();
const target = m.quoted ? m.quoted.sender : (m.mention ? m.mention[0] : (sub === 'me' ? m.sender : null));
if (target) {
try {
const ppUrl = await conn.profilePictureUrl(target, 'image');
return conn.sendMessage(m.chat, { image: { url: ppUrl }, caption: `🖼️ Photo de @${target.split('@')[0]}`, mentions: [target] }, { quoted: m });
} catch { return m.reply('❌ Pas de photo de profil.'); }
}
if (m.quoted?.msg?.imageMessage) {
const buffer = await downloadMediaMessage(m.quoted, 'pp');
if (!buffer) return m.reply('❌ Erreur téléchargement.');
await conn.updateProfilePicture(m.sender, buffer);
return m.reply('✅ Photo de profil mise à jour !');
}
m.reply('🖼️ Photo de profil\n\n.pp [@user] - Voir la photo\n.pp me - Voir ta photo\n(répondre à une image avec .pp) - Changer ta photo');
});