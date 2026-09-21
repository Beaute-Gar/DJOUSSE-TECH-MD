const { cmd } = require('../command.cjs');
const { sendButtons } = require('../lib/buttons/buttonSender');

cmd({
  pattern: 'ping-btn',
  desc: 'Ping avec bouton relance',
  category: 'tool',
  filename: __filename,
}, async (conn, m, args, ctx) => {
  try {
    const jid = m.chat || ctx.from;
    const start = Date.now();
    await conn.sendMessage(jid, { text: 'Calcul...' });
    const latency = Date.now() - start;

    await sendButtons(conn, jid, {
      title: 'PING',
      text: `Pong !\n\nLatence: *${latency} ms*`,
      footer: 'DJOUSSE-TECH-MD',
      buttons: [
        { id: 'btn_ping_again', text: 'Relancer' },
        { id: 'btn_back_menu', text: 'Menu' }
      ],
      quoted: m
    });
  } catch (e) {
    console.error('[PING-BTN]', e.message);
    ctx.reply('Erreur ping: ' + e.message);
  }
});
