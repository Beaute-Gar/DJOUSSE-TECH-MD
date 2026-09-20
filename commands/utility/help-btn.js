const { cmd } = require('../command.cjs');
const { sendButtons } = require('../lib/buttons/buttonSender');

cmd({
  pattern: 'help-btn',
  alias: ['helpbtn', 'hb'],
  desc: 'Aide en boutons',
  category: 'utility',
  filename: __filename,
}, async (conn, m, args, ctx) => {
  try {
    const jid = m.chat || ctx.from;

    await sendButtons(conn, jid, {
      title: 'AIDE',
      text: 'Commandes disponibles:\n\n/menu - Menu complet\n/ping - Test latence\n/info - Infos bot\n/menu-btn - Menu en boutons\n/ping-btn - Ping en boutons\n/info-btn - Infos en boutons',
      footer: 'DJOUSSE-TECH-MD',
      buttons: [
        { id: 'btn_back_menu', text: 'Menu' },
        { id: 'btn_info', text: 'Infos' }
      ],
      quoted: m
    });
  } catch (e) {
    console.error('[HELP-BTN]', e.message);
    ctx.reply('Erreur aide: ' + e.message);
  }
});
