/**
 * lib/djousse-ui.cjs — Style HACKER GLOBAL DJOUSSE TECH
 * ✅ Toutes les valeurs entre backticks
 * ✅ Toutes les commandes entre backticks
 * ✅ Footer automatique
 */

const FOOTER = 'ᴘᴏᴡᴇʀᴇᴅ ʙʏ DJOUSSE TECH';
const SEP = '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬';

/**
 * Bloc principal — Style HACKER GLOBAL
 */
function box(title, lines, width = 40) {
  const rows = [];

  if (title) {
    rows.push(`⛓️ *${title}*`);
    rows.push(SEP);
  }

  for (const line of lines) {
    let text = '';

    if (typeof line === 'string') {
      text = line;
    } else if (line && typeof line === 'object') {
      if (line.blank === true) {
        rows.push('');
        continue;
      }
      // ✅ Label : Valeur entre backticks
      if (line.label !== undefined && line.value !== undefined) {
        const label = line.label.includes('*') ? line.label : `*${line.label}*`;
        text = `┃ ${label} : \`${line.value}\``;
      }
      // ✅ Commande entre backticks
      else if (line.cmd !== undefined) {
        text = `┃ ⚡ \`.${line.cmd}\`${line.desc ? ` — _${line.desc}_` : ''}`;
      }
      // ✅ Texte brut
      else if (line.raw !== undefined) {
        text = `┃ ${line.raw}`;
      } else {
        continue;
      }
    } else if (line !== null && line !== undefined) {
      text = `┃ ${String(line)}`;
    }

    if (text) rows.push(text);
  }

  rows.push(SEP);
  return rows.join('\n');
}

/**
 * Box avec footer automatique
 */
function boxWithFooter(title, lines, footer = FOOTER) {
  return box(title, lines) + `\n> ${footer}`;
}

/**
 * Catégorie HACKER (pour le menu)
 */
function hackerCategory(name, commands) {
  const rows = [];
  rows.push(`┏━〔 *${name}* 〕`);
  for (const cmd of commands) {
    rows.push(`┃ ⚡ \`.${cmd}\``);
  }
  rows.push(`┗━━━━━━━━━━━━━━━━━━`);
  return rows.join('\n');
}

/**
 * Ligne de commande
 */
function cmdLine(name, desc = '') {
  return `┃ ⚡ \`.${name}\`${desc ? ` — _${desc}_` : ''}`;
}

/**
 * Info : Label : Valeur entre backticks
 */
function info(label, value) {
  return `┃ *${label}* : \`${value}\``;
}

/**
 * Séparateur
 */
function separator(width = 30) {
  return '▬'.repeat(width);
}

/**
 * Titre hacker
 */
function title(text) {
  return `⛓️ *${text}*`;
}

/**
 * Messages système
 */
function success(text) { return `┃ ✅ ${text}`; }
function error(text)   { return `┃ ❌ ${text}`; }
function warn(text)    { return `┃ ⚠️ ${text}`; }
function critical(text){ return `┃ ☠️ ${text}`; }

/**
 * Tronquer
 */
function truncate(text, maxLen = 40) {
  if (!text) return '';
  const chars = [...String(text)];
  return chars.length > maxLen ? chars.slice(0, maxLen - 1).join('') + '…' : text;
}

/**
 * Uptime
 */
function uptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d > 0) parts.push(`${d}j`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

module.exports = {
  box,
  boxWithFooter,
  hackerCategory,
  cmdLine,
  info,
  separator,
  title,
  success,
  error,
  warn,
  critical,
  truncate,
  uptime,
  FOOTER,
  SEP,
};
