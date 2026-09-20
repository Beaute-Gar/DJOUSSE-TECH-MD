/**
 * Routeur des clics sur boutons du menu
 * Navigation + exécution selon type A/B/C
 * DJOUSSE-TECH-MD
 */

const sessionManager = require('./sessionManager');
const { buildMainMenu, buildCategoryMenu, handleCommandClick, findCommandById } = require('./menuBuilder');
const { sendButtons } = require('./buttonSender');

function isMenuButton(buttonId) {
  return (
    buttonId.startsWith('cat_') ||
    buttonId.startsWith('cmd_') ||
    buttonId.startsWith('page_') ||
    buttonId.startsWith('back_') ||
    buttonId === 'back_menu' ||
    buttonId === 'btn_help' ||
    buttonId === 'btn_back_menu' ||
    buttonId === 'cancel_wait'
  );
}

async function routeMenuClick(sock, message, buttonId) {
  const jid = message.key.remoteJid;

  if (buttonId === 'cancel_wait') {
    sessionManager.clear(jid);
    return sendButtons(sock, jid, {
      title: '❌ ANNULÉ',
      text: 'Action annulée.',
      footer: 'DJOUSSE-TECH-MD',
      buttons: [{ id: 'back_menu', text: '🏠 Menu' }],
      quoted: message
    });
  }

  if (buttonId.startsWith('page_main_')) {
    const page = parseInt(buttonId.split('_')[2]) || 1;
    return buildMainMenu(sock, jid, message, page);
  }

  if (buttonId.startsWith('cat_')) {
    return buildCategoryMenu(sock, jid, buttonId, 1, message);
  }

  if (buttonId.startsWith('page_cat_')) {
    const parts = buttonId.split('_');
    const catId = parts[2];
    const page = parseInt(parts[3]) || 1;
    return buildCategoryMenu(sock, jid, catId, page, message);
  }

  if (buttonId.startsWith('cmd_')) {
    return handleCommandClick(sock, jid, message, buttonId);
  }

  if (buttonId === 'back_menu' || buttonId === 'btn_back_menu') {
    sessionManager.clear(jid);
    return buildMainMenu(sock, jid, message, 1);
  }

  if (buttonId.startsWith('back_cat_')) {
    const catId = buttonId.replace('back_', '');
    return buildCategoryMenu(sock, jid, catId, 1, message);
  }

  if (buttonId === 'btn_help') {
    return sendButtons(sock, jid, {
      title: '❓ AIDE',
      text: `*Comment utiliser le menu :*

1️⃣ Cliquez un *bouton* ou tapez un *numéro*
2️⃣ Pour les commandes ✏️ : envoyez un *texte*
3️⃣ Pour les commandes 📎 : envoyez un *fichier*

⏱️ Les sessions expirent après 5 minutes.`,
      footer: 'DJOUSSE-TECH-MD',
      buttons: [
        { id: 'back_menu', text: '🏠 Menu' }
      ],
      quoted: message
    });
  }

  return unknownOption(sock, jid, message, buttonId);
}

async function unknownOption(sock, jid, message, buttonId) {
  await sendButtons(sock, jid, {
    title: '⚠️ INCONNU',
    text: `Option inconnue: *${buttonId}*\n\nRevenez au menu principal.`,
    footer: 'DJOUSSE-TECH-MD',
    buttons: [
      { id: 'back_menu', text: '🏠 Menu' }
    ],
    quoted: message
  });
  return true;
}

module.exports = {
  routeMenuClick,
  isMenuButton,
  findCommandById
};
