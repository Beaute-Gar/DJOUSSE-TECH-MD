/**
 * Constructeur de menus interactifs à boutons
 * Types : A = direct, B = saisie texte, C = envoi fichier
 * Pagination automatique (max 3 boutons par page)
 * DJOUSSE-TECH-MD
 */

const { sendButtons, fallbackText } = require('./buttonSender');
const sessionManager = require('./sessionManager');
const menuConfig = require('./menuConfig');

const ITEMS_PER_PAGE = 3;

function paginate(items, page) {
  const total = Math.ceil(items.length / ITEMS_PER_PAGE);
  const start = (page - 1) * ITEMS_PER_PAGE;
  const slice = items.slice(start, start + ITEMS_PER_PAGE);
  return { items: slice, page, total, hasNext: page < total, hasPrev: page > 1 };
}

// ═══════════════════════════════════════════════════════
// NIVEAU 1 : Menu principal (catégories)
// ═══════════════════════════════════════════════════════
async function buildMainMenu(sock, jid, quoted, page = 1) {
  const cats = menuConfig.categories;
  const { items, total, hasNext, hasPrev } = paginate(cats, page);

  const lines = [];
  lines.push('*👋 MENU PRINCIPAL*');
  lines.push('');
  lines.push('Choisissez une catégorie :');
  lines.push('');
  lines.push(`_${page}/${total}_`);

  const buttons = items.map(c => ({ id: c.id, text: c.label }));
  const nav = [];
  if (hasPrev) nav.push({ id: `page_main_${page - 1}`, text: '◀️ Préc' });
  if (hasNext) nav.push({ id: `page_main_${page + 1}`, text: '▶️ Suivant' });
  nav.push({ id: 'btn_help', text: '❓ Aide' });

  const allButtons = [...buttons, ...nav].slice(0, 3);

  try {
    await sendButtons(sock, jid, {
      title: '👋 MENU PRINCIPAL',
      text: lines.join('\n'),
      footer: 'DJOUSSE-TECH-MD',
      buttons: allButtons,
      quoted
    });
  } catch (e) {
    console.error('[MENU] Erreur buildMainMenu:', e.message);
    await fallbackText(sock, jid, {
      title: 'MENU PRINCIPAL',
      text: cats.map(c => `${c.emoji} ${c.label}`).join('\n'),
      footer: 'DJOUSSE-TECH-MD',
      buttons: []
    });
  }
}

// ═══════════════════════════════════════════════════════
// NIVEAU 2 : Catégorie (commandes)
// ═══════════════════════════════════════════════════════
async function buildCategoryMenu(sock, jid, categoryId, page = 1, quoted) {
  const cat = menuConfig.categories.find(c => c.id === categoryId);
  if (!cat) {
    return sock.sendMessage(jid, { text: 'Catégorie introuvable.' }, { quoted });
  }

  const { items, total, hasNext, hasPrev } = paginate(cat.commands, page);

  const lines = [];
  lines.push(`*${cat.label}*`);
  lines.push('');
  lines.push('Choisissez une commande :');
  lines.push('');
  lines.push(`_${page}/${total}_`);

  const buttons = items.map(c => ({ id: c.id, text: c.label }));
  const nav = [];
  if (hasPrev) nav.push({ id: `page_cat_${categoryId}_${page - 1}`, text: '◀️ Préc' });
  if (hasNext) nav.push({ id: `page_cat_${categoryId}_${page + 1}`, text: '▶️ Suivant' });
  nav.push({ id: 'back_menu', text: '🏠 Menu' });

  const allButtons = [...buttons, ...nav].slice(0, 3);

  try {
    await sendButtons(sock, jid, {
      title: cat.label,
      text: lines.join('\n'),
      footer: 'DJOUSSE-TECH-MD',
      buttons: allButtons,
      quoted
    });
  } catch (e) {
    console.error('[MENU] Erreur buildCategoryMenu:', e.message);
    await fallbackText(sock, jid, {
      title: cat.label,
      text: cat.commands.map(c => c.label).join('\n'),
      footer: 'DJOUSSE-TECH-MD',
      buttons: []
    });
  }
}

// ═══════════════════════════════════════════════════════
// NIVEAU 3 : Exécution selon le TYPE
// ═══════════════════════════════════════════════════════
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

  // ──────────────────────────────────────
  // TYPE A : exécution directe (aucune saisie)
  // ──────────────────────────────────────
  if (cmd.type === 'A') {
    try {
      // Simule un message texte avec le prefix de la commande
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
        isGroup: jid.endsWith('@g.us'),
        isOwner: false,
        isAdmin: false,
        isBotAdmin: false,
        conn: sock
      };

      // Cherche la commande dans commandMap
      const { commandMap } = require('../../command.cjs');
      const cmdObj = commandMap.get(cmdName);
      if (cmdObj && cmdObj.execute) {
        return await cmdObj.execute(sock, fakeMsg, args, ctx);
      }

      // Fallback : envoie un message avec le prefix
      return sock.sendMessage(jid, {
        text: `Exécutez .${cmdName} en tapant le commande.`
      }, { quoted: message });
    } catch (e) {
      console.error(`[MENU] Erreur TYPE A ${cmdName}:`, e.message);
      return sock.sendMessage(jid, {
        text: `Erreur: ${e.message}\nTapez .${cmdName} manuellement.`
      }, { quoted: message });
    }
  }

  // ──────────────────────────────────────
  // TYPE B : demande de saisie texte
  // ──────────────────────────────────────
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

  // ──────────────────────────────────────
  // TYPE C : demande de fichier
  // ──────────────────────────────────────
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

  // Fallback inconnu
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
