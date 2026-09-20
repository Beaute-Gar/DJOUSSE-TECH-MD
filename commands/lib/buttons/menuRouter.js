/**
 * Routeur des clics sur boutons du menu
 * Navigation + exécution selon type A/B/C
 * DJOUSSE-TECH-MD
 */

const menuConfig = require('./menuConfig');
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

  // ── Annulation d'attente ──
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

  // ── Menu principal (page) ──
  if (buttonId.startsWith('page_main_')) {
    const page = parseInt(buttonId.split('_')[2]) || 1;
    return buildMainMenu(sock, jid, message, page);
  }

  // ── Catégorie (niveau 1 → 2) ──
  if (buttonId.startsWith('cat_')) {
    return buildCategoryMenu(sock, jid, buttonId, 1, message);
  }

  // ── Pagination catégorie ──
  if (buttonId.startsWith('page_cat_')) {
    const parts = buttonId.split('_');
    const catId = parts[2];
    const page = parseInt(parts[3]) || 1;
    return buildCategoryMenu(sock, jid, catId, page, message);
  }

  // ── Commande (niveau 2 → 3 / exécution) ──
  if (buttonId.startsWith('cmd_')) {
    return handleCommandClick(sock, jid, message, buttonId);
  }

  // ── Retour menu principal ──
  if (buttonId === 'back_menu' || buttonId === 'btn_back_menu') {
    sessionManager.clear(jid);
    return buildMainMenu(sock, jid, message, 1);
  }

  // ── Retour catégorie ──
  if (buttonId.startsWith('back_cat_')) {
    const catId = buttonId.replace('back_', '');
    return buildCategoryMenu(sock, jid, catId, 1, message);
  }

  // ── Aide ──
  if (buttonId === 'btn_help') {
    return sendButtons(sock, jid, {
      title: '❓ AIDE',
      text: '*Comment utiliser le menu :*\n\n1️⃣ Cliquez sur une *catégorie*\n2️⃣ Choisissez une *commande*\n3️⃣ Pour les commandes qui le nécessitent :\n   → Envoyez un *lien*, un *texte* ou un *fichier*\n\n⏱️ Les sessions expirent après 5 minutes.',
      footer: 'DJOUSSE-TECH-MD',
      buttons: [
        { id: 'back_menu', text: '🏠 Menu' }
      ],
      quoted: message
    });
  }

  // ── Id inconnu ──
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
