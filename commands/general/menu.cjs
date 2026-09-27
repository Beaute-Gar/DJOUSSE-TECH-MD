/**
 * menu.cjs — Point d'entrée unique du menu unifié (style numérique Unicode)
 * Affiche le menu principal via style.renderMainMenu(CATEGORIES).
 * La navigation se fait ensuite en tapant les numéros gérés par numberRouter.cjs.
 * DJOUSSE-TECH-MD
 */

const { cmd } = require('../command.cjs');
const style = require('../../lib/djousse-style.cjs');
const { setMainState } = require('./numberRouter.cjs');

// Catégories du menu — dirs = dossiers réels de commands/
const CATEGORIES = [
  { num: 1,  emoji: '📥', label: 'Download Menu',  dir: 'download' },
  { num: 2,  emoji: '📁', label: 'Fun Menu',       dir: 'fun' },
  { num: 3,  emoji: '👥', label: 'Group Menu',     dir: 'group' },
  { num: 4,  emoji: 'ℹ️', label: 'Info Menu',      dir: 'info' },
  { num: 5,  emoji: '🏠', label: 'Main Menu',      dir: 'main' },
  { num: 6,  emoji: '📁', label: 'Misc Menu',      dir: 'utility' },
  { num: 7,  emoji: '👑', label: 'Owner Menu',     dir: 'owner' },
  { num: 8,  emoji: '⚙️', label: 'Settings Menu',  dir: 'admin' },
  { num: 9,  emoji: '🛠️', label: 'Tools Menu',     dir: 'tools' },
  { num: 10, emoji: '🆕', label: 'New Cmds',       dir: 'ai' },
];

cmd({
  pattern: 'menu',
  desc: 'Menu principal (réponds avec un numéro)',
  category: 'MAIN',
  filename: __filename,
}, async (conn, m, args, ctx) => {
  try {
    const jid = m.chat || ctx.from;
    await conn.sendMessage(jid, { text: style.renderMainMenu(CATEGORIES) }, { quoted: m });
    setMainState(jid);
  } catch (e) {
    console.error('[MENU]', e.message);
    ctx.reply('⚠️ Erreur menu: ' + e.message);
  }
});

module.exports = { CATEGORIES };
