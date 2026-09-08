const { cmd } = require('../command.cjs');
cmd({ pattern: 'disappear', desc: 'Définir la durée des messages éphémères', category: 'group', filename: __filename, fromMe: true }, async (conn, m, commands, config) => {
if (!m.isGroup) return m.reply('❌ Commande réservée aux groupes.');
const args = m.body.split(' ').slice(1);
const dur = parseInt(args[0]);
const valid = [0, 86400, 604800, 7776000];
if (!valid.includes(dur)) return m.reply('❌ Durées valides:\n0 = désactivé\n86400 = 24h\n604800 = 7 jours\n7776000 = 90 jours');
await conn.groupToggleEphemeral(m.chat, dur);
const labels = {0:'❌ Désactivé',86400:'⏳ 24h',604800:'⏳ 7 jours',7776000:'⏳ 90 jours'};
conn.sendMessage(m.chat, { text: `✅ Messages éphémères: ${labels[dur] || dur}` }, { quoted: m });
});