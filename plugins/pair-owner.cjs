const { cmd } = require('../command.cjs');
const config = require('../config-djousse.cjs');

cmd({ pattern: 'bot_info', desc: 'Informations complètes du bot', category: 'owner', filename: __filename }, async (conn, m) => {
  const used = process.memoryUsage();
  const ram = (used.rss / 1024 / 1024).toFixed(2) + ' MB';
  const up = Math.floor(process.uptime());
  const d = Math.floor(up / 86400), h = Math.floor((up % 86400) / 3600), mm = Math.floor((up % 3600) / 60), s = up % 60;
  const info = [
    '╭───『 *🤖 DJOUSSE TECH* 』───●●►',
    `┃ *👤 Nom:* ${config.BOT_NAME}`,
    `┃ *👑 Owner:* ${config.OWNER_NAME}`,
    `┃ *📱 Owner ID:* ${config.BOT_OWNER}`,
    `┃ *🔧 Préfixe:* "${config.PREFIX}"`,
    `┃ *🔄 Mode:* ${process.env.MODE || config.MODE}`,
    `┃ *⏱️ Uptime:* ${d}d ${h}h ${mm}m ${s}s`,
    `┃ *💾 RAM:* ${ram}`,
    `┃ *🖥️ Node:* ${process.version}`,
    `┃ *📡 Platform:* ${process.platform}`,
    `┃ *🔋 Nombre commandes:* ${(require('../command.cjs').commands || []).length}`,
    '╰─────────────❖●►',
  ].join('\n');
  await conn.sendMessage(m.chat, { text: info }, { quoted: m });
});

cmd({ pattern: 'deleteme', desc: 'Supprimer le message du bot que tu viens de demander', category: 'owner', filename: __filename }, async (conn, m) => {
  if (!m.quoted) return m.reply('❌ Réponds au message du bot à supprimer.');
  try {
    await conn.sendMessage(m.chat, { delete: m.quoted.key });
  } catch (e) {
    m.reply('❌ Impossible de supprimer ce message.');
  }
});
