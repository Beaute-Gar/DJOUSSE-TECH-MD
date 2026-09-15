const { cmd } = require('../command.cjs');
cmd({ pattern: 'label', desc: 'Gérer les labels des discussions', category: 'business', filename: __filename, fromMe: true }, async (conn, m, commands, config) => {
const labels = await conn.getLabels();
if (!labels || !labels.length) return m.reply('📭 Aucun label. Créez-en depuis WhatsApp Business.');
conn.sendMessage(m.chat, { text: '🏷️ Labels disponibles:\n' + labels.map(l => `- ${l.name} (${l.count || 0})`).join('\n') }, { quoted: m });
});