/**
 * Constructeur de menus interactifs - Version NATIVE FLOW
 * Utilise single_select pour afficher jusqu'à 10 boutons
 * Types : A = direct, B = saisie texte, C = envoi fichier
 * DJOUSSE-TECH-MD
 */

const { sendButtons, sendInteractiveMessage, fallbackText, isPrivate, isGroup } = require('./buttonSender');
const sessionManager = require('./sessionManager');
const menuConfig = require('./menuConfig');

const ITEMS_PER_PAGE = 10;

function paginate(items, page) {
  const total = Math.ceil(items.length / ITEMS_PER_PAGE);
  const start = (page - 1) * ITEMS_PER_PAGE;
  const slice = items.slice(start, start + ITEMS_PER_PAGE);
  return {
    items: slice,
    page,
    total,
    hasNext: page < total,
    hasPrev: page > 1,
    startIndex: start
  };
}

function typeIcon(type) {
  if (type === 'B') return ' ✏️';
  if (type === 'C') return ' 📎';
  return '';
}

// ═══════════════════════════════════════════════════════════
// NIVEAU 1 : Menu principal (catégories)
// ═══════════════════════════════════════════════════════════
async function buildMainMenu(sock, jid, quoted, page = 1) {
  const cats = menuConfig.categories;
  const { items, total, hasNext, hasPrev } = paginate(cats, page);

  const text = `👋 *MENU PRINCIPAL*\n\nChoisissez une catégorie :\n_Page ${page}/${total}_`;

  // ── Si ≤3 catégories et 1 seule page → boutons simples ──
  if (items.length <= 3 && total === 1) {
    const buttons = items.map(c => ({ id: c.id, text: c.label }));
    return sendButtons(sock, jid, {
      title: '👋 MENU PRINCIPAL',
      text,
      footer: 'DJOUSSE-TECH-MD',
      buttons,
      quoted
    });
  }

  // ── Sinon → single_select (jusqu'à 10 catégories) ──
  const rows = items.map(c => ({
    title: c.label,
    description: `${c.commands.length} commande(s)`,
    id: c.id
  }));

  const sections = [{ title: '📂 Catégories', rows }];

  if (hasNext || hasPrev) {
    const navRows = [];
    if (hasPrev) navRows.push({ title: '◀️ Page précédente', description: 'Revenir en arrière', id: `page_main_${page - 1}` });
    if (hasNext) navRows.push({ title: '▶️ Page suivante', description: 'Voir plus de catégories', id: `page_main_${page + 1}` });
    navRows.push({ title: '❓ Aide', description: 'Comment utiliser le menu', id: 'btn_help' });
    sections.push({ title: '🧭 Navigation', rows: navRows });
  }

  sessionManager.setMenuContext(jid, {
    type: 'main',
    page,
    items: items.map((c, i) => ({
      num: (page - 1) * ITEMS_PER_PAGE + i + 1,
      id: c.id,
      label: c.label
    }))
  });

  try {
    await sendInteractiveMessage(sock, jid, {
      text,
      footer: 'DJOUSSE-TECH-MD',
      interactiveButtons: [{
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
          title: '📂 Voir les catégories',
          sections
        })
      }],
      quoted
    });
  } catch (e) {
    console.error('[MENU] single_select échoué, fallback:', e.message);
    const fallbackBtns = items.slice(0, 3).map(c => ({ id: c.id, text: c.label }));
    if (hasNext) fallbackBtns.push({ id: `page_main_${page + 1}`, text: '▶️ Suivant' });
    await sendButtons(sock, jid, {
      title: '👋 MENU PRINCIPAL',
      text,
      footer: 'DJOUSSE-TECH-MD',
      buttons: fallbackBtns.slice(0, 3),
      quoted
    });
  }
}

// ═══════════════════════════════════════════════════════════
// NIVEAU 2 : Catégorie (commandes)
// ═══════════════════════════════════════════════════════════
async function buildCategoryMenu(sock, jid, categoryId, page = 1, quoted) {
  const cat = menuConfig.categories.find(c => c.id === categoryId);
  if (!cat) {
    return sock.sendMessage(jid, { text: '❌ Catégorie introuvable.' }, { quoted });
  }

  const { items, total, hasNext, hasPrev } = paginate(cat.commands, page);

  const text = `${cat.emoji || '📂'} *${cat.label}*\n\nChoisissez une commande :\n_Page ${page}/${total}_`;

  // ── Si ≤3 commandes et 1 seule page → boutons simples ──
  if (items.length <= 3 && total === 1) {
    const buttons = items.map(c => ({ id: c.id, text: c.label }));
    return sendButtons(sock, jid, {
      title: cat.label,
      text,
      footer: 'DJOUSSE-TECH-MD',
      buttons,
      quoted
    });
  }

  // ── Sinon → single_select (jusqu'à 10 commandes) ──
  const rows = items.map(c => ({
    title: c.label,
    description: c.prompt ? c.prompt.substring(0, 60) : `Commande ${c.type}`,
    id: c.id
  }));

  const sections = [{ title: `${cat.emoji || '📂'} ${cat.label}`, rows }];

  const navRows = [];
  if (hasPrev) navRows.push({ title: '◀️ Page précédente', description: 'Revenir en arrière', id: `page_cat_${categoryId}_${page - 1}` });
  if (hasNext) navRows.push({ title: '▶️ Page suivante', description: 'Voir plus de commandes', id: `page_cat_${categoryId}_${page + 1}` });
  navRows.push({ title: '🏠 Menu principal', description: 'Retour au menu', id: 'back_menu' });
  sections.push({ title: '🧭 Navigation', rows: navRows });

  sessionManager.setMenuContext(jid, {
    type: 'category',
    categoryId,
    page,
    items: items.map((c, i) => ({
      num: (page - 1) * ITEMS_PER_PAGE + i + 1,
      id: c.id,
      label: c.label,
      commandId: c.id
    }))
  });

  try {
    await sendInteractiveMessage(sock, jid, {
      text,
      footer: 'DJOUSSE-TECH-MD',
      interactiveButtons: [{
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
          title: `${cat.emoji || '📂'} Voir les commandes`,
          sections
        })
      }],
      quoted
    });
  } catch (e) {
    console.error('[MENU] single_select catégorie échoué:', e.message);
    const fallbackBtns = items.slice(0, 3).map(c => ({ id: c.id, text: c.label }));
    if (hasNext) fallbackBtns.push({ id: `page_cat_${categoryId}_${page + 1}`, text: '▶️ Suivant' });
    await sendButtons(sock, jid, {
      title: cat.label,
      text,
      footer: 'DJOUSSE-TECH-MD',
      buttons: fallbackBtns.slice(0, 3),
      quoted
    });
  }
}

// ═══════════════════════════════════════════════════════════
// NIVEAU 3 : Exécution selon le TYPE
// ═══════════════════════════════════════════════════════════
async function handleCommandClick(sock, jid, message, commandId) {
  const cmd = findCommandById(commandId);
  if (!cmd) {
    return sendButtons(sock, jid, {
      title: '⚠️ ERREUR',
      text: `Commande *${commandId}* introuvable.`,
      footer: 'DJOUSSE-TECH-MD',
      buttons: [{ id: 'back_menu', text: '🏠 Menu' }],
      quoted: message
    });
  }

  const cmdName = commandId.replace('cmd_', '');

  if (cmd.type === 'A') {
    try {
      const fakeMsg = {
        ...message,
        message: {
          extendedTextMessage: {
            text: `.${cmdName}`,
            contextInfo: message.message?.extendedTextMessage?.contextInfo || {}
          }
        }
      };
      const args = [];
      const ctx = {
        from: jid,
        sender: message.key.participant || jid,
        isGroup: isGroup(jid),
        isPrivate: isPrivate(jid),
        isOwner: false,
        isAdmin: false,
        isBotAdmin: false,
        conn: sock
      };

      const { commandMap } = require('../../command.cjs');
      const cmdObj = commandMap.get(cmdName);
      if (cmdObj && cmdObj.execute) {
        return await cmdObj.execute(sock, fakeMsg, args, ctx);
      }

      return sock.sendMessage(jid, {
        text: `Exécutez .${cmdName} en tapant la commande.`
      }, { quoted: message });
    } catch (e) {
      console.error(`[MENU] Erreur TYPE A ${cmdName}:`, e.message);
      return sock.sendMessage(jid, {
        text: `❌ Erreur: ${e.message}\nTapez .${cmdName} manuellement.`
      }, { quoted: message });
    }
  }

  if (cmd.type === 'B') {
    sessionManager.setWaiting(jid, commandId, 'waiting_input');
    const prompt = cmd.prompt || `✏️ Envoyez le texte pour *${cmd.label}* :`;
    return sendButtons(sock, jid, {
      title: cmd.label,
      text: prompt,
      footer: '⏱️ Vous avez 5 minutes pour répondre',
      buttons: [
        { id: 'cancel_wait', text: '❌ Annuler' },
        { id: 'back_menu', text: '🏠 Menu' }
      ],
      quoted: message
    });
  }

  if (cmd.type === 'C') {
    sessionManager.setWaiting(jid, commandId, 'waiting_file');
    const prompt = cmd.prompt || `📎 Envoyez un fichier pour *${cmd.label}* :`;
    return sendButtons(sock, jid, {
      title: cmd.label,
      text: prompt,
      footer: '⏱️ Vous avez 5 minutes pour envoyer',
      buttons: [
        { id: 'cancel_wait', text: '❌ Annuler' },
        { id: 'back_menu', text: '🏠 Menu' }
      ],
      quoted: message
    });
  }

  return sock.sendMessage(jid, {
    text: `❌ Type de commande inconnu: ${cmd.type}`
  }, { quoted: message });
}

function findCommandById(cmdId) {
  for (const cat of menuConfig.categories) {
    const cmd = cat.commands.find(c => c.id === cmdId);
    if (cmd) return { ...cmd, category: cat };
  }
  return null;
}

module.exports = {
  buildMainMenu,
  buildCategoryMenu,
  handleCommandClick,
  findCommandById,
  paginate,
  ITEMS_PER_PAGE
};
