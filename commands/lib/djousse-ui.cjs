/**
 * lib/djousse-ui.cjs — Style PREMIUM / LUXE
 * ✦ ─────────────── ✦
 *    ❌  É C H E C
 * ✦ ─────────────── ✦
 *   ▸ Clé     ·  Valeur
 * ✦ ─────────────── ✦
 *
 * DJOUSSE-TECH-MD
 */

const FOOTER = '✦ DJOUSSE TECH ✦';
const SEP = '✦ ─────────────── ✦';
const FIELD_SEP = '·';

// ═══════════════════════════════════════════════
// UTILITAIRE : Espacer les lettres d'un titre
// ═══════════════════════════════════════════════
function space_title(text) {
  return [...String(text).toUpperCase()].join(' ');
}

// ═══════════════════════════════════════════════
// DÉTECTION DE L'EMOJI SELON LE TITRE
// ═══════════════════════════════════════════════
const EMOJI_MAP = {
  'error': '❌', 'erreur': '❌', 'échec': '❌', 'echec': '❌',
  'success': '✅', 'succès': '✅', 'ok': '✅',
  'warning': '⚠️', 'attention': '⚠️', 'warn': '⚠️',
  'info': 'ℹ️', 'information': 'ℹ️', 'informations': 'ℹ️',
  'loading': '⏳', 'chargement': '⏳', 'traitement': '⏳', 'search': '⏳', 'recherche': '⏳',
  'critical': '⛔', 'critique': '⛔', 'fatal': '⛔',
  'ping': '🏓', 'pong': '🏓',
  'ban': '🔨', 'unban': '🔓', 'kick': '👢',
  'money': '💰', 'coins': '💰', 'balance': '💰',
  'level': '⬆️', 'xp': '⬆️',
  'music': '🎵', 'audio': '🎵', 'mp3': '🎵',
  'image': '🖼️', 'photo': '🖼️', 'sticker': '🖼️',
  'video': '🎬', 'download': '⬇️', 'téléchargement': '⬇️',
  'search': '🔍', 'find': '🔍',
  'ai': '🤖', 'gpt': '🤖', 'bot': '🤖',
  'game': '🎮', 'jeu': '🎮',
  'weather': '🌤️', 'météo': '🌤️',
  'calc': '🧮', 'calcul': '🧮',
  'welcome': '👋', 'goodbye': '👋',
  'admin': '⚡', 'owner': '👑', 'ownerlist': '👑',
  'tagall': '📢', 'mention': '📢',
  'help': '❓', 'aide': '❓', 'menu': '📂',
};

function detectEmoji(title) {
  // Normaliser les accents pour la detection
  const lower = title.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s]/g, '').trim();
  for (const [key, emoji] of Object.entries(EMOJI_MAP)) {
    const normalized = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (lower.includes(normalized)) return emoji;
  }
  return '✦';
}

// ═══════════════════════════════════════════════
// FONCTIONS DE FORMATAGE
// ═══════════════════════════════════════════════

/**
 * Bloc principal — Style PREMIUM
 * lines = [{ label, value }, { raw, text }, { blank: true }, 'texte brut', { cmd, desc }]
 */
function box(title, lines, width = 40) {
  const rows = [];
  const emoji = detectEmoji(title);
  const spacedTitle = space_title(title.replace(/[*_`]/g, ''));

  // Ouverture
  rows.push(SEP);
  // Titre espacé
  rows.push(`   ${emoji}  ${spacedTitle}`);
  // Fermeture
  rows.push(SEP);

  // Calculer le padding max pour l'alignement
  let maxKeyLen = 0;
  const parsedLines = [];

  for (const line of lines) {
    if (!line && line !== 0) continue;

    if (typeof line === 'string') {
      parsedLines.push({ type: 'raw', text: line });
      continue;
    }

    if (typeof line === 'object') {
      if (line.blank === true) {
        parsedLines.push({ type: 'blank' });
        continue;
      }
      if (line.label !== undefined && line.value !== undefined) {
        const cleanLabel = String(line.label).replace(/[*_`]/g, '');
        if (cleanLabel.length > maxKeyLen) maxKeyLen = cleanLabel.length;
        parsedLines.push({ type: 'field', label: cleanLabel, value: String(line.value) });
        continue;
      }
      if (line.raw !== undefined) {
        parsedLines.push({ type: 'raw', text: String(line.raw) });
        continue;
      }
      if (line.cmd !== undefined) {
        parsedLines.push({ type: 'cmd', cmd: line.cmd, desc: line.desc || '' });
        continue;
      }
    }

    parsedLines.push({ type: 'raw', text: String(line) });
  }

  // Construire les lignes
  rows.push('');
  for (const pl of parsedLines) {
    if (pl.type === 'blank') {
      rows.push('');
    } else if (pl.type === 'field') {
      const pad = ' '.repeat(Math.max(0, maxKeyLen - pl.label.length));
      rows.push(`  ▸ ${pl.label}${pad}  ${FIELD_SEP}  ${pl.value}`);
    } else if (pl.type === 'cmd') {
      rows.push(`  ▸ ⚡ \`.${pl.cmd}\`${pl.desc ? ` — _${pl.desc}_` : ''}`);
    } else if (pl.type === 'raw') {
      // Centrer les lignes brutes avec le même style
      rows.push(`  ${pl.text}`);
    }
  }
  rows.push('');
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
 * Format: SUCCÈS
 */
function formatSuccess(title, fields = []) {
  const mapped = fields.map(f => ({ label: f[0], value: f[1] }));
  return boxWithFooter(title || 'SUCCÈS', mapped);
}

/**
 * Format: ERREUR
 */
function formatError(title, fields = []) {
  const mapped = fields.map(f => ({ label: f[0], value: f[1] }));
  return boxWithFooter(title || 'ERREUR', mapped);
}

/**
 * Format: ATTENTION
 */
function formatWarning(title, fields = []) {
  const mapped = fields.map(f => ({ label: f[0], value: f[1] }));
  return boxWithFooter(title || 'ATTENTION', mapped);
}

/**
 * Format: INFO
 */
function formatInfo(title, fields = []) {
  const mapped = fields.map(f => ({ label: f[0], value: f[1] }));
  return boxWithFooter(title || 'INFO', mapped);
}

/**
 * Format: CHARGEMENT
 */
function formatLoading(title, fields = []) {
  const mapped = fields.map(f => ({ label: f[0], value: f[1] }));
  return boxWithFooter(title || 'TRAITEMENT', mapped);
}

/**
 * Format: CRITIQUE
 */
function formatCritical(title, fields = []) {
  const mapped = fields.map(f => ({ label: f[0], value: f[1] }));
  return boxWithFooter(title || 'CRITIQUE', mapped);
}

/**
 * Catégorie (pour le menu)
 */
function hackerCategory(name, commands) {
  const rows = [];
  rows.push(SEP);
  rows.push(`   📂  ${space_title(name)}`);
  rows.push(SEP);
  rows.push('');
  for (const cmd of commands) {
    rows.push(`  ▸ ⚡ \`.${cmd}\``);
  }
  rows.push('');
  rows.push(SEP);
  return rows.join('\n');
}

/**
 * Ligne de commande
 */
function cmdLine(name, desc = '') {
  return `  ▸ ⚡ \`.${name}\`${desc ? ` — _${desc}_` : ''}`;
}

/**
 * Info : Label : Valeur
 */
function info(label, value) {
  const maxKeyLen = label.length;
  return `  ▸ ${label}  ${FIELD_SEP}  ${value}`;
}

/**
 * Séparateur
 */
function separator(width = 30) {
  return '─'.repeat(width);
}

/**
 * Titre
 */
function title(text) {
  return `${space_title(text)}`;
}

/**
 * Messages système
 */
function success(text) { return `  ✅ ${text}`; }
function error(text)   { return `  ❌ ${text}`; }
function warn(text)    { return `  ⚠️ ${text}`; }
function critical(text){ return `  ⛔ ${text}`; }

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
  space_title,
  formatSuccess,
  formatError,
  formatWarning,
  formatInfo,
  formatLoading,
  formatCritical,
  FOOTER,
  SEP,
  FIELD_SEP,
};
