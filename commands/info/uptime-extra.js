const { cmd } = require('../command.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');;

cmd({
  pattern: 'alive',
  react: '⏱️',
  desc: 'Vérifier si le bot est en ligne',
  category: 'main',
  filename: __filename,
}, async (conn, m, commands, { from, reply }) => {
  const uptimeSeconds = process.uptime();
  const days = Math.floor(uptimeSeconds / (24 * 3600));
  const hours = Math.floor((uptimeSeconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = Math.floor(uptimeSeconds % 60);
  const mem = (process.memoryUsage().rss / 1048576).toFixed(1);
  conn.sendMessage(from, { text: box('⏱️ *BOT STATUS*', [
    { label: 'Bot', value: 'DJOUSSE-TECH-MD V2' },
    { label: 'Uptime', value: days + 'j ' + hours + 'h ' + minutes + 'm ' + seconds + 's' },
    { label: 'RAM', value: mem + ' MB' },
    { label: 'Statut', value: '🟢 Online & Ready' },
  ]) }, { quoted: m });
});
