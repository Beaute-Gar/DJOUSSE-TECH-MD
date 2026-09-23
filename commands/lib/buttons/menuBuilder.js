/**
 * Constructeur de menus interactifs HYBRIDES
 * Texte numéroté (TOUT visible) + Boutons (navigation)
 * Types : A = direct, B = saisie texte, C = envoi fichier
 * WhatsApp limite : 3 boutons max par message
 * DJOUSSE-TECH-MD
 */

const fs = require('fs');
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

// ═══════════════════════════════════════════════
// ENVOI AVEC IMAGE (si disponible)
// ═══════════════════════════════════════════════
async function sendWithImage(sock, jid, imagePath, caption, buttons, quoted) {
  // Vérifier si l'image existe — envoyer via gifted-btns (header image + nativeFlow buttons)
  if (imagePath && fs.existsSync(imagePath)) {
    try {
      const imageBuffer = fs.readFileSync(imagePath);
      const ok = await sendButtons(sock, jid, {
        title: '',
        text: caption,
        footer: '✦ DJOUSSE TECH ✦',
        image: { buffer: imageBuffer },
        buttons: buttons || [],
        quoted
      });
      if (ok) return true;
    } catch (e) {
      console.warn('[MENU] Image échouée, fallback texte:', e.message);
    }
  }
  // Fallback : texte seul avec boutons
  await sendButtons(sock, jid, {
    title: '',
    text: caption,
    footer: '✦ DJOUSSE TECH ✦',
    buttons: buttons || [],
    quoted
  });
  return true;
}

// ═══════════════════════════════════════════════
// NIVEAU 1 : Menu principal (catégories)
// ═══════════════════════════════════════════════
async function buildMainMenu(sock, jid, quoted, page = 1) {
  const cats = menuConfig.categories;
  const { items, total, hasNext, hasPrev, startIndex } = paginate(cats, page);

  // ── Texte numéroté avec TOUTES les catégories de la page ──
  const lines = [];
  lines.push('✦ ─────────────── ✦');
  lines.push('   📋  M E N U  P R I N C I P A L');
  lines.push('✦ ─────────────── ✦');
  lines.push('');
  items.forEach((c, i) => {
    const num = startIndex + i + 1;
    const cmdCount = c.commands ? c.commands.length : 0;
    // label contient déjà l'emoji — ne pas le préfixer une 2e fois
    lines.push(`  ${num}. ${c.label}  ·  ${cmdCount} commande(s)`);
  });
  lines.push('');
  lines.push(`  Page ${page}/${total}`);
  lines.push('');
  lines.push('  👇 Choisis une catégorie (bouton ou numéro)');
  lines.push('✦ ─────────────── ✦');

  const caption = lines.join('\n');

  // ── Boutons de navigation (max 3) ──
  const nav = [];
  if (hasPrev) nav.push({ id: `page_main_${page - 1}`, text: '◀️' });
  if (hasNext) nav.push({ id: `page_main_${page + 1}`, text: '▶️' });
  nav.push({ id: 'btn_help', text: '❓' });

  const finalButtons = nav.slice(0, 3);

  // ── Contexte pour interception numéro ──
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
    await sendWithImage(sock, jid, menuConfig.menuImage, caption, finalButtons, quoted);
  } catch (e) {
    console.error('[MENU] Erreur:', e.message);
  }
}

// ═══════════════════════════════════════════════
// NIVEAU 2 : Catégorie (commandes)
// ═══════════════════════════════════════════════
async function buildCategoryMenu(sock, jid, categoryId, page = 1, quoted) {
  const cat = menuConfig.categories.find(c => c.id === categoryId);
  if (!cat) {
    return sock.sendMessage(jid, { text: 'Catégorie introuvable.' }, { quoted });
  }

  const { items, total, hasNext, hasPrev, startIndex } = paginate(cat.commands, page);

  // ── Texte numéroté ──
  const lines = [];
  const catName = cat.label.replace(cat.emoji, '').trim().toUpperCase();
  lines.push('✦ ─────────────── ✦');
  lines.push(`   ${cat.emoji}  ${catName.split('').join(' ')}`);
  lines.push('✦ ─────────────── ✦');
  lines.push('');
  items.forEach((c, i) => {
    const num = startIndex + i + 1;
    const typeIcon = c.type === 'B' ? ' ✏️' : c.type === 'C' ? ' 📎' : '';
    lines.push(`  ${num}. ${c.label}${typeIcon}`);
  });
  lines.push('');
  lines.push(`  Page ${page}/${total}`);
  lines.push('');
  lines.push('  ✏️ texte • 📎 fichier');
  lines.push('  👇 Cliquez un bouton ou tapez un numéro');
  lines.push('✦ ─────────────── ✦');

  const caption = lines.join('\n');

  // ── Boutons de navigation (max 3) ──
  const nav = [];
  if (hasPrev) nav.push({ id: `page_cat_${categoryId}_${page - 1}`, text: '◀️' });
  if (hasNext) nav.push({ id: `page_cat_${categoryId}_${page + 1}`, text: '▶️' });
  nav.push({ id: 'back_menu', text: '🏠' });

  const finalButtons = nav.slice(0, 3);

  // ── Contexte pour interception numéro ──
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
    const catImage = cat.image || menuConfig.menuImage || menuConfig.defaultImage;
    await sendWithImage(sock, jid, catImage, caption, finalButtons, quoted);
  } catch (e) {
    console.error('[MENU] Erreur:', e.message);
  }
}

// ═══════════════════════════════════════════════
// NIVEAU 3 : Exécution selon le TYPE
// ═══════════════════════════════════════════════
async function handleCommandClick(sock, jid, message, commandId) {
  const cmd = findCommandById(commandId);
  if (!cmd) {
    return sendButtons(sock, jid, {
      title: '⚠️ ERREUR',
      text: `Commande *${commandId}* introuvable.`,
      footer: '✦ DJOUSSE TECH ✦',
      buttons: [{ id: 'back_menu', text: '🏠' }],
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
        return await cmdObj.execute(sock, fakeMsg, [], ctx);
      }

      return sock.sendMessage(jid, {
        text: `Tapez .${cmdName}`
      }, { quoted: message });
    } catch (e) {
      console.error(`[MENU] Erreur ${cmdName}:`, e.message);
      return sock.sendMessage(jid, {
        text: `Erreur: ${e.message}`
      }, { quoted: message });
    }
  }

  if (cmd.type === 'B') {
    sessionManager.setWaiting(jid, commandId, 'waiting_input');
    return sendButtons(sock, jid, {
      title: cmd.label,
      text: cmd.prompt || `Envoyez le texte pour *${cmd.label}* :`,
      footer: '⏱️ 5 minutes',
      buttons: [
        { id: 'cancel_wait', text: '❌' },
        { id: 'back_menu', text: '🏠' }
      ],
      quoted: message
    });
  }

  if (cmd.type === 'C') {
    sessionManager.setWaiting(jid, commandId, 'waiting_file');
    return sendButtons(sock, jid, {
      title: cmd.label,
      text: cmd.prompt || `Envoyez un fichier pour *${cmd.label}* :`,
      footer: '⏱️ 5 minutes',
      buttons: [
        { id: 'cancel_wait', text: '❌' },
        { id: 'back_menu', text: '🏠' }
      ],
      quoted: message
    });
  }

  return sock.sendMessage(jid, { text: `Type inconnu: ${cmd.type}` }, { quoted: message });
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
  sendWithImage,
  ITEMS_PER_PAGE
};
