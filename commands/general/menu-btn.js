const { cmd } = require('../command.cjs');
const { sendButtons } = require('../lib/buttons/buttonSender');

cmd({
  pattern: 'menu-btn',
  alias: ['mb', 'menubtn'],
  desc: 'Menu principal en boutons',
  category: 'general',
  filename: __filename,
}, async (conn, m, args, ctx) => {
  try {
    const jid = m.chat || ctx.from;
    await sendButtons(conn, jid, {
      title: 'MENU PRINCIPAL',
      text: 'Choisissez une option:',
      footer: 'DJOUSSE-TECH-MD',
      buttons: [
        { id: 'btn_ping', text: 'Ping' },
        { id: 'btn_info', text: 'Infos' },
        { id: 'btn_site', text: 'Site' }
      ],
      quoted: m
    });
  } catch (e) {
    console.error('[MENU-BTN]', e.message);
    ctx.reply('Erreur menu boutons: ' + e.message);
  }
});
