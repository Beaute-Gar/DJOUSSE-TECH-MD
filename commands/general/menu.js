const { cmd } = require('../command.cjs');
const { buildMainMenu } = require('../lib/buttons/menuBuilder');

cmd({
  pattern: 'interactive',
  desc: 'Menu interactif hybride boutons + saisie texte',
  category: 'general',
  filename: __filename,
}, async (conn, m, args, ctx) => {
  try {
    const jid = m.chat || ctx.from;
    await buildMainMenu(conn, jid, m, 1);
  } catch (e) {
    console.error('[MENU-INTERACTIF]', e.message);
    ctx.reply('Erreur menu interactif: ' + e.message);
  }
});
