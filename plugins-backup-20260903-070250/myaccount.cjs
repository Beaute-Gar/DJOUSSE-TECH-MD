const { cmd } = require('../command.cjs');
const os = require('os');
const { runtime } = require('../lib/functions.cjs');
cmd({ pattern: 'myaccount', desc: 'Afficher les infos de ton compte', category: 'profile', filename: __filename }, async (conn, m, commands, config) => {
const user = m.sender;
const pp = await conn.profilePictureUrl(user, 'image').catch(() => '');
const name = m.pushName || user.split('@')[0];
const msg = `👤 Mon Compte\n\n📛 Nom: ${name}\n📱 Numéro: ${user.split('@')[0]}\n🆔 JID: ${user}\n📸 Photo: ${pp ? '✅' : '❌'}\n\n📊 Infos bot\n🕐 Uptime: ${runtime(process.uptime())}`;
if (m.isGroup) {
const meta = await conn.groupMetadata(m.chat).catch(() => null);
if (meta) msg += `\n👥 Groupe: ${meta.subject}`;
}
m.reply(msg);
});