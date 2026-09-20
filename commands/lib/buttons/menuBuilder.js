/**
 * Constructeur de menus interactifs à boutons
 * Pagination automatique (max 3 boutons par page)
 * DJOUSSE-TECH-MD
 */

const config = require('./buttonConfig');
const { sendButtons, fallbackText } = require('./buttonSender');
const menuConfig = require('./menuConfig');

const ITEMS_PER_PAGE = 3;

function paginate(items, page) {
  const total = Math.ceil(items.length / ITEMS_PER_PAGE);
  const start = (page - 1) * ITEMS_PER_PAGE;
  const slice = items.slice(start, start + ITEMS_PER_PAGE);
  return { items: slice, page, total, hasNext: page < total, hasPrev: page > 1 };
}

function buildNavButtons(currentPage, totalPages, prefix, catId) {
  const nav = [];
  if (currentPage > 1) {
    nav.push({ id: `page_${prefix}_${catId}_${currentPage - 1}`, text: '◀️ Préc' });
  }
  if (currentPage < totalPages) {
    nav.push({ id: `page_${prefix}_${catId}_${currentPage + 1}`, text: '▶️ Suivant' });
  }
  nav.push({ id: 'back_menu', text: '🏠 Menu' });
  return nav;
}

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

async function buildCommandPreview(sock, jid, commandId, quoted) {
  const cat = menuConfig.categories.find(c =>
    c.commands.some(cmd => cmd.id === commandId)
  );
  const cmd = cat ? cat.commands.find(c => c.id === commandId) : null;

  if (!cmd) {
    return sock.sendMessage(jid, { text: 'Commande introuvable.' }, { quoted });
  }

  const lines = [];
  lines.push(`*${cmd.label}*`);
  lines.push('');
  lines.push('Exécution en cours...');
  lines.push('');
  lines.push('ou');
  lines.push('Tapez /' + (cmd.alias ? cmd.alias[0] : commandId.replace('cmd_', '')));

  await sendButtons(sock, jid, {
    title: cmd.label,
    text: lines.join('\n'),
    footer: 'DJOUSSE-TECH-MD',
    buttons: [
      { id: 'back_menu', text: '🏠 Menu' }
    ],
    quoted
  });
}

module.exports = {
  buildMainMenu,
  buildCategoryMenu,
  buildCommandPreview,
  paginate,
  ITEMS_PER_PAGE
};
