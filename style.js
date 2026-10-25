
'use strict';

/**
 * style.js — DJOUSSE TECH EVOLUTION
 * Console de démarrage et moteur de rendu centralisé.
 * Compatible Node.js, CMD Windows et Termux.
 * Conserve les fonctions utilisées par les autres modules.
 */

const MATH_MAP = {};

const buildMathRange = (start, chars) => {
  [...chars].forEach((c, i) => {
    MATH_MAP[c] = String.fromCodePoint(start + i);
  });
};

buildMathRange(0x1D670, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
buildMathRange(0x1D68A, 'abcdefghijklmnopqrstuvwxyz');
buildMathRange(0x1D7F6, '0123456789');

function toUnicode(str) {
  return String(str).replace(/[A-Za-z0-9]/g, ch => MATH_MAP[ch] || ch);
}

/* ─────────────── IDENTITÉ VISUELLE ─────────────── */

const frameHeader = title => `╭┄┄『 ${toUnicode(title)} 』┄❍`;
const frameFooter = () => '╰┄┄┄┄┄┄┄┄┄┄┄┄⪼';

const buildFrame = (title, lines) =>
  [frameHeader(title), ...lines, frameFooter()].join('\n');

const listHeader = title => `╭『 ${toUnicode(title)} 』`;
const listItem = (n, label) =>
  `┊${String(n).padStart(2)} ⟩⟩ ${label}`;

const bullet = (label, value) =>
  `│✦ ${toUnicode(label)}${value === undefined ? '' : `: ${value}`}`;

const row = text => `│ ${text}`;
const blank = () => '│';
const title = text => `│「 ${text} 」`;
const note = text => `│✦ ${text}`;

/* ─────────────── COULEURS TERMINAL ─────────────── */

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[96m',
  blue: '\x1b[94m',
  green: '\x1b[92m',
  yellow: '\x1b[93m',
  red: '\x1b[91m',
  white: '\x1b[97m',
  magenta: '\x1b[95m',
  gray: '\x1b[90m'
};

function supportsColor() {
  if (process.env.NO_COLOR !== undefined) return false;
  if (process.env.FORCE_COLOR === '0') return false;

  // Permet aussi les couleurs dans CMD Windows récent.
  if (process.env.FORCE_COLOR) return true;

  return Boolean(
    process.stdout &&
    process.stdout.isTTY &&
    process.env.TERM !== 'dumb'
  );
}

const paint = (text, color) =>
  supportsColor() ? `${color}${text}${ANSI.reset}` : String(text);

const cyan = text => paint(text, ANSI.cyan);
const green = text => paint(text, ANSI.green);
const yellow = text => paint(text, ANSI.yellow);
const red = text => paint(text, ANSI.red);
const gray = text => paint(text, ANSI.gray);
const white = text => paint(text, ANSI.white);
const bold = text => paint(text, ANSI.bold);
const magenta = text => paint(text, ANSI.magenta);

/* ─────────────── CADRES CONSOLE ─────────────── */

const BOX_W = 48;

const boxTop = () => `╔${'═'.repeat(BOX_W)}╗`;
const boxRule = () => `╠${'═'.repeat(BOX_W)}╣`;
const boxBottom = () => `╚${'═'.repeat(BOX_W)}╝`;

const boxRow = text => {
  const content = [...String(text)].slice(0, BOX_W - 2).join("");
  return `║ ${content.padEnd(BOX_W - 2)} ║`;
};
const box = (heading, rows = []) =>
  [
    boxTop(),
    boxRow(heading),
    boxRule(),
    ...rows.map(boxRow),
    boxBottom()
  ].join('\n');

const banner = (text, w = 46) =>
  [
    `┌${'─'.repeat(w)}┐`,
    `│${String(text).padEnd(w)}│`,
    `└${'─'.repeat(w)}┘`
  ].join('\n');

/* ─────────────── TABLEAU DE BORD AU DÉMARRAGE ─────────────── */

function renderStartupDashboard(status = {}) {
  const fit = value => {
    let result = String(value ?? 'Non disponible');

    // Évite de casser le cadre avec des retours à la ligne.
    result = result.replace(/[\r\n\t]/g, ' ');

    return [...result].slice(0, BOX_W).join('');
  };

  const statusValue = (value, fallback = 'INCONNU') =>
    value === undefined || value === null || value === ''
      ? fallback
      : String(value);

  const connection = statusValue(status.connection);
  const ai = statusValue(status.ai);
  const lastError = statusValue(status.lastError, 'aucune');

  const rows = [
    '',
    'DJOUSSE TECH EVOLUTION',
    'WHATSAPP AUTOMATION SYSTEM',
    'Des solutions fiables pour un avenir',
    'sans limites',
    '',
    'SYSTEME',
    `Processus : ${statusValue(status.process)}`,
    `Version bot : ${statusValue(status.version)}`,
    `Runtime Node.js : ${statusValue(status.nodeVersion)}`,
    `Stockage : ${statusValue(status.storage)}`,
    `Commandes : ${statusValue(status.commands, '0')} chargees`,
    `Plugins : ${statusValue(status.plugins, '0')} charges`,
    `Protections : ${statusValue(status.protections)}`,
    `Intelligence IA : ${ai}`,
    'Services externes : NON TESTES',
    '',
    'SESSION WHATSAPP',
    `ID : ${statusValue(status.sessionId)}`,
    `Connexion : ${connection}`,
    `Sessions actives : ${statusValue(status.activeSessions, '0')}`,
    `Derniere erreur : ${lastError}`,
    '',
    'DJOUSSE TECH EVOLUTION'
  ];

  const header = boxTop() + '\n' +
    boxRow('  DJOUSSE TECH | SYSTEM CONSOLE') + '\n' +
    boxRule();

  const content = rows.map((value, index) => {
    let line = fit(value);

    if (index === 1 || index === 2 || index === 3 || index === 4) {
      line = cyan(line);
    } else if (value === 'SYSTEME' || value === 'SESSION WHATSAPP') {
      line = bold(magenta(line));
    } else if (value.startsWith('Connexion :')) {
      const state = connection.toLowerCase();
      line = state.includes('connect') && !state.includes('disconnect')
        ? green(line)
        : state.includes('error') || state.includes('erreur')
          ? red(line)
          : yellow(line);
    } else if (value.startsWith('Derniere erreur :')) {
      line = lastError.toLowerCase() === 'aucune'
        ? green(line)
        : yellow(line);
    } else if (value.startsWith('Intelligence IA :')) {
      line = ai.toLowerCase().includes('activ')
        ? green(line)
        : yellow(line);
    } else if (value === 'Services externes : NON TESTES') {
      line = gray(line);
    } else if (value === 'DJOUSSE TECH EVOLUTION') {
      line = cyan(line);
    } else if (value.trim() !== '') {
      line = white(line);
    }

    return boxRow(line);
  });

  return [
    header,
    ...content,
    boxBottom()
  ].join('\n');
}

/* ─────────────── AFFICHAGE DES CATÉGORIES ─────────────── */

function dispWidth(str) {
  let width = 0;

  for (const ch of String(str)) {
    const code = ch.codePointAt(0);

    if (
      (code >= 0x1F000 && code <= 0x1FAFF) ||
      (code >= 0x2600 && code <= 0x27BF) ||
      (code >= 0x2B00 && code <= 0x2BFF) ||
      (code >= 0xFE00 && code <= 0xFE0F)
    ) {
      width += 2;
    } else {
      width += 1;
    }
  }

  return width;
}

const catBox = (emoji, label, count) => {
  const inner = `  ${emoji}  ${toUnicode(label)}  ⟨ ${count} ⟩`;
  const bar = '━'.repeat(Math.max(dispWidth(inner), 6));

  return `┏${bar}┓\n┃${inner}\n┗${bar}┛`;
};

const numItem = (n, cmd) =>
  `┊ ${toUnicode(String(n).padStart(2, '0'))} ⟩ .${cmd}`;

const backBox = label =>
  `╭${'┄'.repeat(14)}⪼\n${listItem(0, label)}\n${frameFooter()}`;

/* ─────────────── SIGNATURES ─────────────── */

function signature() {
  return `${toUnicode('MULTI-DEVICE WHATSAPP BOT')}\n${toUnicode('MADE BY')} DJOUSSE TECH`;
}

const signatureBox = () =>
  `╭${'┄'.repeat(14)}⪼\n${signature()
    .split('\n')
    .map(line => `│  ${line}`)
    .join('\n')}\n${frameFooter()}`;

/* ─────────────── MESSAGES DU BOT ─────────────── */

const renderNotice = (heading, lines) =>
  buildFrame(
    heading,
    lines.map(line => `│✦ ${toUnicode(line)}`)
  );

const renderInfo = lines => renderNotice('INFO', lines);
const renderSuccess = lines => renderNotice('SUCCÈS', lines);
const renderError = lines => renderNotice('ERREUR', lines);
const renderSaisie = hint => renderNotice('SAISISSEZ REQUIS', [hint]);

/* ─────────────── DATE ET HEURE ─────────────── */

const two = n => String(n).padStart(2, '0');

function nowTime() {
  const date = new Date();

  return `${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}`;
}

function nowDate() {
  const date = new Date();

  return `${two(date.getDate())}/${two(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/* ─────────────── EXPORTS COMPATIBLES ─────────────── */

module.exports = {
  toUnicode,
  frameHeader,
  frameFooter,
  buildFrame,
  listHeader,
  listItem,
  bullet,
  row,
  blank,
  title,
  note,
  box,
  banner,
  renderStartupDashboard,
  boxTop,
  boxRule,
  boxBottom,
  boxRow,
  BOX_W,
  catBox,
  numItem,
  dispWidth,
  backBox,
  signatureBox,
  signature,
  renderInfo,
  renderSuccess,
  renderError,
  renderSaisie,
  two,
  nowTime,
  nowDate
};
