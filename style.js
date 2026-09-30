'use strict';
/**
 * style.js — Style DJOUSSE TECH (moteur de rendu centralisé)
 * ────────────────────────────────────────────────────────────
 * UNIQUE source de vérité du design : handler.js ET guard/ l'utilisent.
 * Toute modification de l'identité visuelle se fait ICI, puis se propage partout.
 */

/* Alphabet Unicode officiel (titres, labels, noms de commandes) */
const MATH_MAP = {};
const buildMathRange = (start, chars) => {
  [...chars].forEach((c, i) => { MATH_MAP[c] = String.fromCodePoint(start + i); });
};
buildMathRange(0x1D670, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
buildMathRange(0x1D68A, 'abcdefghijklmnopqrstuvwxyz');
buildMathRange(0x1D7F6, '0123456789');

function toUnicode(str) {
  return String(str).replace(/[A-Za-z0-9]/g, (ch) => MATH_MAP[ch] || ch);
}

const frameHeader = (title) => `╭┄┄『 ${toUnicode(title)} 』┄❍`;
const frameFooter = () => `╰┄┄┄┄┄┄┄┄┄┄┄┄⪼`;
const buildFrame = (title, lines) => [frameHeader(title), ...lines, frameFooter()].join('\n');
const listHeader = (title) => `╭『 ${toUnicode(title)} 』`;
/* Numérotation officielle : 1 ⟩⟩ … 10 ⟩⟩ (padStart 2, jamais « 1. ») */
const listItem = (n, label) => `┊${String(n).padStart(2)} ⟩⟩ ${label}`;
const bullet = (label, value) => `│✦ ${toUnicode(label)}${value === undefined ? '' : `: ${value}`}`;

/* ── Lignes de cadre : SEULE source de l'alphabet │ « » ✦ ───────────────
   Aucun fichier hors de style.js ne doit écrire ces glyphes en dur
   (contrôle G4 « style » de scripts/audit.js). */
const row = (text) => `│ ${text}`;
const blank = () => '│';
const title = (text) => `│「 ${text} 」`;
const note = (text) => `│✦ ${text}`;

/* ── Cadres terminal (console) : SEULE source de l'alphabet ╔ ═ ║ ┌ ─ ┐ └ ┘ ── */
const BOX_W = 48;
const boxTop = () => `╔${'═'.repeat(BOX_W)}╗`;
const boxRule = () => `╠${'═'.repeat(BOX_W)}╣`;
const boxBottom = () => `╚${'═'.repeat(BOX_W)}╝`;
const boxRow = (text) => `║${String(text).padEnd(BOX_W)}║`;
/** Cadre de connexion : titre, filet, puis une ligne par entrée. */
const box = (heading, rows = []) =>
  [boxTop(), boxRow(heading), boxRule(), ...rows.map(boxRow), boxBottom()].join('\n');
/** Bannière légère : une seule ligne encadrée (nom du bot, etc.). */
const banner = (text, w = 46) =>
  [`┌${'─'.repeat(w)}┐`, `│${String(text).padEnd(w)}│`, `└${'─'.repeat(w)}┘`].join('\n');

/* Footer officiel — menus uniquement (pas sur les petits messages) */
function signature() {
  return `${toUnicode('MULTI-DEVICE WHATSAPP BOT')}\n${toUnicode('MADE BY')} DJOUSSE TECH`;
}

/* Réponses système — lignes fournies telles quelles (valeurs lisibles) */
const renderInfo = (lines) => buildFrame('INFO', lines.map((l) => `│✦ ${l}`));
const renderSuccess = (lines) => buildFrame('SUCCÈS', lines.map((l) => `│✦ ${l}`));
const renderError = (lines) => buildFrame('ERREUR', lines.map((l) => `│✦ ${toUnicode(l)}`));
const renderSaisie = (hint) => buildFrame('SAISISSEZ REQUIS', [`│✦ ${toUnicode(hint)}`]);

const two = (n) => String(n).padStart(2, '0');
function nowTime() {
  const d = new Date();
  return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
}
function nowDate() {
  const d = new Date();
  return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}`;
}

module.exports = {
  toUnicode, frameHeader, frameFooter, buildFrame, listHeader, listItem, bullet,
  row, blank, title, note, box, banner, boxTop, boxRule, boxBottom, boxRow, BOX_W,
  signature, renderInfo, renderSuccess, renderError, renderSaisie, two, nowTime, nowDate,
};
