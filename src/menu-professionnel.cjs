/**
 * Menu Professionnel — DJOUSSE-TECH-MD
 *
 * Menu principal « premium » à boutons de catégories (namespace d'id séparé
 * de menu-interactif.cjs : « mpro: » au lieu de « menucmd: », pour ne jamais
 * se marcher dessus). C'est pour cela qu'index.cjs appelle handleMenuClick()
 * AVANT gererClicBouton()/gererMenuListe() : chacun ignore (return false) ce
 * qui ne le concerne pas, et laisse la main au suivant.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * RÈGLE DE ROUTING : `m` est l'objet déjà résolu par sms() (m.chat/m.sender/
 * m.reply). On ne recalcule JAMAIS la destination depuis autre chose que m.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Usage dans index.cjs :
 *   const { sendMainMenu, handleMenuClick } = require('./src/menu-professionnel.cjs');
 *   const menuClicked = await handleMenuClick(sock, m);   // m, PAS msg
 */

const BTN_PREFIX = 'mpro:';

/* Catégories mises en avant dans le menu principal. Doivent correspondre
   aux valeurs de `category` utilisées dans command.cjs (CATEGORY_FIX). */
const CATEGORIES_PRINCIPALES = [
  { id: 'download', label: '📥 TÉLÉCHARGEMENT' },
  { id: 'ai', label: '🤖 IA' },
  { id: 'anime', label: '🎌 ANIME' },
  { id: 'fun', label: '🎉 FUN' },
  { id: 'tools', label: '🧰 OUTILS' },
  { id: 'group', label: '👥 GROUPE' },
  { id: 'owner', label: '👑 OWNER' },
];

/**
 * Envoie le menu principal à boutons dans le chat d'origine (m.chat).
 * À appeler depuis la commande .menu existante, ex :
 *   const { sendMainMenu } = require('../src/menu-professionnel.cjs');
 *   cmd({ pattern: 'menu', ... }, async (conn, m) => sendMainMenu(conn, m));
 */
async function sendMainMenu(sock, m) {
  const buttons = CATEGORIES_PRINCIPALES.map(cat => ({
    buttonId: BTN_PREFIX + cat.id,
    buttonText: { displayText: cat.label },
    type: 1,
  }));

  return sock.sendMessage(m.chat, {
    text:
      '👑 *MENU PRINCIPAL — DJOUSSE TECH EVOLUTION*\n\n' +
      'Choisis une catégorie ci-dessous, ou tape *.menu2* pour la liste complète.',
    footer: 'ᴀɪɴᴏʀɪᴀ ᴀɪ — ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴅᴊᴏᴜꜱꜱᴇ ᴛᴇᴄʜ',
    buttons,
    headerType: 1,
  }, { quoted: m });
}

/**
 * Intercepte les clics sur les boutons du menu principal (préfixe « mpro: »).
 * Retourne false si le clic ne concerne pas ce module (laisse la main à
 * gererClicBouton()/gererMenuListe() dans index.cjs).
 */
async function handleMenuClick(sock, m) {
  try {
    let selectedId = '';
    if (m.type === 'buttonsResponseMessage') {
      selectedId = m.message?.buttonsResponseMessage?.selectedButtonId || '';
    } else if (m.type === 'templateButtonReplyMessage') {
      selectedId = m.message?.templateButtonReplyMessage?.selectedId || '';
    }
    if (!selectedId.startsWith(BTN_PREFIX)) return false;

    const cat = selectedId.slice(BTN_PREFIX.length);
    const COMMANDES = require('../command.cjs');
    const list = (COMMANDES?.commands || []).filter(
      c => c && !c.dontAddCommandList && String(c.category || 'misc').toLowerCase() === cat
    );

    if (!list.length) {
      await m.reply(`❌ Aucune commande trouvée dans la catégorie « ${cat} ».`).catch(() => {});
      return true;
    }

    const lines = list.map(c => `▫️ .${c.pattern}${c.desc ? ' — ' + c.desc : ''}`).join('\n');
    /* m.reply() cible TOUJOURS m.chat (déjà résolu) — jamais un autre chat. */
    await m.reply(`📂 *${cat.toUpperCase()}*\n\n${lines}`).catch(() => {});
    return true;
  } catch (e) {
    console.error('❌ [MENU-PRO] handleMenuClick:', e.message);
    return false;
  }
}

module.exports = { sendMainMenu, handleMenuClick, CATEGORIES_PRINCIPALES };
