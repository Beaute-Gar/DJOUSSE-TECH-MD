/**
 * Routeur des clics sur boutons du menu
 * Gère la navigation entre niveaux
 * DJOUSSE-TECH-MD
 */

const menuConfig = require('./menuConfig');
const { buildMainMenu, buildCategoryMenu, buildCommandPreview } = require('./menuBuilder');
const { sendButtons } = require('./buttonSender');

function findCommandById(cmdId) {
  for (const cat of menuConfig.categories) {
    const cmd = cat.commands.find(c => c.id === cmdId);
    if (cmd) return { ...cmd, category: cat };
  }
  return null;
}

function isMenuButton(buttonId) {
  return (
    buttonId.startsWith('cat_') ||
    buttonId.startsWith('cmd_') ||
    buttonId.startsWith('page_') ||
    buttonId.startsWith('back_') ||
    buttonId === 'back_menu' ||
    buttonId === 'btn_help' ||
    buttonId === 'btn_back_menu'
  );
}

async function routeMenuClick(sock, message, buttonId) {
  const jid = message.key.remoteJid;

  // Menu principal (page)
  if (buttonId.startsWith('page_main_')) {
    const page = parseInt(buttonId.split('_')[2]) || 1;
    return buildMainMenu(sock, jid, message, page);
  }

  // Catégorie (niveau 1 -> 2)
  if (buttonId.startsWith('cat_')) {
    return buildCategoryMenu(sock, jid, buttonId, 1, message);
  }

  // Pagination catégorie
  if (buttonId.startsWith('page_cat_')) {
    const parts = buttonId.split('_');
    const catId = parts[2];
    const page = parseInt(parts[3]) || 1;
    return buildCategoryMenu(sock, jid, catId, page, message);
  }

  // Commande (niveau 2 -> exécution)
  if (buttonId.startsWith('cmd_')) {
    const cmd = findCommandById(buttonId);
    if (!cmd) return unknownOption(sock, jid, message, buttonId);

    // Construire le nom de la commande pour le prefix
    const cmdName = cmd.alias ? cmd.alias[0] : buttonId.replace('cmd_', '');

    try {
      await sendButtons(sock, jid, {
        title: cmd.label,
        text: `*${cmd.label}*\n\nExécution de .${cmdName}...\n\nTapez .${cmdName} pour plus d'options.`,
        footer: 'DJOUSSE-TECH-MD',
        buttons: [
          { id: `cmd_${cmdName}`, text: `▶️ .${cmdName}` },
          { id: `back_cat_${cmd.category.id}`, text: '◀️ Retour' },
          { id: 'back_menu', text: '🏠 Menu' }
        ],
        quoted: message
      });
    } catch (e) {
      console.error('[MENU] Erreur exécution commande:', e.message);
      await sock.sendMessage(jid, {
        text: `Erreur: ${e.message}\nTapez .${cmdName} manuellement.`
      }, { quoted: message });
    }
    return true;
  }

  // Retour menu principal
  if (buttonId === 'back_menu' || buttonId === 'btn_back_menu') {
    return buildMainMenu(sock, jid, message, 1);
  }

  // Retour catégorie
  if (buttonId.startsWith('back_cat_')) {
    const catId = buttonId.replace('back_', '');
    return buildCategoryMenu(sock, jid, catId, 1, message);
  }

  // Aide
  if (buttonId === 'btn_help') {
    return sendButtons(sock, jid, {
      title: '❓ AIDE',
      text: 'Comment utiliser le menu :\n\n1. Cliquez sur une catégorie\n2. Choisissez une commande\n3. La commande s\'exécute',
      footer: 'DJOUSSE-TECH-MD',
      buttons: [
        { id: 'back_menu', text: '🏠 Menu' }
      ],
      quoted: message
    });
  }

  // Id inconnu
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
