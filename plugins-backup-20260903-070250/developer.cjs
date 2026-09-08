const { cmd } = require('../command.cjs');

cmd({ pattern: 'developer', category: 'main', filename: __filename }, async (conn, m, commands, { q, reply }) => {
  try {
    const c = require('../config-djousse.cjs');
    const owner = c.BOT_OWNER || global.__sessionOwnerNumber || '';
    const uptime = process.uptime();
    const h = Math.floor(uptime / 3600), mi = Math.floor((uptime % 3600) / 60), s = Math.floor(uptime % 60);
    reply('👨‍💻 *Développeur DJOUSSE TECH*\n\n' +
      '🤖 Bot: ' + (c.BOT_NAME || 'DJOUSSE-TECH-MD') + '\n' +
      '👤 Owner: ' + owner + '\n' +
      '⏱️ Uptime: ' + h + 'h ' + mi + 'm ' + s + 's\n' +
      '💾 RAM: ' + Math.round(process.memoryUsage().rss / 1024 / 1024) + ' MB\n' +
      '📚 Commandes: ' + (Array.isArray(commands) ? commands.length : '?') + '\n\n' +
      '> © DJOUSSE TECH');
  } catch (e) {
    reply('❌ Erreur: ' + e.message);
  }
});
