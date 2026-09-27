/**
 * numberRouter.cjs — Routeur numérique du menu unifié
 * - "1" à "10"  : affiche la catégorie correspondante (style.renderCategoryMenu)
 * - "0"          : réaffiche le menu principal (style.renderMainMenu)
 * - dans une catégorie (expiration 5 min) : le numéro sélectionne une commande,
 *   le message est transformé en ".<nom>" et routé vers handler.js
 * État en mémoire : global.__djousseCategoryState (clé = jid)
 * DJOUSSE-TECH-MD
 */

const path = require('path');
const fs = require('fs');
const config = require('../../config');
const style = require('../../lib/djousse-style.cjs');
const { commandMap } = require('../command.cjs');

const STATE_TTL = 5 * 60 * 1000; // expiration : 5 minutes

// Stockage d'état partagé (global, par jid)
if (!global.__djousseCategoryState || !(global.__djousseCategoryState instanceof Map)) {
  global.__djousseCategoryState = new Map();
}
const store = () => global.__djousseCategoryState;

function getState(jid) {
  const s = store().get(jid);
  if (!s) return null;
  if (Date.now() - (s.timestamp || 0) > STATE_TTL) {
    store().delete(jid);
    return null;
  }
  return s;
}

function setState(jid, data) {
  store().set(jid, { ...data, timestamp: Date.now() });
}

// État "menu principal" (aucune catégorie active)
function setMainState(jid) {
  setState(jid, { categoryNum: 0, categoryLabel: 'MAIN', commands: [] });
}

// require paresseux : évite un cycle d'imports menu.cjs ↔ numberRouter.cjs
function getCategories() {
  return require('./menu.cjs').CATEGORIES;
}

// Charge les commandes RÉELLES d'un dossier commands/<dir>/ depuis commandMap
function loadCategoryCommands(dir) {
  const list = [];
  try {
    const dirPath = path.join(__dirname, '..', dir);
    const norm = (p) => String(p || '').replace(/\\/g, '/');
    const fileSet = new Set(
      fs.readdirSync(dirPath)
        .filter((f) => f.endsWith('.js') || f.endsWith('.cjs'))
        .map((f) => norm(path.join(dirPath, f)))
    );

    for (const [key, entry] of commandMap) {
      if (!entry || entry.name !== key) continue;              // ignore les alias
      if (typeof entry.name !== 'string') continue;            // ignore les patterns RegExp (jeux)
      if (!fileSet.has(norm(entry.filename))) continue;        // hors de ce dossier
      if (list.some((c) => c.name === entry.name)) continue;
      const desc = entry.desc ? String(entry.desc).replace(/\s+/g, ' ').trim() : '';
      list.push({ name: entry.name, desc });
    }
    list.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  } catch (e) {
    console.error(`[MENU] Lecture catégorie "${dir}":`, e.message);
  }
  return list;
}

async function renderMainMenu(sock, msg) {
  const categories = getCategories();
  await sock.sendMessage(msg.key.remoteJid, { text: style.renderMainMenu(categories) }, { quoted: msg });
  setMainState(msg.key.remoteJid);
}

/**
 * Réponse numérique → navigation entre catégories / menu principal.
 * @returns {boolean} true si le message a été traité
 */
async function handleNumericReply(sock, msg, body) {
  const jid = msg && msg.key && msg.key.remoteJid;
  const text = String(body == null ? '' : body).trim();
  if (!jid || !/^\d{1,2}$/.test(text)) return false;

  const num = parseInt(text, 10);

  // "0" → retour au menu principal (toujours, même depuis une catégorie)
  if (num === 0) {
    await renderMainMenu(sock, msg);
    return true;
  }

  // Une catégorie est active → la sélection appartient à handleCommandSelection
  const state = getState(jid);
  if (state && Array.isArray(state.commands) && state.commands.length > 0) return false;

  if (num < 1 || num > 10) return false;
  const cat = getCategories().find((c) => c.num === num);
  if (!cat) return false;

  const commands = loadCategoryCommands(cat.dir).map((c, i) => ({ ...c, num: i + 1 }));
  const textMenu = style.renderCategoryMenu(cat.label, cat.emoji, commands);
  await sock.sendMessage(jid, { text: textMenu }, { quoted: msg });

  setState(jid, { categoryNum: cat.num, categoryLabel: cat.label, commands });
  return true;
}

/**
 * Sélection d'une commande dans la catégorie active :
 * transforme le message en ".<nom>" et le route vers handler.js.
 * @returns {boolean} true si une commande a été routée
 */
async function handleCommandSelection(sock, msg, body) {
  const jid = msg && msg.key && msg.key.remoteJid;
  const text = String(body == null ? '' : body).trim();
  if (!jid || !/^\d{1,2}$/.test(text)) return false;
  if ((msg.__routeDepth || 0) >= 2) return false; // garde anti-récursion

  const state = getState(jid);
  if (!state || !Array.isArray(state.commands) || state.commands.length === 0) return false;

  const num = parseInt(text, 10);
  if (num < 1 || num > state.commands.length) return false;

  const entry = state.commands[num - 1];
  if (!entry || !entry.name) return false;

  // Sécurité : seule une commande réellement enregistrée peut être routée
  const target = commandMap.get(entry.name);
  if (!target || typeof target.execute !== 'function') return false;

  const { handleMessage } = require('../../handler.js');
  const routed = {
    ...msg,
    key: { ...msg.key },
    message: {
      extendedTextMessage: {
        text: `${config.prefix}${entry.name}`,
        contextInfo: extractContextInfo(msg),
      },
    },
    __fromMenu: true,
    __routeDepth: (msg.__routeDepth || 0) + 1,
  };

  await handleMessage(sock, routed);
  return true;
}

function extractContextInfo(msg) {
  const m = (msg && msg.message) || {};
  return m.extendedTextMessage?.contextInfo
    || m.imageMessage?.contextInfo
    || m.videoMessage?.contextInfo
    || {};
}

module.exports = {
  handleNumericReply,
  handleCommandSelection,
  setMainState,
  loadCategoryCommands,
};
