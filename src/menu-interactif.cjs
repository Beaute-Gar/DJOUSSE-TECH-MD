/**
 * Menu Interactif — DJOUSSE-TECH-MD
 *
 * Menu générique sous forme de LISTE WhatsApp (sections + lignes), généré
 * dynamiquement depuis le registre de commandes (command.cjs). Déclenché par
 * la commande texte « .menu2 » et gère ensuite la sélection d'une ligne.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * RÈGLE DE ROUTING (voir wwebjs-msg.cjs / index.cjs / smart-router.cjs) :
 * Toutes les fonctions de ce fichier reçoivent `m`, l'objet DÉJÀ traité par
 * sms() — m.chat / m.sender / m.reply sont déjà résolus (LID compris). On ne
 * recalcule JAMAIS le destinataire depuis msg.key.remoteJid, un rowId, ou
 * une variable globale. On ne fait que RÉUTILISER m.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Usage dans index.cjs :
 *   const { envoyerMenuInteractif, envoyerAvecBoutons, gererClicBouton, gererMenuListe, genererTexteMenu }
 *     = require('./src/menu-interactif.cjs');
 *   const clicked = await gererClicBouton(sock, m, config);   // m, PAS msg
 *   const handled = await gererMenuListe(sock, m, config);    // m, PAS msg
 */

const COMMANDES = require('../command.cjs');

const ROW_PREFIX = 'menucmd:';
const MAX_ROWS_PER_SECTION = 10;

/* ─── Construction du contenu (pure, sans I/O) ─── */

function commandesVisibles() {
  return (COMMANDES?.commands || []).filter(c => c && c.pattern && !c.dontAddCommandList);
}

function grouperParCategorie(list) {
  const map = new Map();
  for (const c of list) {
    const cat = String(c.category || 'misc').toLowerCase();
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat).push(c);
  }
  return map;
}

/**
 * Texte brut du menu (fallback si les listes interactives ne sont pas
 * supportées par le client de l'utilisateur, ou pour la commande .menu).
 */
function genererTexteMenu(commandsList) {
  const list = Array.isArray(commandsList) && commandsList.length ? commandsList : commandesVisibles();
  const byCat = grouperParCategorie(list);
  const lines = ['📋 *MENU DES COMMANDES*', ''];
  for (const [cat, cmds] of [...byCat.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`*╭─「 ${cat.toUpperCase()} 」*`);
    for (const c of cmds) {
      lines.push(`┃❖ .${c.pattern}${c.desc ? ' — ' + c.desc : ''}`);
    }
    lines.push('╰─────────────❖●►');
    lines.push('');
  }
  lines.push('_Tape .menu2 pour la version liste interactive._');
  return lines.join('\n');
}

/**
 * Envoie le menu sous forme de liste WhatsApp (sections/rows).
 * La destination est TOUJOURS m.chat — jamais un paramètre séparé.
 */
async function envoyerMenuInteractif(sock, m) {
  const list = commandesVisibles();
  const byCat = grouperParCategorie(list);

  const sections = [...byCat.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([cat, cmds]) => ({
      title: `📂 ${cat.toUpperCase()}`,
      rows: cmds.slice(0, MAX_ROWS_PER_SECTION).map(c => ({
        title: `.${c.pattern}`,
        rowId: ROW_PREFIX + c.pattern,
        description: String(c.desc || '').slice(0, 60),
      })),
    }))
    .filter(s => s.rows.length > 0);

  return sock.sendMessage(m.chat, {
    text: '👋 Choisis une commande dans la liste ci-dessous.',
    footer: 'DJOUSSE TECH EVOLUTION — AINORIA AI',
    title: '📋 MENU INTERACTIF',
    buttonText: 'Voir les commandes',
    sections,
  }, { quoted: m });
}

/**
 * Envoie un message avec des boutons personnalisés.
 * `buttons` : [{ id?, cmd?, label }] — si `id` absent, un id `menucmd:<cmd>`
 * est généré pour être intercepté automatiquement par gererClicBouton().
 */
async function envoyerAvecBoutons(sock, m, text, buttons = []) {
  const formatted = buttons.map((b, i) => ({
    buttonId: b.id || (b.cmd ? ROW_PREFIX + b.cmd : `menuopt:${i}`),
    buttonText: { displayText: b.label || b.title || String(b.cmd || i) },
    type: 1,
  }));
  return sock.sendMessage(m.chat, {
    text,
    footer: 'DJOUSSE TECH EVOLUTION',
    buttons: formatted,
    headerType: 1,
  }, { quoted: m });
}

/**
 * Exécute une commande du registre en réutilisant `m` tel quel.
 * Ne reconstruit JAMAIS chat/sender — c'est exactement le bug corrigé dans
 * smart-router.cjs, on ne le reproduit pas ici.
 */
async function executerCommandeDepuisMenu(sock, m, cmdName) {
  const list = COMMANDES?.commands || [];
  const found = list.find(c => {
    const p = String(c.pattern || '').toLowerCase();
    const aliases = Array.isArray(c.alias) ? c.alias.map(a => String(a).toLowerCase()) : [];
    return p === cmdName.toLowerCase() || aliases.includes(cmdName.toLowerCase());
  });
  if (!found || typeof found.function !== 'function') {
    await m.reply('❌ Commande introuvable ou plus disponible.').catch(() => {});
    return true;
  }
  try {
    await found.function(sock, m, list, { reply: (t) => m.reply(t) });
  } catch (e) {
    console.error('❌ [MENU-INTERACTIF] exécution:', e.message);
    await m.reply('❌ Erreur: ' + e.message).catch(() => {});
  }
  return true;
}

/**
 * Intercepte les clics sur les BOUTONS (buttonsResponseMessage /
 * templateButtonReplyMessage) dont l'id commence par « menucmd: ».
 * Retourne false si ce n'est pas un clic qui concerne ce module — laisse
 * alors la main à un autre handler (ex: menu-professionnel.cjs).
 */
async function gererClicBouton(sock, m, config) {
  try {
    let selectedId = '';
    if (m.type === 'buttonsResponseMessage') {
      selectedId = m.message?.buttonsResponseMessage?.selectedButtonId || '';
    } else if (m.type === 'templateButtonReplyMessage') {
      selectedId = m.message?.templateButtonReplyMessage?.selectedId || '';
    }
    if (!selectedId.startsWith(ROW_PREFIX)) return false;
    const cmdName = selectedId.slice(ROW_PREFIX.length);
    return await executerCommandeDepuisMenu(sock, m, cmdName);
  } catch (e) {
    console.error('❌ [MENU-INTERACTIF] gererClicBouton:', e.message);
    return false;
  }
}

/**
 * Gère :
 *   1) la commande texte « .menu2 » → envoie la liste interactive ;
 *   2) la sélection d'une ligne de cette liste (listResponseMessage).
 * Retourne false si le message ne concerne pas ce module.
 */
async function gererMenuListe(sock, m, config) {
  try {
    const prefix = (config && (config.PREFIX || config.prefix)) || '.';
    const body = String(m.body || '').trim().toLowerCase();

    if (body === prefix + 'menu2' || body === '.menu2') {
      await envoyerMenuInteractif(sock, m);
      return true;
    }

    if (m.type === 'listResponseMessage') {
      const rowId = m.message?.listResponseMessage?.singleSelectReply?.selectedRowId || '';
      if (!rowId.startsWith(ROW_PREFIX)) return false;
      const cmdName = rowId.slice(ROW_PREFIX.length);
      return await executerCommandeDepuisMenu(sock, m, cmdName);
    }

    return false;
  } catch (e) {
    console.error('❌ [MENU-INTERACTIF] gererMenuListe:', e.message);
    return false;
  }
}

module.exports = {
  envoyerMenuInteractif,
  envoyerAvecBoutons,
  gererClicBouton,
  gererMenuListe,
  genererTexteMenu,
};
