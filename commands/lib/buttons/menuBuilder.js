/**
 * Constructeur de menus interactifs HYBRIDES
 * Texte (toutes les commandes) + Boutons (navigation)
 * Types : A = direct, B = saisie texte, C = envoi fichier
 * DJOUSSE-TECH-MD
 */

const { sendButtons, fallbackText, isPrivate, isGroup } = require('./buttonSender');
const sessionManager = require('./sessionManager');
const menuConfig = require('./menuConfig');

const ITEMS_PER_PAGE = 8;

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

// ═══════════════════════════════════════════════════════════
// NIVEAU 1 : Menu principal (catégories)
// ═══════════════════════════════════════════════════════════
async function buildMainMenu(sock, jid, quoted, page = 1) {
  const cats = menuConfig.categories;
  const { items, total, hasNext, hasPrev, startIndex } = paginate(cats, page);

  const lines = [];
  lines.push('👋 *MENU PRINCIPAL*');
  lines.push('');
  items.forEach((c, i) => {
    const num = startIndex + i + 1;
    lines.push(`*${num}.* ${c.label}`);
  });
  lines.push('');
  lines.push(`_Page ${page}/${total}_`);
  lines.push('');
  lines.push('👉 Cliquez un *bouton* ou tapez un *numéro*');

  const nav = [];
  if (hasPrev) nav.push({ id: `page_main_${page - 1}`, text: '◀️ Préc' });
  if (hasNext) nav.push({ id: `page_main_${page + 1}`, text: '▶️ Suivant' });
  nav.push({ id: 'btn_help', text: '❓ Aide' });

  let finalButtons;
  if (nav.length === 1) {
    finalButtons = items.slice(0, 3).map(c => ({ id: c.id, text: c.label }));
  } else {
    finalButtons = nav.slice(0, 3);
  }

  sessionManager.setMenuContext(jid, {
    type: 'main',
    page,
    items: items.map((c, i) => ({
      num: startIndex + i + 1,
      id: c.id,
      label: c.label
    }))
  });

  try {
    await sendButtons(sock, jid, {
      title: '👋 MENU PRINCIPAL',
      text: lines.join('\n'),
      footer: 'DJOUSSE-TECH-MD',
      buttons: finalButtons,
      quoted
    });
  } catch (e) {
    console.error('[MENU] Erreur buildMainMenu:', e.message);
    await fallbackText(sock, jid, {
      title: 'MENU PRINCIPAL',
      text: lines.join('\n'),
      footer: 'DJOUSSE-TECH-MD',
      buttons: []
    });
  }
}

// ═══════════════════════════════════════════════════════════
// NIVEAU 2 : Catégorie (commandes)
// ═══════════════════════════════════════════════════════════
async function buildCategoryMenu(sock, jid, categoryId, page = 1, quoted) {
  const cat = menuConfig.categories.find(c => c.id === categoryId);
  if (!cat) {
    return sock.sendMessage(jid, { text: 'Catégorie introuvable.' }, { quoted });
  }

  const { items, total, hasNext, hasPrev, startIndex } = paginate(cat.commands, page);

  const lines = [];
  lines.push(`${cat.emoji || '📂'} *${cat.label}*`);
  lines.push('');
  items.forEach((c, i) => {
    const num = startIndex + i + 1;
    const typeIcon = c.type === 'B' ? ' ✏️' : c.type === 'C' ? ' 📎' : '';
    lines.push(`*${num}.* ${c.label}${typeIcon}`);
  });
  lines.push('');
  lines.push(`_Page ${page}/${total}_`);
  lines.push('');
  lines.push('✏️ = saisie texte • 📎 = envoi fichier');
  lines.push('👉 Cliquez un *bouton* ou tapez un *numéro*');

  const nav = [];
  if (hasPrev) nav.push({ id: `page_cat_${categoryId}_${page - 1}`, text: '◀️ Préc' });
  if (hasNext) nav.push({ id: `page_cat_${categoryId}_${page + 1}`, text: '▶️ Suivant' });
  nav.push({ id: 'back_menu', text: '🏠 Menu' });

  let finalButtons;
  if (total === 1 && items.length >= 3) {
    finalButtons = items.slice(0, 3).map(c => ({ id: c.id, text: c.label }));
  } else {
    finalButtons = nav.slice(0, 3);
  }

  sessionManager.setMenuContext(jid, {
    type: 'category',
    categoryId,
    page,
    items: items.map((c, i) => ({
      num: startIndex + i + 1,
      id: c.id,
      label: c.label,
      commandId: c.id
    }))
  });

  try {
    await sendButtons(sock, jid, {
      title: cat.label,
      text: lines.join('\n'),
      footer: 'DJOUSSE-TECH-MD',
      buttons: finalButtons,
      quoted
    });
  } catch (e) {
    console.error('[MENU] Erreur buildCategoryMenu:', e.message);
    await fallbackText(sock, jid, {
      title: cat.label,
      text: lines.join('\n'),
      footer: 'DJOUSSE-TECH-MD',
      buttons: []
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

  const cmdName = cmd.alias ? cmd.alias[0] : commandId.replace('cmd_', '');

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
        text: `Erreur: ${e.message}\nTapez .${cmdName} manuellement.`
      }, { quoted: message });
    }
  }

  if (cmd.type === 'B') {
    sessionManager.setWaiting(jid, commandId, 'waiting_input');
    const prompt = cmd.prompt || `Envoyez le texte pour *${cmd.label}* :`;
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
    const prompt = cmd.prompt || `Envoyez un fichier pour *${cmd.label}* :`;
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
    text: `Type de commande inconnu: ${cmd.type}`
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
