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
  const base = {
    title: '',
    text: caption,
    footer: '✦ DJOUSSE TECH ✦',
    buttons: buttons || [],
    quoted
  };
  // Image en header nativeFlow si le fichier existe
  if (imagePath && fs.existsSync(imagePath)) {
    try {
      const imageBuffer = fs.readFileSync(imagePath);
      for (let attempt = 1; attempt <= 2; attempt++) {
        const ok = await sendButtons(sock, jid, { ...base, image: { buffer: imageBuffer } });
        if (ok) return true;
        if (attempt < 2) {
          console.warn('[MENU] Envoi image échoué — nouvelle tentative dans 3s…');
          await new Promise(r => setTimeout(r, 3000));
        }
      }
    } catch (e) {
      console.warn('[MENU] Image échouée, fallback texte:', e.message);
    }
  }
  // Fallback : texte seul avec boutons
  return sendButtons(sock, jid, base);
}

// ═══════════════════════════════════════════════
// NIVEAU 1 : Menu principal (catégories)
// ═══════════════════════════════════════════════
async function buildMainMenu(sock, jid, quoted, page = 1) {
  const cats = menuConfig.categories;

  // ── Texte numéroté avec TOUTES les catégories (une seule page) ──
  const lines = [];
  lines.push('✦ ─────────────── ✦');
  lines.push('   📋  M E N U  P R I N C I P A L');
  lines.push('✦ ─────────────── ✦');
  lines.push('');
  cats.forEach((c, i) => {
    const cmdCount = c.commands ? c.commands.length : 0;
    // label contient déjà l'emoji — ne pas le préfixer une 2e fois
    lines.push(`  ${i + 1}. ${c.label}  ·  ${cmdCount} commande(s)`);
  });
  lines.push('');
  lines.push(`  ${cats.length} catégories au total`);
  lines.push('');
  lines.push('  👇 Ouvre la liste, ou tape un numéro');
  lines.push('✦ ─────────────── ✦');

  const caption = lines.join('\n');

  // ── Boutons : liste déroulante (toutes catégories) + aide ──
  const nav = [
    {
      type: 'list',
      text: '📂 Ouvrir le Menu',
      list: {
        title: '📋 Catégories',
        sections: [
          {
            title: 'Catégories',
            rows: cats.map(c => ({
              title: c.label,
              description: `${c.commands ? c.commands.length : 0} commande(s)${c.desc ? ' — ' + c.desc : ''}`,
              id: c.id
            }))
          }
        ]
      }
    },
    { id: 'btn_help', text: '❓' }
  ];

  // ── Contexte pour interception numéro ──
  sessionManager.setMenuContext(jid, {
    type: 'main',
    page: 1,
    items: cats.map((c, i) => ({
      num: i + 1,
      id: c.id,
      label: c.label
    }))
  });

  try {
    return await sendWithImage(sock, jid, menuConfig.menuImage, caption, nav, quoted);
  } catch (e) {
    console.error('[MENU] Erreur:', e.message);
    return false;
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

  // ── Texte numéroté (page courante) ──
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
  lines.push(`  Page ${page}/${total}  ·  ✏️ texte • 📎 fichier`);
  lines.push('');
  lines.push('  👇 Ouvre la liste, ou tape un numéro');
  lines.push('✦ ─────────────── ✦');

  const caption = lines.join('\n');

  // ── Boutons : liste déroulante (TOUTES les commandes) + retour ──
  const typeDesc = t => (t === 'B' ? '✏️ saisie texte' : t === 'C' ? '📎 envoie un fichier' : '⚡ direct');
  const nav = [
    {
      type: 'list',
      text: '📋 Commandes',
      list: {
        title: cat.label,
        sections: [
          {
            title: cat.label,
            rows: cat.commands.map(c => ({
              title: `${c.label}${c.type === 'B' ? ' ✏️' : c.type === 'C' ? ' 📎' : ''}`,
              description: typeDesc(c.type),
              id: c.id
            }))
          }
        ]
      }
    },
    { id: 'back_menu', text: '🏠' }
  ];

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
    return await sendWithImage(sock, jid, catImage, caption, nav, quoted);
  } catch (e) {
    console.error('[MENU] Erreur:', e.message);
    return false;
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
