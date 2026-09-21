const { cmd } = require('../command.cjs');
const { sendButtons } = require('../lib/buttons/buttonSender');

cmd({
  pattern: 'info-btn',
  desc: 'Informations du bot en boutons',
  category: 'info',
  filename: __filename,
}, async (conn, m, args, ctx) => {
  try {
    const jid = m.chat || ctx.from;
    const uptime = process.uptime();
    const h = Math.floor(uptime / 3600);
    const m2 = Math.floor((uptime % 3600) / 60);
    const mem = (process.memoryUsage().rss / 1048576).toFixed(1);

    await sendButtons(conn, jid, {
      title: 'INFORMATIONS',
      text: `*DJOUSSE-TECH-MD*\n\nVersion: 3.1.0\nUptime: ${h}h ${m2}m\nRAM: ${mem} MB\nStatut: En ligne`,
      footer: 'DJOUSSE-TECH-MD',
      buttons: [
        { id: 'btn_support', text: 'Support' },
        { id: 'btn_channel', text: 'Canal' },
        { id: 'btn_back_menu', text: 'Menu' }
      ],
      quoted: m
    });
  } catch (e) {
    console.error('[INFO-BTN]', e.message);
    ctx.reply('Erreur info: ' + e.message);
  }
});
