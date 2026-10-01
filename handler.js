'use strict';
/**
 * handler.js — Cerveau unique de DJOUSSE TECH MD
 * ────────────────────────────────────────────────
 * • Menu interactif par chiffres de 1 à 10 (navigation par catégories)
 * • Commandes textuelles (.prefix + nom) — 73 commandes dans 11 catégories
 * • Protections de groupe : antilink, antibad, antidelete, warns, blacklist,
 *   welcome/goodbye
 * • État persistant : session/state.json + mémoire session/history.json
 *
 * index.js délègue ici : messages.upsert → handleMessage(),
 * group-participants.update → handleGroupUpdate().
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const config = require('./config');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const sharp = require('sharp');
/* Stickers : fabrique interne (lib/wa-sticker.js) — remplace
   wa-sticker-formatter (conflit de DLL sharp@0.30 + 4 vulnérabilités). */
const { Sticker, StickerTypes } = require('./lib/wa-sticker');
const math = require('mathjs');
const QRCode = require('qrcode');
const { translate } = require('@vitalets/google-translate-api');
const yts = require('yt-search');
const https = require('https');
const ffmpegPath = require('ffmpeg-static');
const { initStore, getStore } = require('./lib/store');
const { initScheduler, getScheduler } = require('./lib/scheduler');
const { registerExtras } = require('./lib/extras');
/* Conversion vidéo via ffmpeg-static — helper partagé (voir lib/wa-sticker.js) */
const { ffmpegBuffer } = require('./lib/ffmpeg');
const { registerTools } = require('./lib/tools');
const { registerMissing } = require('./lib/missing');
/* Service unique d'envoi WhatsApp (G2) : tout envoi passe par send() */
const { send } = require('./lib/wa-send');
/* Durées éphémères partagées (.disappear ↔ .community ephemeral) */
const { parseEphemeral } = require('./lib/ephemeral');

/* ── DJOUSSE GUARD — moteur de protections de groupe (dossier guard/) ── */
const guardDb = require('./guard/src/db');
const guardEngine = require('./guard/src/engine');
const { parse: guardParse, unwrap, textOf, ctxInfo } = require('./guard/src/utils/message');
const guardPerms = require('./guard/src/utils/perms');
const guardEvents = require('./guard/src/events');
const guardUi = require('./guard/src/ui');
const { findLinks } = require('./guard/src/utils/links');
const { formatDuration } = require('./guard/src/utils/time');
const {
  toUnicode, frameFooter, buildFrame, listHeader, listItem, bullet, signature,
  renderInfo, renderSuccess, renderError, renderSaisie, nowTime, nowDate,
  row, blank, title, note,
} = require('./style');
const guardSanctions = require('./guard/src/sanctions');
const guardRegistry = require('./guard/src/commands');
const guardProtections = require('./guard/src/protections');
/* Base du moteur : initialisation paresseuse (tests locaux sans index.js) */
try { guardDb.db(); } catch (e) { guardDb.init(path.join(__dirname, config.sessionDir, config.guard.dbFile)); }

/* ════════════════════════════════════════════════════════════
   1. ÉTAT PERSISTANT — session/state.json
   ════════════════════════════════════════════════════════════ */

const STATE_FILE = path.join(__dirname, config.sessionDir, 'state.json');

function defaultState() {
  return {
    settings: { selfMode: config.selfMode },
    groups: {},
    users: {},
    blacklist: [],
    stats: { messages: 0, commands: 0, since: Date.now() },
  };
}

function loadState() {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    const base = defaultState();
    return {
      ...base,
      ...raw,
      settings: { ...base.settings, ...(raw.settings || {}) },
      stats: { ...base.stats, ...(raw.stats || {}) },
      groups: raw.groups || {},
      users: raw.users || {},
      blacklist: Array.isArray(raw.blacklist) ? raw.blacklist : [],
    };
  } catch (e) {
    return defaultState();
  }
}

const state = loadState();
try {
  initStore(path.join(__dirname, config.sessionDir));
  initScheduler(path.join(__dirname, config.sessionDir));
} catch (e) {
  console.error('[INIT] store/scheduler:', e.message);
}
// Secours : si FORCE_PUBLIC=1 dans .env, on force le mode public à chaque démarrage
if (process.env.FORCE_PUBLIC === '1' || process.env.FORCE_PUBLIC === 'true') {
  state.settings.selfMode = false;
  console.log('[STATE] FORCE_PUBLIC=1 → selfMode désactivé');
}

/* welcome / goodbye OFF pour TOUS les groupes (défaut + state existant) */
{
  state.groups = state.groups || {};
  let n = 0;
  for (const gid of Object.keys(state.groups)) {
    const g = state.groups[gid];
    if (!g) continue;
    if (g.welcome) { g.welcome = false; n++; }
    if (g.goodbye) { g.goodbye = false; n++; }
  }
  config.defaultGroupSettings.welcome = false;
  config.defaultGroupSettings.goodbye = false;
  if (n) console.log(`[STATE] welcome/goodbye forcés OFF (${n} drapeaux)`);
  else console.log('[STATE] welcome/goodbye OFF (tous les groupes)');
  // Écriture directe : saveState() n'est pas encore initialisé ici
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    const tmp = STATE_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, STATE_FILE);
  } catch (e) {
    console.error('[STATE] Écriture impossible:', e.message);
  }
}

// Restaurer les owners découverts à la connexion précédente (session = owner)
if (Array.isArray(state.settings?.owners) && state.settings.owners.length) {
  const merged = new Set([
    ...(config.ownerNumber || []).map((n) => String(n).replace(/\D/g, '')),
    ...state.settings.owners.map((n) => String(n).replace(/\D/g, '')),
  ].filter(Boolean));
  config.ownerNumber = [...merged];
}
if (state.settings?.sessionOwner) {
  const so = String(state.settings.sessionOwner).replace(/\D/g, '');
  if (so && !config.ownerNumber.includes(so)) config.ownerNumber.push(so);
}
let saveTimer = null;

function saveState(immediate = false) {
  const write = () => {
    try {
      fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
      const tmp = STATE_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
      fs.renameSync(tmp, STATE_FILE);
    } catch (e) {
      console.error('[STATE] Écriture impossible:', e.message);
    }
  };
  if (immediate) {
    clearTimeout(saveTimer);
    saveTimer = null;
    return write();
  }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(write, 800);
}

function getGroup(jid) {
  if (!state.groups[jid]) {
    state.groups[jid] = { ...config.defaultGroupSettings };
  } else {
    state.groups[jid] = { ...config.defaultGroupSettings, ...state.groups[jid] };
  }
  return state.groups[jid];
}

function getUser(num) {
  if (!state.users[num]) state.users[num] = { xp: 0, afk: null };
  return state.users[num];
}

process.on('exit', () => saveState(true));

/* ════════════════════════════════════════════════════════════
   2. UTILITAIRES
   ════════════════════════════════════════════════════════════ */

const num = guardPerms.jidNum;
/** Owners fixes (.env + session) + sudo autorisés (state.settings.sudo) */
function getSudoList() {
  const fromEnv = (process.env.SUDO_NUMBER || '')
    .split(/[,\s]+/)
    .map((x) => String(x).replace(/\D/g, ''))
    .filter(Boolean);
  const fromState = Array.isArray(state.settings?.sudo)
    ? state.settings.sudo.map((x) => String(x).replace(/\D/g, '')).filter(Boolean)
    : [];
  return [...new Set([...fromEnv, ...fromState])];
}

function isPrimaryOwner(n) {
  const num_ = String(n || '').replace(/\D/g, '');
  return config.ownerNumber.some((o) => o === num_ || num_.endsWith(o) || o.endsWith(num_));
}

function isSudoNumber(n) {
  const num_ = String(n || '').replace(/\D/g, '');
  if (!num_) return false;
  return getSudoList().some((o) => o === num_ || num_.endsWith(o) || o.endsWith(num_));
}

const isOwnerJid = (jid) => {
  if (!jid) return false;
  const n = num(jid);
  if (!n) return false;
  if (isPrimaryOwner(n) || isSudoNumber(n)) return true;
  return config.ownerNumber.some((o) => o === n || n.endsWith(o) || o.endsWith(n));
};

/* Message « vue unique » (view once) — détection sur le brut,
   AVANT unwrap (les wrappers portent l'information) */
function isOnceContent(raw) {
  return !!(
    raw &&
    (raw.viewOnceMessage || raw.viewOnceMessageV2 || raw.viewOnceMessageV2Extension)
  );
}

/* textOf() et ctxInfo() ne sont plus définis ici : implementations uniques
   du projet, déplacées dans guard/src/utils/message.js (G4 « parseurs »).
   handler.js les importe en tête de fichier, comme unwrap/parse. */

/* Cache des messages (antidelete / getMessage / edit / pin) : `${chat}|${id}` → message complet
   Branché sur makeWASocket({ getMessage }) pour retry, polls, édition. */
const msgCache = new Map();
function putCache(jid, id, msg) {
  if (!jid || !id || !msg) return;
  msgCache.set(`${jid}|${id}`, { msg, ts: Date.now() });
  const max = config.msgCacheMax || 800;
  while (msgCache.size > max) {
    const oldest = msgCache.keys().next().value;
    msgCache.delete(oldest);
  }
  try {
    const st = getStore();
    if (st) st.put(jid, id, msg);
  } catch (_) {}
}
function getCache(jid, id) {
  return msgCache.get(`${jid}|${id}`) || null;
}
/** Callback Baileys getMessage — retourne le message brut (proto) ou undefined */
async function getMessageForBaileys(key) {
  if (!key?.remoteJid || !key?.id) return undefined;
  const hit = getCache(key.remoteJid, key.id);
  if (hit?.msg?.message) return hit.msg.message;
  try {
    const st = getStore();
    if (st) return await st.getMessage(key);
  } catch (_) {}
  return undefined;
}

/* Métadonnées + rôles : UNE seule implémentation (guard/src/utils/perms) et UN seul cache,
   invalidé par index.js (group-participants.update) → reprise immédiate quand le bot est promu. */
const groupMeta = guardPerms.groupMeta;
const findParticipant = guardPerms.findParticipant;
const isAdminIn = guardPerms.isParticipantAdmin;
const botIsAdmin = guardPerms.botIsAdmin;

/* Limitation de débit : 10 commandes / 10 s par expéditeur */
const rateMap = new Map();
function rateOk(sender) {
  const now = Date.now();
  let r = rateMap.get(sender);
  if (!r || now - r.ts > 10000) {
    r = { count: 0, ts: now };
    rateMap.set(sender, r);
  }
  r.count += 1;
  return r.count <= 10;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, r] of rateMap) if (now - r.ts > 30000) rateMap.delete(k);
}, 30000).unref();

/* Présence Baileys : indicateur « écrit... » pendant l'exécution d'une commande */
function typingOn(sock, jid) {
  if (config.autoTyping && jid) sock.sendPresenceUpdate('composing', jid).catch(() => {});
}
function typingOff(sock, jid) {
  if (config.autoTyping && jid) sock.sendPresenceUpdate('paused', jid).catch(() => {});
}

/* ════════════════════════════════════════════════════════════
   2bis. MÉMOIRE CONTEXTUELLE — derniers messages par chat (RAM)
   ════════════════════════════════════════════════════════════ */

const history = new Map(); // jid → [{ s, t, ts }] (max 10/chat, 300 chats)
const HISTORY_FILE = path.join(path.dirname(STATE_FILE), 'history.json');
let historyDirty = false;

function remember(jid, senderNum, text) {
  if (!jid || !text) return;
  let arr = history.get(jid);
  if (arr) {
    history.delete(jid); // refresh pour l'ordre d'éviction
  } else {
    arr = [];
    if (history.size >= 300) history.delete(history.keys().next().value);
  }
  history.set(jid, arr);
  arr.push({ s: senderNum, t: text.slice(0, 200), ts: Date.now() });
  if (arr.length > 10) arr.shift();
  historyDirty = true;
}

function loadHistory() {
  try {
    const raw = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    if (raw && typeof raw === 'object') {
      for (const [k, v] of Object.entries(raw)) {
        if (Array.isArray(v) && v.length) history.set(k, v.slice(-10));
      }
    }
  } catch (e) { /* premier lancement : pas d'historique */ }
}

function flushHistory(force = false) {
  if (!historyDirty && !force) return;
  if (!history.size) return;
  try {
    const tmp = HISTORY_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(history)));
    fs.renameSync(tmp, HISTORY_FILE);
    historyDirty = false;
  } catch (e) {
    console.error('[HISTORY] Écriture impossible:', e.message);
  }
}

loadHistory();
setInterval(() => flushHistory(), 15000).unref();
process.on('exit', () => flushHistory(true));

/* Date française « JJ/MM/AAAA [HH:MM] » → Date locale (défaut 18h) */
function parseFrDate(s) {
  const m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,]+(\d{1,2})[:hH](\d{2}))?/);
  if (!m) return null;
  const dd = +m[1], mo = +m[2], yyyy = +m[3];
  if (mo < 1 || mo > 12 || dd < 1 || dd > 31) return null;
  const d = new Date(yyyy, mo - 1, dd, m[4] ? +m[4] : 18, m[5] ? +m[5] : 0);
  return isNaN(d.getTime()) ? null : d;
}

/* Téléchargement de média (cible = message cité ou message courant) */
function mediaInfo(msg) {
  const content = unwrap(msg.message);
  const ci = ctxInfo(content);
  if (ci?.quotedMessage) {
    const q = unwrap(ci.quotedMessage);
    const type = Object.keys(q).find((k) => k.endsWith('Message') && q[k]?.mimetype);
    if (type) {
      return {
        target: {
          key: {
            remoteJid: msg.key.remoteJid,
            id: ci.stanzaId,
            participant: ci.participant,
            fromMe: false,
          },
          message: ci.quotedMessage,
        },
        mimetype: q[type].mimetype,
        type,
        content: q,
      };
    }
  }
  const type = Object.keys(content).find((k) => k.endsWith('Message') && content[k]?.mimetype);
  if (type) return { target: msg, mimetype: content[type].mimetype, type, content };
  return null;
}

async function downloadFrom(sock, info) {
  return downloadMediaMessage(info.target, 'buffer', {}, {
    logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, trace: () => {} },
    reuploadRequest: (m) => sock.updateMediaMessage(m),
  });
}

/* ════════════════════════════════════════════════════════════
   AUTO-SAUVEGARDE VUE UNIQUE (.autonce on)
   WhatsApp interdit de conserver un média « vue unique » :
   quand l'option est active sur un chat, chaque média vue unique
   reçu est téléchargé et envoyé en privé au propriétaire.
   ════════════════════════════════════════════════════════════ */
async function autoSaveOnce(sock, msg, content, from, sender) {
  try {
    const isVideo = !!content.videoMessage;
    if (!isVideo && !content.imageMessage) return;
    state.onceCd = state.onceCd || {};
    if (state.onceCd[from] && Date.now() - state.onceCd[from] < 60000) return;
    state.onceCd[from] = Date.now();
    const ownerJid = `${config.ownerNumber[0]}@s.whatsapp.net`;
    const buffer = await downloadFrom(sock, { target: msg });
    const chatLabel = from.endsWith('@g.us') ? `GROUPE ${num(from)}` : 'CHAT PRIVÉ';
    const caption = renderSuccess([
      'VUE UNIQUE RÉCUPÉRÉE',
      `DE: +${num(sender)}`,
      `CHAT: ${chatLabel}`,
    ]);
    const payload = isVideo ? { video: buffer, caption } : { image: buffer, caption };
    await send(sock, ownerJid, payload);
  } catch (e) {
    console.error('[AUTONCE]', e.message);
  }
}

async function toAudioBuffer(input, ext) {
  const base = path.join(os.tmpdir(), `dj_${Date.now()}_${Math.floor(Math.random() * 1e5)}`);
  const inFile = `${base}.${ext || 'mp4'}`;
  const outFile = `${base}.mp3`;
  fs.writeFileSync(inFile, input);
  try {
    await new Promise((resolve, reject) => {
      const p = spawn(ffmpegPath, ['-y', '-i', inFile, '-vn', '-ac', '2', '-ab', '128k', '-ar', '44100', '-f', 'mp3', outFile]);
      let err = '';
      p.stderr.on('data', (d) => (err += d.toString()));
      p.on('error', reject);
      p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg code ${code}: ${err.slice(-200)}`))));
    });
    return fs.readFileSync(outFile);
  } finally {
    try { fs.unlinkSync(inFile); } catch (e) {}
    try { fs.unlinkSync(outFile); } catch (e) {}
  }
}

async function askGemini(prompt, media = null) {
  if (!config.geminiKey) return null;
  /* gemini-flash-latest : alias maintenu par Google (gemini-2.0-flash retiré) */
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${config.geminiKey}`;
  const parts = [{ text: prompt }];
  if (media?.data?.length) {
    parts.push({ inline_data: { mime_type: media.mime, data: media.data.toString('base64') } });
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts }] }),
  });
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim();
  if (text) return text;
  throw new Error(json?.error?.message || 'Réponse IA vide');
}

/* ════════════════════════════════════════════════════════════
   3. REGISTRE DES COMMANDES + CATÉGORIES (menu 1 → 11)
   ════════════════════════════════════════════════════════════ */

const commands = new Map();

function cmd(names, opts, handler) {
  /* Formes acceptées :
     cmd(['nom', 'alias'], opts, fn)
     cmd('nom', ['alias'], opts, fn)  ← réalignement des arguments */
  if (Array.isArray(opts)) {
    const aliases = opts;
    opts = handler;
    handler = arguments[3];
    names = Array.isArray(names) ? names : [names, ...aliases];
  }
  const arr = Array.isArray(names) ? names : [names];
  const entry = {
    name: arr[0].toLowerCase(),
    aliases: arr.slice(1).map((a) => a.toLowerCase()),
    cat: opts.cat || 1,
    desc: opts.desc || '',
    usage: opts.usage || '',
    group: !!opts.group,
    admin: !!opts.admin,
    botAdmin: !!opts.botAdmin,
    owner: !!opts.owner,
    /* Métadonnées registre (menus dynamiques) */
    icon: opts.icon || '',
    enabled: opts.enabled !== false,
    requiresInput: !!opts.requiresInput,
    permission: opts.owner ? 'OWNER'
      : opts.admin ? 'GROUP_ADMIN'
      : opts.botAdmin ? 'BOT_ADMIN'
      : opts.group ? 'GROUP'
      : 'PUBLIC',
    handler,
  };
  commands.set(entry.name, entry);
  for (const a of entry.aliases) commands.set(a, entry);
}

/* ════════════════════════════════════════════════════════════
   3bis. STYLE DJOUSSE TECH — voir style.js (source unique du design,
   partagée avec guard/) : toute modification s'y fait, puis se propage.
   ════════════════════════════════════════════════════════════ */

/* Le moteur de rendu (toUnicode, buildFrame, bullet, render*) vit dans style.js — importé en tête de fichier. */

const CATEGORIES = [
  { n: 1, label: 'GÉNÉRAL', emoji: '🌟' },
  { n: 2, label: 'GROUPE', emoji: '👥' },
  { n: 3, label: 'PROTECTION', emoji: '🛡️' },
  { n: 4, label: 'STICKER & MEDIA', emoji: '🖼️' },
  { n: 5, label: 'OUTILS', emoji: '🧰' },
  { n: 6, label: 'IA', emoji: '🤖' },
  { n: 7, label: 'FUN', emoji: '🎲' },
  { n: 8, label: 'RECHERCHE', emoji: '🔍' },
  { n: 9, label: 'OWNER', emoji: '👑' },
  { n: 10, label: 'DIVERS', emoji: '📦' },
  { n: 11, label: 'TÉLÉCHARGEMENT', emoji: '⬇️' },
];

/* Commandes VISIBLES d'une catégorie pour un profil donné :
   existante + activée + permissions suffisantes (§13/§15).
   Une catégorie sans aucune commande visible n'est jamais affichée. */
function visibleCommands(cat, base) {
  const seen = new Set();
  const list = [];
  const isOwner = !!base?.isOwner;
  const isAdmin = !!base?.isAdmin || isOwner;
  for (const c of commands.values()) {
    if (c.cat !== cat || seen.has(c.name) || c.enabled === false) continue;
    // OWNER : uniquement owners / sudo
    if (c.owner && !isOwner) continue;
    // ADMIN groupe : uniquement admin du groupe ou owner/sudo
    if (c.admin && !isAdmin) continue;
    // Catégorie 9 entière réservée owner (sécurité menu)
    if (cat === 9 && !isOwner) continue;
    seen.add(c.name);
    list.push(c);
  }
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

/* ── MENU PRINCIPAL : en-tête + CADRAN DES CATÉGORIES uniquement ── */
function renderMainMenu(base) {
  const header = buildFrame('INFO BOT', [
    bullet('PREFIX', `〔${config.prefix}〕`),
    bullet('BOT', config.botName),
    bullet('TIME', nowTime()),
    bullet('DATE', nowDate()),
    title(toUnicode('STATUS PANEL')),
    row(toUnicode('REPLY WITH A NUMBER')),
  ]);

  const cats = CATEGORIES
    .map((c) => ({ ...c, list: visibleCommands(c.n, base) }))
    .filter((c) => c.list.length > 0); // jamais de catégorie vide (§1)

  const catLines = cats.map((c) => listItem(c.n, `${c.emoji} ${toUnicode(`${c.label} MENU`)}`));
  const list = [listHeader('CATEGORIES'), ...catLines, frameFooter()].join('\n');

  return `${header}\n\n${list}\n\n${signature()}`;
}

/* ── SOUS-MENU : les SEULES commandes de la catégorie ── */
function renderCategory(catNum, base) {
  const cat = CATEGORIES.find((c) => c.n === catNum);
  const list = visibleCommands(catNum, base);

  const header = buildFrame(`${cat.label} MENU`, [
    bullet('PREFIX', `〔${config.prefix}〕`),
    bullet('COMMANDS', String(list.length)),
    title(toUnicode('REPLY WITH A NUMBER')),
  ]);

  const items = list.map((c, i) => listItem(i + 1, `${c.icon || cat.emoji} ${toUnicode(c.name.toUpperCase())}`));
  const listBlock = [listHeader('COMMANDS'), ...items, frameFooter()].join('\n');
  const back = listItem(0, `⬅️ ${toUnicode('RETOUR')}`);

  return `${header}\n\n${listBlock}\n\n${back}\n\n${signature()}`;
}

/* État du menu par chat : { cat: 0|1..10, ts } — TTL 5 minutes */
const menuState = new Map();
const MENU_TTL = 5 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of menuState) if (now - v.ts > MENU_TTL) menuState.delete(k);
}, 60000).unref();

function setMenu(chat, cat) {
  menuState.set(chat, { cat, ts: Date.now() });
}

/* ── Saisie en attente (§9) : commande « requiresInput » appelée sans
     argument → le PROCHAIN message texte du même chat devient l'argument.
     TTL 2 minutes, « annuler » abandonne, jamais hors du chat d'origine. */
const pendingInput = new Map();
const INPUT_TTL = 2 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of pendingInput) if (now - v.ts > INPUT_TTL) pendingInput.delete(k);
}, 60000).unref();

function setInput(chat, cmdName, usage) {
  pendingInput.set(chat, { cmd: cmdName, usage: usage || cmdName, ts: Date.now() });
}
function peekInput(chat) {
  const st = pendingInput.get(chat);
  if (!st) return null;
  if (Date.now() - st.ts > INPUT_TTL) { pendingInput.delete(chat); return null; }
  return st;
}
function clearInput(chat) {
  pendingInput.delete(chat);
}

/* ════════════════════════════════════════════════════════════
   4. DÉFINITION DES COMMANDES (~65)
   ════════════════════════════════════════════════════════════ */

/* ── 1. GÉNÉRAL ───────────────────────────────────────────── */


/* ── Image du menu (légère < ~200 Ko) ── */
const MENU_IMG_PATHS = [
  path.join(__dirname, 'assets', 'menu.jpg'),
  path.join(__dirname, 'assets', 'menu.png'),
  path.join(__dirname, 'assets', 'bot.jpg'),
  path.join(__dirname, 'assets', 'bot.png'),
];

let _menuImgCache = null;
let _menuImgTs = 0;

async function getMenuImageBuffer() {
  // Cache 5 min
  if (_menuImgCache && Date.now() - _menuImgTs < 5 * 60 * 1000) return _menuImgCache;

  for (const p of MENU_IMG_PATHS) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p);
        // Compresser si trop lourd (> 400 Ko)
        if (raw.length > 400 * 1024) {
          _menuImgCache = await sharp(raw)
            .resize(800, 450, { fit: 'cover' })
            .jpeg({ quality: 72, mozjpeg: true })
            .toBuffer();
        } else if (p.endsWith('.png')) {
          _menuImgCache = await sharp(raw)
            .resize(800, 450, { fit: 'inside' })
            .jpeg({ quality: 80 })
            .toBuffer();
        } else {
          _menuImgCache = raw;
        }
        _menuImgTs = Date.now();
        return _menuImgCache;
      }
    } catch (_) {}
  }

  // Bannière générée (très légère) — style DJOUSSE
  const name = (config.botName || 'DJOUSSE-TECH-MD').slice(0, 22);
  const svg = Buffer.from(`<svg width="800" height="450" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f0c29"/>
      <stop offset="50%" stop-color="#302b63"/>
      <stop offset="100%" stop-color="#24243e"/>
    </linearGradient>
  </defs>
  <rect width="800" height="450" fill="url(#g)"/>
  <rect x="24" y="24" width="752" height="402" rx="16" fill="none" stroke="#00d2ff" stroke-width="3"/>
  <text x="400" y="180" text-anchor="middle" font-family="Arial,sans-serif" font-size="42" font-weight="bold" fill="#00d2ff">${name.replace(/[<>&]/g,'')}</text>
  <text x="400" y="240" text-anchor="middle" font-family="Arial,sans-serif" font-size="28" fill="#ffffff">MULTI-DEVICE WHATSAPP BOT</text>
  <text x="400" y="300" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" fill="#a0aec0">MADE BY DJOUSSE TECH</text>
  <text x="400" y="360" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" fill="#718096">prefix  ${config.prefix || '.'}menu</text>
</svg>`);
  _menuImgCache = await sharp(svg).jpeg({ quality: 78 }).toBuffer();
  _menuImgTs = Date.now();
  return _menuImgCache;
}

async function sendMenu(sock, jid, text, quoted) {
  try {
    const img = await getMenuImageBuffer();
    await send(sock, jid, { image: img, caption: text }, quoted ? { quoted } : undefined);
  } catch (e) {
    console.error('[MENU] image:', e.message);
    await send(sock, jid, { text }, quoted ? { quoted } : undefined);
  }
}

cmd('menu', { cat: 1, desc: 'Menu interactif par chiffres', icon: '📋' }, async (ctx) => {
  setMenu(ctx.from, 0);
  await sendMenu(ctx.sock, ctx.from, renderMainMenu(ctx), ctx.msg);
});

cmd('setmenuimg', ['menupic'], {
  cat: 9, desc: 'Définir l’image du .menu (répondre à une photo)', usage: 'setmenuimg', owner: true, icon: '🖼️',
}, async (ctx) => {
  const info = mediaInfo(ctx.msg);
  if (!info || !String(info.mimetype || '').startsWith('image/')) {
    return ctx.error(['RÉPONDS À UNE IMAGE LÉGÈRE', 'IDÉAL < 500 KO']);
  }
  try {
    const buf = await downloadFrom(ctx.sock, info);
    const out = await sharp(buf)
      .resize(800, 450, { fit: 'cover' })
      .jpeg({ quality: 75, mozjpeg: true })
      .toBuffer();
    const dir = path.join(__dirname, 'assets');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'menu.jpg'), out);
    _menuImgCache = out;
    _menuImgTs = Date.now();
    await ctx.success(['IMAGE MENU ENREGISTRÉE', `${Math.round(out.length / 1024)} KO`, 'RELANCER .MENU POUR VOIR']);
  } catch (e) {
    await ctx.error(['SETMENUIMG', e.message]);
  }
});


cmd('ping', { cat: 1, desc: 'Latence du bot', icon: '🏓' }, async (ctx) => {
  const latency = ctx.msg.messageTimestamp
    ? Date.now() - Number(ctx.msg.messageTimestamp) * 1000
    : 0;
  await ctx.reply(buildFrame('PING', [
    bullet('STATUT', `${toUnicode('ONLINE')} ✅`),
    bullet('LATENCE', `${Math.max(0, latency)} ms`),
    bullet('UPTIME', formatDuration(process.uptime() * 1000)),
    bullet('NODE', process.version),
  ]));
});

cmd('info', { cat: 1, desc: 'Informations du bot', icon: 'ℹ️' }, async (ctx) => {
  await ctx.reply(buildFrame('INFO', [
    bullet('NOM', config.botName),
    bullet('VERSION', config.version),
    bullet('PREFIX', `〔${config.prefix}〕`),
    bullet('OWNER', `${config.botOwnerName} (+${config.ownerNumber[0]})`),
    bullet('NODE', process.version),
    bullet('UPTIME', formatDuration(process.uptime() * 1000)),
    bullet('MODE', state.settings.selfMode ? toUnicode('SELF') : toUnicode('PUBLIC')),
  ]));
});

cmd('uptime', { cat: 1, desc: 'Temps de fonctionnement', icon: '⏱️' }, async (ctx) => {
  await ctx.reply(buildFrame('UPTIME', [
    bullet('EN LIGNE DEPUIS', formatDuration(process.uptime() * 1000)),
  ]));
});

cmd('owner', { cat: 1, desc: 'Contacter le propriétaire' }, async (ctx) => {
  const n = config.ownerNumber[0];
  const vcard =
    `BEGIN:VCARD\nVERSION:3.0\nFN:${config.botOwnerName}\n` +
    `TEL;type=CELL;type=VOICE;waid=${n}:+${n}\nEND:VCARD`;
  await send(ctx.sock, ctx.from, {
    contacts: { displayName: config.botOwnerName, contacts: [{ vcard }] },
  }, { quoted: ctx.msg });
});

cmd('source', { cat: 1, desc: 'Code source du bot' }, async (ctx) => {
  await ctx.reply(`📂 Code source :\n${config.social.github}`);
});

cmd('list', { cat: 1, desc: 'Toutes les commandes', icon: '📜' }, async (ctx) => {
  const blocks = [listHeader('ALL COMMANDS')];
  for (const cat of CATEGORIES) {
    const list = visibleCommands(cat.n, ctx);
    if (!list.length) continue;
    blocks.push(`${cat.emoji} ${toUnicode(cat.label)}`);
    blocks.push(list.map((c) => `.${c.name}`).join('  '));
    blocks.push('');
  }
  blocks.push(frameFooter());
  await ctx.reply(`${blocks.join('\n').trimEnd()}\n\n${signature()}`);
});

/* ── 2. GROUPE ────────────────────────────────────────────── */

function targetFrom(ctx) {
  const ci = ctxInfo(ctx.content);
  if (ci?.mentionedJid?.length) return ci.mentionedJid[0];
  if (ci?.participant) return ci.participant;
  const raw = (ctx.q || '').match(/\d{5,}/);
  if (raw) return `${raw[0]}@s.whatsapp.net`;
  return null;
}

async function participantsUpdate(ctx, action, label) {
  const target = targetFrom(ctx);
  if (!target) return ctx.reply(`❌ Mentionne la personne : ${config.prefix}${action} @user`);
  const meta = await groupMeta(ctx.sock, ctx.from);
  const p = findParticipant(meta, target);
  const id = p?.id || target;
  try {
    await ctx.sock.groupParticipantsUpdate(ctx.from, [id], label);
    await ctx.react('✅');
    await ctx.reply(`✅ ${label === 'remove' ? 'Expulsé' : label === 'promote' ? 'Promu admin' : 'Rétrogradé'} : +${num(target)}`);
  } catch (e) {
    await ctx.reply(`❌ Échec : ${e.message}`);
  }
}

cmd('kick', { cat: 2, desc: 'Expulser un membre', usage: 'kick @user', group: true, admin: true, botAdmin: true }, async (ctx) => participantsUpdate(ctx, 'kick', 'remove'));
cmd('promote', { cat: 2, desc: 'Promouvoir admin', usage: 'promote @user', group: true, admin: true, botAdmin: true }, async (ctx) => participantsUpdate(ctx, 'promote', 'promote'));
cmd('demote', { cat: 2, desc: 'Retirer le statut admin', usage: 'demote @user', group: true, admin: true, botAdmin: true }, async (ctx) => participantsUpdate(ctx, 'demote', 'demote'));

cmd('tagall', { cat: 2, desc: 'Mentionner tout le groupe', usage: 'tagall [message]', group: true, admin: true }, async (ctx) => {
  const meta = await groupMeta(ctx.sock, ctx.from);
  const ids = meta.participants.map((p) => p.id).filter(Boolean);
  const mentions = meta.participants.map((p) => p.phoneNumber || p.id).filter(Boolean);
  const text = `${ctx.q ? ctx.q + '\n\n' : ''}${mentions.map((j) => `@${num(j)}`).join(' ')}`;
  await send(ctx.sock, ctx.from, { text, mentions: ids }, { quoted: ctx.msg });
});

cmd('hidetag', { cat: 2, desc: 'Mention invisible', usage: 'hidetag [message]', group: true, admin: true }, async (ctx) => {
  const meta = await groupMeta(ctx.sock, ctx.from);
  const ids = meta.participants.map((p) => p.id).filter(Boolean);
  await send(ctx.sock, ctx.from, { text: ctx.q || '👋', mentions: ids }, { quoted: ctx.msg });
});

cmd('groupinfo', { cat: 2, desc: 'Infos du groupe', group: true }, async (ctx) => {
  const meta = await groupMeta(ctx.sock, ctx.from);
  if (!meta) return ctx.reply('❌ Groupe introuvable.');
  const admins = meta.participants.filter((p) => p.admin).length;
  await ctx.reply(
    buildFrame('GROUP INFO', [
      row(`*${meta.subject || 'Groupe'}*`),
      blank(),
      row(`ID : ${meta.id}`),
      row(`Membres : ${meta.participants.length}`),
      row(`Admins : ${admins}`),
      row(`Créé : ${meta.creation ? new Date(meta.creation * 1000).toLocaleDateString('fr-FR') : '?'}`),
    ])
  );
});

cmd('setname', { cat: 2, desc: 'Changer le nom du groupe', usage: 'setname <nom>', group: true, admin: true, botAdmin: true }, async (ctx) => {
  if (!ctx.q) return ctx.reply(`❌ Usage : ${config.prefix}setname Mon groupe`);
  await ctx.sock.groupUpdateSubject(ctx.from, ctx.q.slice(0, 100));
  await ctx.reply('✅ Nom du groupe modifié.');
});

cmd('setdesc', { cat: 2, desc: 'Changer la description', usage: 'setdesc <texte>', group: true, admin: true, botAdmin: true }, async (ctx) => {
  if (!ctx.q) return ctx.reply(`❌ Usage : ${config.prefix}setdesc Description...`);
  await ctx.sock.groupUpdateDescription(ctx.from, ctx.q.slice(0, 500));
  await ctx.reply('✅ Description modifiée.');
});

cmd('open', { cat: 2, desc: 'Ouvrir le groupe', group: true, admin: true, botAdmin: true }, async (ctx) => {
  await ctx.sock.groupSettingUpdate(ctx.from, 'not_announcement');
  await ctx.reply('🔓 Tous les membres peuvent écrire.');
});

cmd('close', { cat: 2, desc: 'Fermer le groupe (admins)', group: true, admin: true, botAdmin: true }, async (ctx) => {
  await ctx.sock.groupSettingUpdate(ctx.from, 'announcement');
  await ctx.reply('🔒 Seuls les admins peuvent écrire.');
});

cmd('link', { cat: 2, desc: 'Lien d’invitation', group: true, admin: true }, async (ctx) => {
  try {
    const code = await ctx.sock.groupInviteCode(ctx.from);
    await ctx.reply(`🔗 https://chat.whatsapp.com/${code}`);
  } catch (e) {
    await ctx.reply('❌ Impossible (je dois être admin).');
  }
});

cmd('revoke', { cat: 2, desc: 'Révoquer le lien', group: true, admin: true, botAdmin: true }, async (ctx) => {
  try {
    await ctx.sock.groupRevokeInvite(ctx.from);
    await ctx.reply('✅ Lien révoqué.');
  } catch (e) {
    await ctx.reply(`❌ Échec : ${e.message}`);
  }
});

cmd('poll', ['sondage'], { cat: 2, desc: 'Créer un sondage', usage: 'poll Question | option1 | option2', group: true }, async (ctx) => {
  const parts = ctx.q.split('|').map((s) => s.trim()).filter(Boolean);
  if (parts.length < 3) {
    return ctx.reply(`❌ Usage : ${config.prefix}poll Préfères-tu la plage ? | Oui | Non`);
  }
  const question = parts[0].slice(0, 200);
  const values = parts.slice(1, 11).map((v) => v.slice(0, 80));
  await send(ctx.sock, ctx.from, {
    poll: { name: question, values, selectableCount: 1 },
  });
});

/* ── 3. PROTECTION ────────────────────────────────────────── */

/* Interrupteur unique : on/off explicite ; SANS argument = bascule. Retourne false si argument invalide. */
async function setSwitch(ctx, g, key, name) {
  const arg = ctx.args[0];
  let val = guardUi.parseSwitch(arg);
  if (arg && val === null) { await ctx.reply(`❌ Utilisation : ${config.prefix}${name} on|off`); return false; }
  if (val === null) val = !g[key];
  g[key] = val;
  return true;
}

const toggleReply = (g, key, label) =>
  buildFrame(label, [note(`${toUnicode('ÉTAT')}: ${g[key] ? 'ACTIVÉ ✅' : 'DÉSACTIVÉ ❌'}`)]);

/* Interrupteurs propres au bot (état state.json) — une table, une boucle */
const SWITCHES = [
  { key: 'antidelete', label: 'Anti-suppression', desc: 'Renvoyer les messages supprimés', cat: 3 },
  { key: 'welcome', label: 'Bienvenue', desc: 'Message de bienvenue', cat: 3 },
  { key: 'goodbye', label: 'Au revoir', desc: 'Message de départ', cat: 3 },
  { key: 'glog', label: 'Journal du groupe', desc: 'Annoncer les changements du groupe', cat: 2 },
];
for (const sw of SWITCHES) {
  cmd(sw.key, {
    cat: sw.cat,
    desc: sw.desc,
    usage: `${sw.key} on|off | ${sw.key} off all`,
    group: true,
    admin: true,
  }, async (ctx) => {
    const arg0 = (ctx.args[0] || '').toLowerCase();
    const arg1 = (ctx.args[1] || '').toLowerCase();
    const isAll = arg1 === 'all' || arg1 === 'global' || arg0 === 'all' || arg0 === 'global';

    if (isAll) {
      const turnOn = arg0 === 'on' || arg0 === 'true';
      const turnOff = !turnOn;
      if (turnOn && !ctx.isOwner) {
        return ctx.error(['OWNER REQUIS POUR ON ALL']);
      }
      if (!ctx.isOwner && !ctx.isAdmin) {
        return ctx.error(['ADMIN OU OWNER REQUIS']);
      }
      state.groups = state.groups || {};
      let n = 0;
      for (const gid of Object.keys(state.groups)) {
        state.groups[gid][sw.key] = turnOn;
        n++;
      }
      if (sw.key === 'welcome') config.defaultGroupSettings.welcome = turnOn;
      if (sw.key === 'goodbye') config.defaultGroupSettings.goodbye = turnOn;
      saveState();
      return ctx.success([
        `${sw.label.toUpperCase()} ${turnOn ? 'ACTIVÉ' : 'DÉSACTIVÉ'} PARTOUT`,
        `${n} GROUPE(S)`,
      ]);
    }

    const g = getGroup(ctx.from);
    if (!(await setSwitch(ctx, g, sw.key, sw.key))) return;
    saveState();
    await ctx.reply(toggleReply(g, sw.key, sw.label));
  });
}

/* ── Avertissements — table guard (session/guard.json) : limites,
      escalade kick/mute et compteurs suivent la config du groupe ── */
cmd('warn', { cat: 3, desc: 'Avertir un membre', usage: 'warn @user [raison]', group: true, admin: true, icon: '⚠️' }, async (ctx) => {
  const target = targetFrom(ctx);
  if (!target) return ctx.reply(`❌ ${config.prefix}warn @user [raison]`);
  const g = guardDb.db().getGroup(ctx.from);
  const reason = ctx.q.replace(/@\d+/g, '').trim() || 'raison non précisée';
  const r = await guardSanctions.warn(ctx.sock, ctx.from, target, g, ctx.isBotAdmin);
  let txt = `⚠️ @${num(target)} : avertissement *${Math.min(r.count, r.limit)}/${r.limit}*\nRaison : ${reason}`;
  if (r.escalated === 'kick') txt += '\n🚫 Limite atteinte : expulsion.';
  else if (r.escalated === 'mute') txt += `\n🔇 Limite atteinte : muet ${g.muteMinutes} min.`;
  else if (r.count >= r.limit) txt += '\n⚠️ Limite atteinte mais le bot n\u2019est pas admin : pas d\u2019expulsion.';
  await ctx.reply(txt, [target]);
});

cmd('unwarn', ['resetwarn'], { cat: 3, desc: 'Retirer les avertissements', usage: 'unwarn @user', group: true, admin: true, icon: '♻️' }, async (ctx) => {
  const target = targetFrom(ctx);
  if (!target) return ctx.reply(`❌ ${config.prefix}unwarn @user`);
  guardDb.db().setWarns(ctx.from, num(target), 0);
  await ctx.reply(`✅ Avertissements remis à zéro pour +${num(target)}.`);
});

cmd('warnings', { cat: 3, desc: 'Voir les avertissements', usage: 'warnings @user', group: true, admin: true, icon: '📋' }, async (ctx) => {
  const target = targetFrom(ctx);
  if (!target) return ctx.reply(`❌ ${config.prefix}warnings @user`);
  const g = guardDb.db().getGroup(ctx.from);
  await ctx.reply(`⚠️ +${num(target)} : *${guardDb.db().getWarns(ctx.from, num(target))}/${g.warnLimit}* avertissements.`);
});

cmd('blacklist', { cat: 3, desc: 'Ajouter au blacklist (mute total)', usage: 'blacklist @user', group: true, owner: true }, async (ctx) => {
  const target = targetFrom(ctx);
  if (!target) return ctx.reply(`❌ ${config.prefix}blacklist @user`);
  const who = num(target);
  if (!state.blacklist.includes(who)) state.blacklist.push(who);
  saveState();
  await ctx.reply(`🚫 +${who} blacklisted : ses messages seront supprimés.`);
});

cmd('unblacklist', { cat: 3, desc: 'Retirer du blacklist', usage: 'unblacklist @user', group: true, owner: true }, async (ctx) => {
  const target = targetFrom(ctx);
  if (!target) return ctx.reply(`❌ ${config.prefix}unblacklist @user`);
  const who = num(target);
  state.blacklist = state.blacklist.filter((x) => x !== who);
  saveState();
  await ctx.reply(`✅ +${who} retiré du blacklist.`);
});

/* ── Commandes guard branchées sur NOTRE registre cmd() (aucun
      routeur dupliqué) : le run() guard reçoit son contexte adapté. */
async function guardCommandCtx(ctx) {
  const meta = await guardPerms.groupMeta(ctx.sock, ctx.from);
  const ci = ctxInfo(ctx.content);
  return {
    sock: ctx.sock,
    from: ctx.from,
    args: ctx.args,
    prefix: config.prefix,
    reply: ctx.reply,
    mentions: ci?.mentionedJid || [],
    quotedParticipant: ci?.participant || null,
    botAdmin: ctx.isBotAdmin,
    isAdmin: ctx.isAdmin,
    isOwner: ctx.isOwner,
    meta,
    isTargetAdmin: (jid) => guardPerms.isParticipantAdmin(meta, jid),
  };
}
function guardCmd(names, opts) {
  const list = Array.isArray(names) ? names : [names];
  const def = guardRegistry.get(list[0]);
  if (!def) { console.warn(`[GUARD] commande absente du registre : ${list[0]}`); return; }
  cmd(list, opts, async (ctx) => { await def.run(await guardCommandCtx(ctx)); });
}
/* Une commande par protection (générée depuis le registre guard : ajouter un fichier
   dans guard/src/protections = une nouvelle commande, sans toucher à handler.js) */
const PROTECTION_DESC = { antilink: 'Supprimer les liens', antibad: 'Filtrer les gros mots' };
for (const p of guardProtections) {
  guardCmd(p.key, {
    cat: 3, desc: PROTECTION_DESC[p.key] || `${p.label} on/off`, usage: `${p.key} on|off`,
    group: true, admin: true, icon: guardUi.ICONS[p.key] || '🛡️',
  });
}
guardCmd('security', { cat: 3, desc: 'Pack sécurité on/off', usage: 'security on|off', group: true, admin: true, icon: '🛡️' });
guardCmd(['settings', 'config'], { cat: 3, desc: 'Configuration du groupe', usage: 'settings', group: true, admin: true, icon: '⚙️' });
guardCmd('sanction', { cat: 3, desc: 'Sanction sur infraction', usage: 'sanction delete|warn|kick', group: true, admin: true, icon: '⚖️' });
guardCmd('warnlimit', { cat: 3, desc: "Limite d'avertissements", usage: 'warnlimit <1-20>', group: true, admin: true, icon: '🔢' });
guardCmd('onwarnlimit', { cat: 3, desc: 'Action au seuil de warns', usage: 'onwarnlimit kick|mute', group: true, admin: true, icon: '🎯' });
guardCmd('muteminutes', { cat: 3, desc: 'Durée de mute (min)', usage: 'muteminutes <min>', group: true, admin: true, icon: '🔇' });
guardCmd('floodset', { cat: 3, desc: 'Réglage anti-flood', usage: 'floodset <msgs> <sec>', group: true, admin: true, icon: '🌊' });
guardCmd('tagmax', { cat: 3, desc: 'Mentions max par message', usage: 'tagmax <n>', group: true, admin: true, icon: '📢' });
guardCmd('addbad', { cat: 3, desc: 'Ajouter un mot interdit', usage: 'addbad <mot>', group: true, admin: true, icon: '➕' });
guardCmd('delbad', { cat: 3, desc: 'Retirer un mot interdit', usage: 'delbad <mot>', group: true, admin: true, icon: '➖' });
guardCmd('linkallow', { cat: 3, desc: 'Domaines de liens autorisés', usage: 'linkallow add|del|list <domaine>', group: true, admin: true, icon: '🔗' });
guardCmd('mute', { cat: 3, desc: 'Rendre muet un membre', usage: 'mute @user 30m', group: true, admin: true, botAdmin: true, icon: '🔇' });
guardCmd('unmute', { cat: 3, desc: 'Rétablir un membre', usage: 'unmute @user', group: true, admin: true, icon: '🔊' });
guardCmd('antifake', { cat: 3, desc: 'Expulser les indicatifs non autorisés', usage: 'antifake on|off', group: true, admin: true, icon: '🧬' });
guardCmd('allowcodes', { cat: 3, desc: 'Indicatifs pays autorisés', usage: 'allowcodes 237 33', group: true, admin: true, icon: '🌍' });
guardCmd('maxtext', { cat: 3, desc: 'Taille max des messages (anti-virtex)', usage: 'maxtext <500-20000>', group: true, admin: true, icon: '💣' });
guardCmd(['nightmode', 'modenuit'], { cat: 3, desc: 'Fermer le groupe la nuit', usage: 'nightmode on|off', group: true, admin: true, icon: '🌙' });
guardCmd('nightset', { cat: 3, desc: 'Horaires du mode nuit', usage: 'nightset 22:00 06:00', group: true, admin: true, icon: '⏰' });
guardCmd('groupstats', { cat: 3, desc: 'Statistiques de protection', usage: 'groupstats', group: true, admin: true, icon: '📊' });

/* ── 4. STICKER & MEDIA ───────────────────────────────────── */

cmd('sticker', ['s'], { cat: 4, desc: 'Image/vidéo → sticker', usage: 'sticker (réponds à une image)' }, async (ctx) => {
  const info = mediaInfo(ctx.msg);
  if (!info) return ctx.reply(`❌ Réponds à une image ou une vidéo.\nUsage : ${config.prefix}sticker`);
  if (!['imageMessage', 'videoMessage', 'stickerMessage'].includes(info.type)) {
    return ctx.reply('❌ Seules les images et vidéos sont acceptées.');
  }
  await ctx.reply(config.messages.wait);
  try {
    const buffer = await downloadFrom(ctx.sock, info);
    const sticker = new Sticker(buffer, {
      pack: config.packname,
      author: config.author,
      type: StickerTypes.FULL,
      quality: 75,
    });
    await send(ctx.sock, ctx.from, { sticker: await sticker.toBuffer() }, { quoted: ctx.msg });
  } catch (e) {
    await ctx.reply(`❌ Sticker impossible : ${e.message}`);
  }
});

cmd('take', { cat: 4, desc: 'Re-sticker avec ton pack', usage: 'take [pack|author]' }, async (ctx) => {
  const info = mediaInfo(ctx.msg);
  if (!info || info.type !== 'stickerMessage') return ctx.reply(`❌ Réponds à un sticker.\nUsage : ${config.prefix}take MonPack|moi`);
  try {
    const [pack, author] = (ctx.q || '').split('|').map((s) => (s || '').trim());
    const buffer = await downloadFrom(ctx.sock, info);
    const sticker = new Sticker(buffer, {
      pack: pack || config.packname,
      author: author || config.author,
      type: StickerTypes.FULL,
      quality: 75,
    });
    await send(ctx.sock, ctx.from, { sticker: await sticker.toBuffer() }, { quoted: ctx.msg });
  } catch (e) {
    await ctx.reply(`❌ Échec : ${e.message}`);
  }
});

cmd('toimg', { cat: 4, desc: 'Sticker → image', usage: 'toimg (réponds à un sticker)' }, async (ctx) => {
  const info = mediaInfo(ctx.msg);
  if (!info || info.type !== 'stickerMessage') return ctx.reply(`❌ Réponds à un sticker.\nUsage : ${config.prefix}toimg`);
  try {
    const buffer = await downloadFrom(ctx.sock, info);
    const png = await sharp(buffer).png().toBuffer();
    await send(ctx.sock, ctx.from, { image: png, caption: '🖼️' }, { quoted: ctx.msg });
  } catch (e) {
    await ctx.reply(`❌ Conversion impossible : ${e.message}`);
  }
});

cmd('toaudio', { cat: 4, desc: 'Vidéo → mp3', usage: 'toaudio (réponds à une vidéo)' }, async (ctx) => {
  const info = mediaInfo(ctx.msg);
  if (!info || !['videoMessage', 'audioMessage'].includes(info.type)) {
    return ctx.reply(`❌ Réponds à une vidéo.\nUsage : ${config.prefix}toaudio`);
  }
  await ctx.reply(config.messages.wait);
  try {
    const buffer = await downloadFrom(ctx.sock, info);
    const ext = (info.mimetype.split('/')[1] || 'mp4').split(';')[0];
    const mp3 = await toAudioBuffer(buffer, ext);
    await send(ctx.sock, ctx.from, { audio: mp3, mimetype: 'audio/mpeg' }, { quoted: ctx.msg });
  } catch (e) {
    await ctx.reply(`❌ Conversion impossible : ${e.message}`);
  }
});

/* ── VUE UNIQUE (view once) — au-delà de WhatsApp ──────────── */

cmd('viewonce', ['vo', 'vueonce'], {
  cat: 4, desc: 'Renvoyer un média en vue unique',
  usage: 'viewonce (réponds à une image/vidéo)', icon: '👁️',
}, async (ctx) => {
  const info = mediaInfo(ctx.msg);
  if (!info || !['imageMessage', 'videoMessage'].includes(info.type)) {
    return ctx.reply(`❌ Réponds à une image ou une vidéo.\nUsage : ${config.prefix}viewonce`);
  }
  await ctx.reply(config.messages.wait);
  try {
    const buffer = await downloadFrom(ctx.sock, info);
    const payload = info.type === 'videoMessage'
      ? { video: buffer, viewOnce: true }
      : { image: buffer, viewOnce: true };
    await send(ctx.sock, ctx.from, payload, { quoted: ctx.msg });
  } catch (e) {
    await ctx.reply(`❌ Envoi impossible : ${e.message}`);
  }
});

cmd('getonce', ['recuponce', 'sauveonce'], {
  cat: 4, desc: 'Récupérer un média en vue unique',
  usage: 'getonce (réponds à un média vue unique)', icon: '🔓',
}, async (ctx) => {
  const info = mediaInfo(ctx.msg);
  if (!info) return ctx.reply(`❌ Réponds à un média en vue unique.\nUsage : ${config.prefix}getonce`);
  const ci = ctxInfo(ctx.content);
  if (!ci?.quotedMessage || !isOnceContent(ci.quotedMessage)) {
    return ctx.error(['CE MESSAGE N’EST PAS EN VUE UNIQUE', 'RÉPONDS À UNE PHOTO OU VIDÉO VUE UNIQUE']);
  }
  if (!['imageMessage', 'videoMessage'].includes(info.type)) {
    return ctx.error(['SEULES IMAGES ET VIDÉOS SONT ACCEPTÉES']);
  }
  await ctx.reply(config.messages.wait);
  try {
    const buffer = await downloadFrom(ctx.sock, info);
    const caption = renderSuccess(['VUE UNIQUE RÉCUPÉRÉE', 'MÉDIA CONVERTI EN CLASSIQUE']);
    const payload = info.type === 'videoMessage' ? { video: buffer, caption } : { image: buffer, caption };
    await send(ctx.sock, ctx.from, payload, { quoted: ctx.msg });
  } catch (e) {
    await ctx.error(['MÉDIA INDISPONIBLE OU EXPIRÉ', `[${e.message}]`]);
  }
});

cmd('autonce', ['autoonce', 'saveonce'], {
  cat: 4, desc: 'Sauvegarde auto des vue uniques',
  usage: 'autonce on|off', icon: '📥',
}, async (ctx) => {
  const arg = (ctx.args[0] || '').toLowerCase();
  if (!['on', 'off', 'true', 'false'].includes(arg)) {
    return ctx.saisie(`POUR COMPLÉTER : ${config.prefix}AUTONCE ON|OFF`);
  }
  const on = ['on', 'true'].includes(arg);
  state.once = state.once || {};
  if (on) state.once[ctx.from] = true;
  else delete state.once[ctx.from];
  saveState();
  await ctx.success(on
    ? ['AUTO-SAUVEGARDE VUE UNIQUE ACTIVÉE', 'LES MÉDIAS VUE UNIQUE REÇUS ICI', 'TOMBERONT EN PRIVÉ CHEZ LE PROPRIÉTAIRE']
    : ['AUTO-SAUVEGARDE VUE UNIQUE DÉSACTIVÉE']);
});

/* ── 5. OUTILS ────────────────────────────────────────────── */

cmd('translate', ['tr'], { cat: 5, desc: 'Traduire un texte', usage: 'translate [langue] <texte>' }, async (ctx) => {
  let to = 'fr';
  let text = ctx.q;
  const first = (ctx.args[0] || '').toLowerCase();
  if (/^[a-z]{2}$/.test(first) && ctx.args.length > 1) {
    to = first;
    text = ctx.args.slice(1).join(' ');
  }
  if (!text) {
    const ci = ctxInfo(ctx.content);
    if (ci?.quotedMessage) text = textOf(unwrap(ci.quotedMessage));
  }
  if (!text) return ctx.reply(`❌ Usage : ${config.prefix}translate en Bonjour !`);
  try {
    const r = await translate(text.slice(0, 1500), { to });
    await ctx.reply(`🌐 *${r.from?.auto ? 'auto' : r.from?.language?.iso || '?'} → ${to}* :\n\n${r.text}`);
  } catch (e) {
    await ctx.reply(`❌ Traduction impossible : ${e.message}`);
  }
});

cmd('calc', { cat: 5, desc: 'Calculatrice', usage: 'calc 2+2*3' }, async (ctx) => {
  if (!ctx.q) return ctx.reply(`❌ Usage : ${config.prefix}calc 12*8+4`);
  try {
    const expr = ctx.q.slice(0, 200);
    const result = math.evaluate(expr);
    await ctx.reply(`🧮 \`${expr}\` = *${result}*`);
  } catch (e) {
    await ctx.reply('❌ Expression invalide.');
  }
});

cmd('qr', { cat: 5, desc: 'Générer un QR code', usage: 'qr <texte>' }, async (ctx) => {
  if (!ctx.q) return ctx.reply(`❌ Usage : ${config.prefix}qr https://...`);
  try {
    const png = await QRCode.toBuffer(ctx.q.slice(0, 800), { type: 'png', margin: 1, width: 500 });
    await send(ctx.sock, ctx.from, { image: png, caption: `🔲 QR : ${ctx.q.slice(0, 100)}` }, { quoted: ctx.msg });
  } catch (e) {
    await ctx.reply(`❌ QR impossible : ${e.message}`);
  }
});

cmd('base64', { cat: 5, desc: 'Encoder/décoder base64', usage: 'base64 [decode] <texte>' }, async (ctx) => {
  if (!ctx.q) return ctx.reply(`❌ Usage : ${config.prefix}base64 Bonjour\nou ${config.prefix}base64 decode ...`);
  const isDecode = /^decode$/i.test(ctx.args[0] || '');
  const payload = isDecode ? ctx.args.slice(1).join(' ') : ctx.q;
  try {
    const out = isDecode
      ? Buffer.from(payload, 'base64').toString('utf8')
      : Buffer.from(payload, 'utf8').toString('base64');
    await ctx.reply(out);
  } catch (e) {
    await ctx.reply('❌ Opération invalide.');
  }
});

cmd('binary', { cat: 5, desc: 'Encoder/décoder binaire', usage: 'binary [decode] <texte>' }, async (ctx) => {
  if (!ctx.q) return ctx.reply(`❌ Usage : ${config.prefix}binary Bonjour`);
  const isDecode = /^decode$/i.test(ctx.args[0] || '');
  const payload = isDecode ? ctx.args.slice(1).join(' ') : ctx.q;
  try {
    const out = isDecode
      ? payload.trim().split(/\s+/).map((b) => String.fromCharCode(parseInt(b, 2))).join('')
      : Buffer.from(payload, 'utf8').toString('binary').split('').map((c) => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
    await ctx.reply(out || '❌ Résultat vide.');
  } catch (e) {
    await ctx.reply('❌ Opération invalide.');
  }
});

cmd('weather', ['meteo'], { cat: 5, desc: 'Météo d’une ville', usage: 'weather <ville>' }, async (ctx) => {
  if (!ctx.q) return ctx.reply(`❌ Usage : ${config.prefix}weather Douala`);
  try {
    const res = await fetch(`https://wttr.in/${encodeURIComponent(ctx.q.slice(0, 60))}?format=j1`);
    const data = await res.json();
    const c = data.current_condition?.[0];
    if (!c) throw new Error('ville introuvable');
    const area = data.nearest_area?.[0]?.areaName?.[0]?.value || ctx.q;
    await ctx.reply(
      `🌡️ *Météo — ${area}*\n` +
      `Température : ${c.temp_C}°C (ressenti ${c.FeelsLikeC}°C)\n` +
      `Humidité : ${c.humidity}%\n` +
      `Vent : ${c.windspeedKmph} km/h\n` +
      `État : ${c.weatherDesc?.[0]?.value || '?'}`
    );
  } catch (e) {
    await ctx.reply(`❌ Météo indisponible : ${e.message}`);
  }
});

/* ── 6. IA ────────────────────────────────────────────────── */

cmd('ai', ['gemini', 'bot'], { cat: 6, desc: 'Pose une question à l’IA', usage: 'ai <question>' }, async (ctx) => {
  let prompt = ctx.q;
  if (!prompt) {
    const ci = ctxInfo(ctx.content);
    if (ci?.quotedMessage) prompt = textOf(unwrap(ci.quotedMessage));
  }
  if (!prompt) return ctx.reply(`❌ Usage : ${config.prefix}ai Comment aller-tu ?`);
  if (!config.geminiKey) return ctx.reply('🔑 Clé IA manquante : ajoute GEMINI_KEY dans le fichier .env puis relance le bot.');
  await ctx.reply(config.messages.wait);
  try {
    /* Contexte : 5 derniers messages du chat (mémoire persistante) */
    const mem = (history.get(ctx.from) || []).slice(-5);
    const block = mem.length
      ? `Conversation récente :\n${mem.map((e) => `+${e.s}: ${e.t}`).join('\n')}\n\nQuestion : `
      : '';
    const answer = await askGemini((block + prompt).slice(0, 2500));
    await ctx.reply(answer.slice(0, 4000));
  } catch (e) {
    await ctx.reply(`❌ IA indisponible : ${e.message}`);
  }
});

cmd('summarize', ['resume'], { cat: 6, desc: 'Résumer un texte cité', usage: 'summarize (réponds à un texte)' }, async (ctx) => {
  const ci = ctxInfo(ctx.content);
  const quoted = ci?.quotedMessage ? textOf(unwrap(ci.quotedMessage)) : '';
  const source = quoted || ctx.q;
  if (!source) return ctx.reply(`❌ Réponds à un texte.\nUsage : ${config.prefix}summarize`);
  if (!config.geminiKey) return ctx.reply('🔑 Clé IA manquante : ajoute GEMINI_KEY dans .env.');
  await ctx.reply(config.messages.wait);
  try {
    const answer = await askGemini(`Résume ce texte en 5 points maximum, en français :\n\n${source.slice(0, 3000)}`);
    await ctx.reply(`📋 *Résumé*\n\n${answer.slice(0, 3500)}`);
  } catch (e) {
    await ctx.reply(`❌ Résumé impossible : ${e.message}`);
  }
});

cmd('analyse', ['ocr', 'transcrire', 'decrit'], { cat: 6, desc: 'IA : lire une image, transcrire un vocal, résumer un document', usage: 'analyse [question] (réponds à un média)' }, async (ctx) => {
  const info = mediaInfo(ctx.msg);
  if (!info) return ctx.reply(`❌ Réponds à une image, un vocal ou un document.\nUsage : ${config.prefix}analyse`);
  if (!config.geminiKey) return ctx.reply('🔑 Clé IA manquante : ajoute GEMINI_KEY dans le fichier .env.');

  const kind = info.type;
  const prompts = {
    imageMessage: 'Transcris tout le texte visible en français. S’il n’y a pas de texte, décris l’image en 3 phrases.',
    audioMessage: 'Transcris cet audio en français, fidèlement, avec la ponctuation.',
    documentMessage: 'Résume ce document en 5 points maximum, en français.',
    videoMessage: 'Décris brièvement cette vidéo en 3 phrases.',
  };
  if (!prompts[kind]) return ctx.reply('❌ Média non pris en charge (image, vocal, document, vidéo).');

  const mime = (info.mimetype || '').split(';')[0].trim().toLowerCase();
  if (kind === 'documentMessage' && !/pdf|text\/plain/.test(mime)) {
    return ctx.reply('❌ Documents pris en charge : PDF et texte brut seulement.');
  }
  if (kind === 'videoMessage' && !/^video\/(mp4|webm)$/.test(mime)) {
    return ctx.reply('❌ Vidéo prise en charge : MP4 seulement.');
  }

  await ctx.reply(config.messages.wait);
  let buf;
  try {
    buf = await downloadFrom(ctx.sock, info);
  } catch (e) {
    return ctx.reply(`❌ Téléchargement du média impossible : ${e.message}`);
  }
  if (!buf?.length) return ctx.reply('❌ Média vide ou expiré (reproduis le message).');
  if (buf.length > 12 * 1024 * 1024) return ctx.reply('❌ Fichier trop volumineux (> 12 Mo).');

  const prompt = (ctx.q || prompts[kind]).slice(0, 1500);
  try {
    const answer = await askGemini(prompt, { mime: mime || 'application/octet-stream', data: buf });
    await ctx.reply(`🧠 *Analyse IA*\n\n${answer.slice(0, 4000)}`);
  } catch (e) {
    await ctx.reply(`❌ IA indisponible : ${e.message}`);
  }
});

/* ── 7. FUN ───────────────────────────────────────────────── */

cmd('8ball', { cat: 7, desc: 'Boule magique', usage: '8ball <question>' }, async (ctx) => {
  if (!ctx.q) return ctx.reply(`❌ Usage : ${config.prefix}8ball Est-ce que je vais réussir ?`);
  const answers = ['✅ Oui, sûrement.', '❌ Non, jamais.', '🤔 Peut-être...', '🌟 Très probable.', '💀 Pas du tout.', '⏳ Réessaie plus tard.', '😉 Tu connais la réponse.', '🎲 Les signes sont flous.'];
  await ctx.reply(`🎱 *${ctx.q}*\n\n${answers[Math.floor(Math.random() * answers.length)]}`);
});

cmd('choose', { cat: 7, desc: 'Choisir entre options', usage: 'choose a, b, c' }, async (ctx) => {
  const options = ctx.q.split(/[,|]/).map((s) => s.trim()).filter(Boolean);
  if (options.length < 2) return ctx.reply(`❌ Usage : ${config.prefix}choose pizza, riz, pâtes`);
  await ctx.reply(`👉 Je choisis : *${options[Math.floor(Math.random() * options.length)]}*`);
});

cmd('roll', { cat: 7, desc: 'Lancer de dé', usage: 'roll [faces]' }, async (ctx) => {
  const faces = Math.min(1000, Math.max(2, parseInt(ctx.args[0], 10) || 6));
  await ctx.reply(`🎲 *${Math.floor(Math.random() * faces) + 1}* / ${faces}`);
});

cmd('coin', { cat: 7, desc: 'Pile ou face' }, async (ctx) => {
  await ctx.reply(Math.random() < 0.5 ? '🪙 *Pile*' : '🪙 *Face*');
});

cmd('ship', { cat: 7, desc: 'Taux de compatibilité', usage: 'ship @a @b' }, async (ctx) => {
  const ci = ctxInfo(ctx.content);
  const mentioned = ci?.mentionedJid || [];
  if (mentioned.length < 2) return ctx.reply(`❌ Mentionne 2 personnes.\nUsage : ${config.prefix}ship @a @b`);
  const pct = Math.floor(Math.random() * 101);
  const verdict = pct >= 80 ? '💘 Coup de foudre !' : pct >= 50 ? '💞 Ça peut marcher' : pct >= 30 ? '💔 Peu probable' : '🗑️ Oublie ça...';
  await ctx.reply(
    `💘 *SHIP*\n@${num(mentioned[0])} ❤️ @${num(mentioned[1])}\n\n*${pct}%*\n${verdict}`,
    mentioned
  );
});

cmd('rate', { cat: 7, desc: 'Noter un sujet', usage: 'rate <chose>' }, async (ctx) => {
  if (!ctx.q) return ctx.reply(`❌ Usage : ${config.prefix}rate ce bot`);
  await ctx.reply(`⭐ *${Math.floor(Math.random() * 101)}%* pour « ${ctx.q.slice(0, 80)} »`);
});

cmd('joke', { cat: 7, desc: 'Une blague' }, async (ctx) => {
  try {
    const res = await fetch('https://official-joke-api.appspot.com/random_joke');
    const j = await res.json();
    await ctx.reply(`😂 ${j.setup}\n\n*${j.punchline}*`);
  } catch (e) {
    await ctx.reply('❌ Blague indisponible.');
  }
});

/* ── 8. RECHERCHE ─────────────────────────────────────────── */

cmd('wiki', { cat: 8, desc: 'Résumé Wikipédia', usage: 'wiki <sujet>' }, async (ctx) => {
  if (!ctx.q) return ctx.reply(`❌ Usage : ${config.prefix}wiki Cameroun`);
  const query = ctx.q.slice(0, 120);
  try {
    let res = await fetch(`https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
    if (!res.ok) res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error('article introuvable');
    const j = await res.json();
    await ctx.reply(`📖 *${j.title}*\n\n${(j.extract || '').slice(0, 1500)}\n\n🔗 ${j.content_urls?.desktop?.page || ''}`);
  } catch (e) {
    await ctx.reply(`❌ Wikipédia : ${e.message}`);
  }
});

cmd('github', { cat: 8, desc: 'Profil GitHub', usage: 'github <utilisateur>' }, async (ctx) => {
  if (!ctx.q) return ctx.reply(`❌ Usage : ${config.prefix}github Beaute-Gar`);
  try {
    const res = await fetch(`https://api.github.com/users/${encodeURIComponent(ctx.args[0])}`);
    if (!res.ok) throw new Error('utilisateur introuvable');
    const j = await res.json();
    await ctx.reply(
      `🐙 *@${j.login}*\n` +
      `Nom : ${j.name || '—'}\n` +
      `Bio : ${j.bio || '—'}\n` +
      `Repos : ${j.public_repos} · Followers : ${j.followers}\n` +
      `📍 ${j.location || '—'}\n` +
      `🔗 ${j.html_url}`
    );
  } catch (e) {
    await ctx.reply(`❌ GitHub : ${e.message}`);
  }
});

cmd('convert', { cat: 8, desc: 'Conversion de devises', usage: 'convert 100 USD EUR' }, async (ctx) => {
  const m = ctx.q.match(/([\d.,]+)\s+([a-zA-Z]{3})\s+(?:en|to|->)?\s*([a-zA-Z]{3})/);
  if (!m) return ctx.reply(`❌ Usage : ${config.prefix}convert 100 USD EUR`);
  const amount = parseFloat(m[1].replace(',', '.'));
  const from = m[2].toUpperCase();
  const to = m[3].toUpperCase();
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${from}`);
    const j = await res.json();
    const rate = j.rates?.[to];
    if (!rate) throw new Error('devise inconnue');
    await ctx.reply(`💱 *${amount} ${from}* = *${(amount * rate).toFixed(2)} ${to}*\nTaux : 1 ${from} = ${rate} ${to}`);
  } catch (e) {
    await ctx.reply(`❌ Conversion : ${e.message}`);
  }
});

/* ── 9. OWNER ─────────────────────────────────────────────── */

cmd('self', { cat: 9, desc: 'Mode owner uniquement', owner: true }, async (ctx) => {
  state.settings.selfMode = true;
  saveState(true);
  await ctx.reply('🔒 Mode *SELF* activé : seul le propriétaire peut utiliser les commandes.');
});

cmd('public', { cat: 9, desc: 'Mode tout le monde', owner: true }, async (ctx) => {
  state.settings.selfMode = false;
  saveState(true);
  await ctx.reply('🌐 Mode *PUBLIC* activé : tout le monde peut utiliser les commandes.');
});

cmd('broadcast', ['bc'], { cat: 9, desc: 'Diffuser un message', usage: 'broadcast <texte>', owner: true }, async (ctx) => {
  if (!ctx.q) return ctx.reply(`❌ Usage : ${config.prefix}broadcast Hello à tous`);
  const chats = [...new Set([...msgCache.keys()].map((k) => k.split('|')[0]))]
    .filter((j) => j.endsWith('@s.whatsapp.net') || j.endsWith('@g.us'));
  await ctx.reply(`📡 Diffusion vers ${chats.length} chats...`);
  let ok = 0;
  for (const jid of chats) {
    try {
      await send(ctx.sock, jid, { text: `📢 *${config.botName}*\n\n${ctx.q}` });
      ok++;
      await new Promise((r) => setTimeout(r, 900));
    } catch (e) {}
  }
  await ctx.reply(`✅ Diffusion terminée : ${ok}/${chats.length} envoyés.`);
});

cmd('join', { cat: 9, desc: 'Rejoindre un groupe via lien', usage: 'join <lien>', owner: true }, async (ctx) => {
  const code = (ctx.q || '').match(/chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9]+)/);
  if (!code) return ctx.reply(`❌ Usage : ${config.prefix}join https://chat.whatsapp.com/XXX`);
  try {
    await ctx.sock.groupAcceptInvite(code[1]);
    await ctx.reply('✅ Groupe rejoint.');
  } catch (e) {
    await ctx.reply(`❌ Impossible : ${e.message}`);
  }
});

cmd('leave', { cat: 9, desc: 'Quitter le groupe', group: true, owner: true }, async (ctx) => {
  await ctx.reply('👋 Je quitte ce groupe.');
  await ctx.sock.groupLeave(ctx.from);
});

cmd('block', { cat: 9, desc: 'Bloquer un numéro', usage: 'block <numéro>', owner: true }, async (ctx) => {
  const raw = (ctx.q || '').match(/\d{5,}/);
  if (!raw) return ctx.reply(`❌ Usage : ${config.prefix}block 237690000000`);
  const jid = `${raw[0]}@s.whatsapp.net`;
  await ctx.sock.updateBlockStatus(jid, 'block');
  await ctx.reply(`🚫 +${raw[0]} bloqué.`);
});

cmd('unblock', { cat: 9, desc: 'Débloquer un numéro', usage: 'unblock <numéro>', owner: true }, async (ctx) => {
  const raw = (ctx.q || '').match(/\d{5,}/);
  if (!raw) return ctx.reply(`❌ Usage : ${config.prefix}unblock 237690000000`);
  const jid = `${raw[0]}@s.whatsapp.net`;
  await ctx.sock.updateBlockStatus(jid, 'unblock');
  await ctx.reply(`✅ +${raw[0]} débloqué.`);
});

cmd('statut', ['status'], { cat: 9, desc: 'Publier un texte en statut WhatsApp', usage: 'statut <texte>', owner: true }, async (ctx) => {
  if (!ctx.q) return ctx.reply(`❌ Usage : ${config.prefix}statut Bonjour le monde`);
  const list = Object.keys(state.users)
    .filter((n) => /^\d{5,}$/.test(n))
    .map((n) => `${n}@s.whatsapp.net`);
  await send(ctx.sock, 
    'status@broadcast',
    { text: ctx.q.slice(0, 500) },
    { statusJidList: list }
  );
  await ctx.reply(`✅ Statut publié${list.length ? ` vers ${list.length} contacts` : ''}.`);
});

cmd('location', ['position', 'localisation'], { cat: 5, desc: 'Envoyer un point GPS', usage: 'location <lat>, <lng> [nom]' }, async (ctx) => {
  const m = ctx.q.match(/(-?\d{1,3}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)/);
  if (!m) return ctx.reply(`❌ Usage : ${config.prefix}location 3.8480, 11.5020 Douala`);
  const lat = parseFloat(m[1]);
  const lng = parseFloat(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return ctx.reply('❌ Coordonnées invalides (latitude -90..90, longitude -180..180).');
  }
  const name = ctx.q.replace(m[0], '').trim().slice(0, 80);
  await send(ctx.sock, ctx.from, {
    location: { degreesLatitude: lat, degreesLongitude: lng, ...(name ? { name } : {}) },
  }, { quoted: ctx.msg });
});

cmd('vcard', ['contact', 'carte'], { cat: 10, desc: 'Envoyer une carte de contact', usage: 'vcard <numéro> [@mention] [nom]' }, async (ctx) => {
  const ci = ctxInfo(ctx.content);
  const number =
    (ci?.mentionedJid || []).map((j) => num(j)).find(Boolean) ||
    (ctx.q.match(/\d{5,}/) || [])[0];
  if (!number) return ctx.reply(`❌ Usage : ${config.prefix}vcard 237690000000 Nom`);
  const name = ctx.q.replace(/\d{5,}/, '').replace(/@\d+/g, '').trim() || `+${number}`;
  const vcard =
    `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\n` +
    `TEL;type=CELL;type=VOICE;waid=${number}:+${number}\nEND:VCARD`;
  await send(ctx.sock, ctx.from, {
    contacts: { displayName: name, contacts: [{ vcard }] },
  }, { quoted: ctx.msg });
});

cmd('event', ['rdv', 'rendezvous'], { cat: 10, desc: 'Créer un événement WhatsApp', usage: 'event <titre> | <lieu> | <JJ/MM/AAAA HH:MM> | <description>' }, async (ctx) => {
  const parts = ctx.q.split('|').map((s) => s.trim()).filter(Boolean);
  if (!parts.length) {
    return ctx.reply(`❌ Usage : ${config.prefix}event Réunion | Salle A | 28/09/2026 18:00 | Ordre du jour`);
  }
  const name = parts.shift().slice(0, 100);
  let startSec = null;
  for (let i = 0; i < parts.length; i++) {
    const d = parseFrDate(parts[i]);
    if (d) {
      startSec = Math.floor(d.getTime() / 1000);
      parts.splice(i, 1);
      break;
    }
  }
  const place = parts.shift() || '';
  const description = [place ? `📍 ${place}` : '', parts.join('\n')]
    .filter(Boolean)
    .join('\n')
    .slice(0, 300);
  if (startSec == null) startSec = Math.floor(Date.now() / 1000) + 86400;
  await send(ctx.sock, ctx.from, {
    event: { name, description, startTime: startSec },
  }, { quoted: ctx.msg });
  const when = new Date(startSec * 1000).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  await ctx.reply(`📅 Événement « ${name} » créé pour le ${when}.`);
});

cmd('derniers', ['historique'], { cat: 9, desc: 'Mémoire : derniers messages du chat', usage: 'derniers [1-10]', owner: true }, async (ctx) => {
  const arr = history.get(ctx.from) || [];
  if (!arr.length) return ctx.reply('📭 Aucun message en mémoire pour ce chat.');
  const n = Math.max(1, Math.min(parseInt(ctx.args[0], 10) || 10, 10));
  const lines = arr.slice(-n).map((e, i) =>
    `${i + 1}. [${new Date(e.ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}] +${e.s} : ${e.t}`
  );
  await ctx.reply(`🧠 *Mémoire — ${arr.length} message(s)*\n${lines.join('\n')}`);
});

/* ── 10. DIVERS ───────────────────────────────────────────── */

cmd('afk', { cat: 10, desc: 'Se déclarer AFK', usage: 'afk [raison]' }, async (ctx) => {
  const u = getUser(num(ctx.sender));
  u.afk = { reason: ctx.q || 'sans raison', ts: Date.now() };
  saveState();
  await ctx.reply(`💤 *+${num(ctx.sender)}* est AFK ${u.afk.reason ? `: ${u.afk.reason}` : ''}`);
});

cmd('level', { cat: 10, desc: 'Niveau et expérience', usage: 'level [@user]' }, async (ctx) => {
  const ci = ctxInfo(ctx.content);
  const who = ci?.mentionedJid?.length ? num(ci.mentionedJid[0]) : num(ctx.sender);
  const u = getUser(who);
  const level = Math.floor((u.xp || 0) / 100);
  const progress = (u.xp || 0) % 100;
  const bar = '█'.repeat(Math.floor(progress / 10)) + '░'.repeat(10 - Math.floor(progress / 10));
  await ctx.reply(
    `📊 *Niveau de +${who}*\n\n` +
    `Niveau : *${level}*\n` +
    `XP : ${u.xp || 0}\n` +
    `[${bar}] ${progress}%`
  );
});

cmd('report', { cat: 10, desc: 'Signaler un problème au owner', usage: 'report <message>' }, async (ctx) => {
  if (!ctx.q) return ctx.reply(`❌ Usage : ${config.prefix}report problème...`);
  const ownerJid = `${config.ownerNumber[0]}@s.whatsapp.net`;
  await send(ctx.sock, ownerJid, {
    text: `📬 *REPORT* de +${num(ctx.sender)} (${ctx.from})\n\n${ctx.q}`,
  });
  await ctx.reply('✅ Signalement envoyé au propriétaire. Merci !');
});

cmd('stats', { cat: 10, desc: 'Statistiques du bot' }, async (ctx) => {
  const s = state.stats;
  await ctx.reply(
    `📈 *STATISTIQUES*\n\n` +
    `Messages reçus : ${s.messages}\n` +
    `Commandes exécutées : ${s.commands}\n` +
    `Uptime : ${formatDuration(process.uptime() * 1000)}\n` +
    `Groupes suivis : ${Object.keys(state.groups).length}\n` +
    `Depuis : ${new Date(s.since).toLocaleDateString('fr-FR')}`
  );
});

/* ── 9bis / 10bis. AMÉLIORATIONS BAILEYS (sans boutons) ────── */

/** Récupère la clé du message cité (pour edit / pin / delete) */
function quotedKey(msg, content) {
  const ci = ctxInfo(content || unwrap(msg.message));
  if (!ci?.stanzaId) return null;
  return {
    remoteJid: msg.key.remoteJid,
    id: ci.stanzaId,
    fromMe: !!ci.participant ? false : !!msg.key.fromMe,
    participant: ci.participant || undefined,
  };
}

cmd('edit', { cat: 5, desc: 'Modifier un message envoyé par le bot', usage: 'edit <nouveau texte> (répondre au message)', icon: '✏️' }, async (ctx) => {
  const key = quotedKey(ctx.msg, ctx.content);
  if (!key) return ctx.reply(`❌ Réponds à un message du bot puis : ${config.prefix}edit nouveau texte`);
  if (!ctx.q) return ctx.reply(`❌ Usage : ${config.prefix}edit <nouveau texte>`);
  try {
    await send(ctx.sock, ctx.from, { text: ctx.q.slice(0, 4000), edit: key });
    await ctx.react('✅');
  } catch (e) {
    await ctx.reply(`❌ Impossible de modifier : ${e.message}`);
  }
});

cmd('pin', { cat: 2, desc: 'Épingler un message (24h)', usage: 'pin (répondre au message)', group: true, admin: true, botAdmin: true, icon: '📌' }, async (ctx) => {
  const key = quotedKey(ctx.msg, ctx.content);
  if (!key) return ctx.reply(`❌ Réponds au message à épingler.`);
  try {
    await send(ctx.sock, ctx.from, { pin: { type: 1, time: 86400, key } });
    await ctx.success(['MESSAGE ÉPINGLÉ 24H']);
  } catch (e) {
    await ctx.reply(`❌ Pin impossible : ${e.message}`);
  }
});

cmd('unpin', { cat: 2, desc: 'Désépingler un message', usage: 'unpin (répondre au message)', group: true, admin: true, botAdmin: true, icon: '📍' }, async (ctx) => {
  const key = quotedKey(ctx.msg, ctx.content);
  if (!key) return ctx.reply(`❌ Réponds au message à désépingler.`);
  try {
    await send(ctx.sock, ctx.from, { pin: { type: 0, time: 0, key } });
    await ctx.success(['MESSAGE DÉSÉPINGLÉ']);
  } catch (e) {
    await ctx.reply(`❌ Unpin impossible : ${e.message}`);
  }
});

cmd('disappear', ['ephemeral', 'efemere'], {
  cat: 2, desc: 'Messages éphémères du chat', usage: 'disappear off|24h|7d|90d',
  group: true, admin: true, botAdmin: true, icon: '⏱️',
}, async (ctx) => {
  const arg = (ctx.args[0] || '').toLowerCase();
  const seconds = parseEphemeral(arg);
  if (seconds === null) {
    return ctx.reply(`❌ Usage : ${config.prefix}disappear off|24h|7d|90d`);
  }
  try {
    await send(ctx.sock, ctx.from, { disappearingMessagesInChat: seconds });
    await ctx.success([
      seconds === 0 ? 'MESSAGES ÉPHÉMÈRES DÉSACTIVÉS' : `MESSAGES ÉPHÉMÈRES : ${arg.toUpperCase()}`,
    ]);
  } catch (e) {
    await ctx.reply(`❌ Éphémère impossible : ${e.message}`);
  }
});

cmd('mutechat', ['mutec'], {
  cat: 9, desc: 'Mettre le chat en sourdine (8h)', usage: 'mutechat [heures]', owner: true, icon: '🔇',
}, async (ctx) => {
  const hours = Math.min(168, Math.max(1, parseInt(ctx.args[0] || '8', 10) || 8));
  const muteEnd = Math.floor(Date.now() / 1000) + hours * 3600;
  try {
    await ctx.sock.chatModify({ mute: muteEnd }, ctx.from);
    await ctx.success([`CHAT EN SOURDINE ${hours}H`]);
  } catch (e) {
    await ctx.reply(`❌ Mute chat impossible : ${e.message}`);
  }
});

cmd('unmutechat', ['unmutec'], {
  cat: 9, desc: 'Retirer la sourdine du chat', owner: true, icon: '🔊',
}, async (ctx) => {
  try {
    await ctx.sock.chatModify({ mute: null }, ctx.from);
    await ctx.success(['SOURDINE RETIRÉE']);
  } catch (e) {
    await ctx.reply(`❌ Unmute chat impossible : ${e.message}`);
  }
});

cmd('archive', {
  cat: 9, desc: 'Archiver / désarchiver le chat', usage: 'archive [on|off]', owner: true, icon: '📦',
}, async (ctx) => {
  const on = !/^(off|0|false|no)$/i.test(ctx.args[0] || 'on');
  try {
    // lastMessages requis par Baileys pour archive
    const last = getCache(ctx.from, ctx.msg.key.id);
    const lastMessages = last?.msg ? [{ key: last.msg.key, messageTimestamp: last.msg.messageTimestamp }] : [];
    await ctx.sock.chatModify({ archive: on, lastMessages }, ctx.from);
    await ctx.success([on ? 'CHAT ARCHIVÉ' : 'CHAT DÉSARCHIVÉ']);
  } catch (e) {
    await ctx.reply(`❌ Archive impossible : ${e.message}`);
  }
});

cmd('setpp', ['setpic', 'botpp'], {
  cat: 9, desc: 'Photo de profil du bot (setpp delete = retirer)', usage: 'setpp (image) · setpp delete', owner: true, icon: '🖼️',
}, async (ctx) => {
  const sub = (ctx.args[0] || '').toLowerCase();
  if (sub === 'delete' || sub === 'del' || sub === 'remove') {
    try {
      await ctx.sock.removeProfilePicture(ctx.sock.user.id);
      return await ctx.success(['PHOTO DE PROFIL RETIRÉE']);
    } catch (e) {
      return await ctx.reply(`❌ setpp delete impossible : ${e.message}`);
    }
  }
  const info = mediaInfo(ctx.msg);
  if (!info || !info.mimetype?.startsWith('image/')) {
    return ctx.reply(`❌ Réponds à une image ou envoie une image avec ${config.prefix}setpp`);
  }
  try {
    const buffer = await downloadFrom(ctx.sock, info);
    await ctx.sock.updateProfilePicture(ctx.sock.user.id, buffer);
    await ctx.success(['PHOTO DE PROFIL MISE À JOUR']);
  } catch (e) {
    await ctx.reply(`❌ setpp impossible : ${e.message}`);
  }
});

cmd('setbotname', ['botname'], {
  cat: 9, desc: 'Changer le nom affiché du bot', usage: 'setbotname <nom>', owner: true, icon: '📝',
}, async (ctx) => {
  if (!ctx.q || ctx.q.length < 2) return ctx.reply(`❌ Usage : ${config.prefix}setbotname Nouveau Nom`);
  try {
    await ctx.sock.updateProfileName(ctx.q.slice(0, 25));
    await ctx.success([`NOM → ${ctx.q.slice(0, 25)}`]);
  } catch (e) {
    await ctx.reply(`❌ setbotname impossible : ${e.message}`);
  }
});

cmd('setbio', ['botbio'], {
  cat: 9, desc: 'Changer la bio (status) du bot', usage: 'setbio <texte>', owner: true, icon: '💬',
}, async (ctx) => {
  if (!ctx.q) return ctx.reply(`❌ Usage : ${config.prefix}setbio En ligne`);
  try {
    await ctx.sock.updateProfileStatus(ctx.q.slice(0, 139));
    await ctx.success(['BIO MISE À JOUR']);
  } catch (e) {
    await ctx.reply(`❌ setbio impossible : ${e.message}`);
  }
});

cmd('react', {
  cat: 5, desc: 'Réagir à un message', usage: 'react 🔥 (répondre au message)', icon: '👍',
}, async (ctx) => {
  const key = quotedKey(ctx.msg, ctx.content);
  if (!key) return ctx.reply(`❌ Réponds au message puis : ${config.prefix}react 🔥`);
  const emoji = (ctx.args[0] || config.likeEmoji || '👍').slice(0, 8);
  try {
    await send(ctx.sock, ctx.from, { react: { text: emoji, key } });
  } catch (e) {
    await ctx.reply(`❌ Réaction impossible : ${e.message}`);
  }
});

cmd('del', ['delete', 'suppr'], {
  cat: 5, desc: 'Supprimer un message (pour tous si admin/bot)', usage: 'del (répondre au message)', icon: '🗑️',
}, async (ctx) => {
  const key = quotedKey(ctx.msg, ctx.content);
  if (!key) return ctx.reply(`❌ Réponds au message à supprimer.`);
  try {
    await send(ctx.sock, ctx.from, { delete: key });
    await ctx.react('✅');
  } catch (e) {
    await ctx.reply(`❌ Suppression impossible : ${e.message}`);
  }
});

cmd('read', ['markread'], {
  cat: 9, desc: 'Marquer le message cité comme lu', usage: 'read (répondre)', owner: true, icon: '👁️',
}, async (ctx) => {
  const key = quotedKey(ctx.msg, ctx.content) || ctx.msg.key;
  try {
    await ctx.sock.readMessages([key]);
    await ctx.success(['MARQUÉ COMME LU']);
  } catch (e) {
    await ctx.reply(`❌ read impossible : ${e.message}`);
  }
});



/* ── AUTORISATIONS OWNER / SUDO (pas tout le monde owner) ── */
cmd('sudo', {
  cat: 9, desc: 'Gérer les sudo (co-owners autorisés)', usage: 'sudo add|del|list <numéro>', owner: true, icon: '🔑',
}, async (ctx) => {
  const sub = (ctx.args[0] || '').toLowerCase();
  state.settings.sudo = Array.isArray(state.settings.sudo) ? state.settings.sudo : [];
  if (sub === 'list') {
    const primary = config.ownerNumber.map((n) => `👑 +${n}`).join('\n') || '—';
    const sudo = state.settings.sudo.length
      ? state.settings.sudo.map((n) => `🔑 +${n}`).join('\n')
      : 'Aucun sudo';
    return ctx.reply(
      buildFrame('AUTORISATIONS', [
        title(toUnicode('OWNERS PRINCIPAUX')),
        primary,
        title(toUnicode('SUDO')),
        sudo,
        bullet('AIDE', `${config.prefix}sudo add 2376...`),
      ])
    );
  }
  if (sub === 'add' || sub === 'del' || sub === 'remove') {
    let n = (ctx.args[1] || '').replace(/\D/g, '');
    if (!n && ctx.msg) {
      const t = targetFrom(ctx);
      if (t) n = num(t);
    }
    if (!n || n.length < 8) {
      return ctx.error(['USAGE', `${config.prefix}SUDO ADD 2376XXXXXXX`, 'OU MENTIONNE LA PERSONNE']);
    }
    if (sub === 'add') {
      if (isPrimaryOwner(n)) return ctx.error(['DÉJÀ OWNER PRINCIPAL']);
      if (!state.settings.sudo.includes(n)) state.settings.sudo.push(n);
      saveState();
      return ctx.success(['SUDO AJOUTÉ', `+${n}`, 'PEUT UTILISER LES COMMANDES OWNER']);
    }
    state.settings.sudo = state.settings.sudo.filter((x) => x !== n);
    saveState();
    return ctx.success(['SUDO RETIRÉ', `+${n}`]);
  }
  return ctx.error([
    'USAGE',
    `${config.prefix}SUDO LIST`,
    `${config.prefix}SUDO ADD <NUMÉRO>`,
    `${config.prefix}SUDO DEL <NUMÉRO>`,
    `${config.prefix}AUTHCODE  (code à usage unique)`,
  ]);
});

cmd('authcode', ['codeowner', 'codeauth'], {
  cat: 9, desc: 'Générer un code pour activer un sudo', usage: 'authcode', owner: true, icon: '🎫',
}, async (ctx) => {
  // Seul un owner PRINCIPAL (pas sudo) peut générer — sécurité
  const me = num(ctx.sender);
  if (!isPrimaryOwner(me) && !ctx.isBotSelf) {
    return ctx.error(['RÉSERVÉ AUX OWNERS PRINCIPAUX', 'PAS AUX SUDO']);
  }
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  state.settings.authCodes = state.settings.authCodes || {};
  // purge codes > 1h
  const now = Date.now();
  for (const [k, v] of Object.entries(state.settings.authCodes)) {
    if (!v?.exp || v.exp < now) delete state.settings.authCodes[k];
  }
  state.settings.authCodes[code] = { exp: now + 60 * 60 * 1000, by: me };
  saveState();
  await ctx.success([
    'CODE CRÉÉ (1 HEURE)',
    code,
    `L’AUTRE PERSONNE TAPE : ${config.prefix}CLAIM ${code}`,
  ]);
});

cmd('claim', ['claimsudo', 'activer'], {
  cat: 1, desc: 'Activer un accès sudo avec un code', usage: 'claim <CODE>', icon: '🎫',
}, async (ctx) => {
  const code = (ctx.args[0] || ctx.q || '').trim().toUpperCase();
  if (!code) return ctx.error(['USAGE', `${config.prefix}CLAIM ABC123`]);
  state.settings.authCodes = state.settings.authCodes || {};
  const entry = state.settings.authCodes[code];
  if (!entry || entry.exp < Date.now()) {
    delete state.settings.authCodes[code];
    saveState();
    return ctx.error(['CODE INVALIDE OU EXPIRÉ']);
  }
  const n = num(ctx.sender);
  if (!n) return ctx.error(['NUMÉRO INTROUVABLE']);
  if (isPrimaryOwner(n) || isSudoNumber(n)) {
    delete state.settings.authCodes[code];
    saveState();
    return ctx.success(['TU ES DÉJÀ AUTORISÉ']);
  }
  state.settings.sudo = state.settings.sudo || [];
  if (!state.settings.sudo.includes(n)) state.settings.sudo.push(n);
  delete state.settings.authCodes[code];
  saveState();
  await ctx.success([
    'ACCÈS SUDO ACTIVÉ',
    `+${n}`,
    'COMMANDES OWNER / MENU OWNER VISIBLES',
  ]);
});

/* ── EXTRAS Baileys (communities, channels, album, store-backed, scheduler…) ── */
try {
  registerExtras(cmd, {
    config,
    mediaInfo,
    downloadFrom,
    sharp,
    Sticker,
    StickerTypes,
    renderSuccess,
    renderError,
    buildFrame,
    bullet,
    toUnicode,
    note,
    ctxInfo,
    unwrap,
  });
  registerTools(cmd, {
    config,
    mediaInfo,
    downloadFrom,
    sharp,
    Sticker,
    StickerTypes,
    buildFrame,
    bullet,
  });
  registerMissing(cmd, {
    config,
    mediaInfo,
    downloadFrom,
    sharp,
    Sticker,
    StickerTypes,
    buildFrame,
    bullet,
    toUnicode,
    note,
  });
  console.log('[EXTRAS] avancés + outils + missing Baileys (messages texte uniquement)');
} catch (e) {
  console.error('[EXTRAS] enregistrement:', e.message);
}

/* ── 11. TÉLÉCHARGEMENT ───────────────────────────────────── */

const YT_URL_RE = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/;

/* ── yt-dlp : moteur de téléchargement (auto-installé dans vendor/) ──
   @distube/ytdl-core ne sait plus déchiffrer le player YouTube actuel
   (« Could not parse decipher function ») : on s'appuie sur yt-dlp, le
   standard maintenu, plus ffmpeg (embarqué via ffmpeg-static). */

const YTDLP_BIN = path.join(__dirname, 'vendor', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
const YTDLP_URL = process.platform === 'win32'
  ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
  : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

function downloadFile(url, dest, redirects = 5) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
        res.resume();
        return resolve(downloadFile(res.headers.location, dest, redirects - 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const ws = fs.createWriteStream(dest);
      res.pipe(ws);
      ws.on('finish', () => ws.close(() => resolve(dest)));
      ws.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(180000, () => req.destroy(new Error('délai dépassé')));
  });
}

async function ensureYtDlp() {
  if (fs.existsSync(YTDLP_BIN)) return YTDLP_BIN;
  // 1. yt-dlp déjà installé sur la machine ?
  const onPath = await new Promise((resolve) => {
    try {
      const p = spawn('yt-dlp', ['--version'], { windowsHide: true });
      p.on('error', () => resolve(null));
      p.on('close', (code) => resolve(code === 0 ? 'yt-dlp' : null));
    } catch { resolve(null); }
  });
  if (onPath) return onPath;
  // 2. téléchargement automatique (≈17 Mo, une seule fois)
  console.log('[DL] yt-dlp introuvable — téléchargement en cours...');
  await downloadFile(YTDLP_URL, YTDLP_BIN);
  if (process.platform !== 'win32') fs.chmodSync(YTDLP_BIN, 0o755);
  console.log('[DL] yt-dlp installé :', YTDLP_BIN);
  return YTDLP_BIN;
}

const ytdlpError = (txt) => {
  const lines = String(txt || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const hit = [...lines].reverse().find((l) => /^ERROR/i.test(l));
  return (hit || lines[lines.length - 1] || 'erreur inconnue').replace(/^ERROR:\s*/i, '');
};

async function runYtDlp(args, timeoutMs = 300000) {
  const bin = await ensureYtDlp();
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { windowsHide: true });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      try { p.kill(); } catch {}
      reject(new Error('délai dépassé (5 min)'));
    }, timeoutMs);
    p.stdout.on('data', (d) => { out = (out + d.toString()).slice(-20000); });
    p.stderr.on('data', (d) => { err = (err + d.toString()).slice(-4000); });
    p.on('error', (e) => { clearTimeout(timer); reject(e); });
    p.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(ytdlpError(err || out)));
    });
  });
}

function tmpBase() {
  return path.join(os.tmpdir(), `djousse-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
}

function findTmp(base) {
  try {
    const prefix = path.basename(base);
    const hit = fs.readdirSync(os.tmpdir()).filter((f) => f.startsWith(prefix));
    return hit.length ? path.join(os.tmpdir(), hit[0]) : null;
  } catch { return null; }
}

/* ffmpegBuffer() vit désormais dans lib/ffmpeg.js (helper partagé avec
   lib/wa-sticker.js) : une seule implémentation (G4 « pas de doublon »). */

async function ytResolve(query) {
  const m = String(query || '').match(YT_URL_RE);
  if (m) {
    const v = await yts({ videoId: m[1] });
    if (!v?.videoId) return null;
    const seconds = Math.floor(v.duration?.seconds) ||
      String(v.timestamp || '').split(':').reduce((acc, p) => acc * 60 + Number(p), 0) || 0;
    return {
      url: v.url || `https://www.youtube.com/watch?v=${v.videoId}`,
      title: v.title || m[1],
      author: v.author?.name || '?',
      seconds,
    };
  }
  const r = await yts(query);
  const v = r?.videos?.[0];
  if (!v) return null;
  return {
    url: v.url,
    title: v.title,
    author: v.author?.name || '?',
    seconds: Math.floor(v.duration?.seconds || 0),
  };
}

async function ytDownloadAudio(url) {
  const base = tmpBase();
  await runYtDlp([
    '-x', '--audio-format', 'mp3', '--audio-quality', '128K',
    '--ffmpeg-location', ffmpegPath,
    '-o', `${base}.%(ext)s`, '--no-playlist', '--newline',
    '--', url,
  ]);
  const file = findTmp(base);
  if (!file) throw new Error('fichier audio introuvable après conversion');
  try {
    const buf = fs.readFileSync(file);
    if (buf.length > 25 * 1024 * 1024) throw new Error('fichier trop volumineux (> 25 Mo)');
    return buf;
  } finally {
    try { fs.unlinkSync(file); } catch {}
  }
}

async function ytDownloadVideo(url) {
  const base = tmpBase();
  await runYtDlp([
    '-f', 'bv*[height<=480][ext=mp4]+ba[ext=m4a]/b[height<=480][ext=mp4]/b[height<=480]/b',
    '--merge-output-format', 'mp4', '--max-filesize', '15M',
    '--ffmpeg-location', ffmpegPath,
    '-o', `${base}.%(ext)s`, '--no-playlist', '--newline',
    '--', url,
  ]);
  const file = findTmp(base);
  if (!file) throw new Error('fichier vidéo introuvable');
  try {
    let buf = fs.readFileSync(file);
    if (buf.length > 14 * 1024 * 1024) {
      buf = await ffmpegBuffer(
        buf,
        ['-i', 'pipe:0', '-vf', 'scale=-2:360', '-c:v', 'libx264', '-preset', 'veryfast',
         '-crf', '28', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', 'pipe:1'],
        15 * 1024 * 1024
      );
    }
    if (buf.length > 15 * 1024 * 1024) throw new Error('fichier trop volumineux pour WhatsApp (> 15 Mo)');
    return buf;
  } finally {
    try { fs.unlinkSync(file); } catch {}
  }
}

const ytFail = (e) => `❌ Échec du téléchargement : ${e.message}\nRéessaie avec un autre titre, ou plus tard.`;

cmd(['yt', 'yts', 'ytsearch'], { cat: 11, desc: 'Rechercher une vidéo YouTube', usage: 'yt <titre>', requiresInput: true }, async (ctx) => {
  if (!ctx.q) return ctx.reply(`❌ Usage : ${config.prefix}yt <titre>`);
  await ctx.react('⏳');
  const r = await yts(ctx.q);
  const list = r?.videos?.slice(0, 5);
  if (!list?.length) return ctx.reply('❌ Aucun résultat trouvé.');
  const lines = list.map((v, i) =>
    `${i + 1}. *${v.title}*\n   ⏱ ${v.timestamp || '?'} · 👤 ${v.author?.name || '?'}\n   ${v.url}`
  );
  await ctx.reply(`🔎 *Résultats pour :* ${ctx.q}\n\n${lines.join('\n\n')}`);
  await ctx.react('✅');
});

cmd(['play', 'mp3', 'yta'], { cat: 11, desc: 'Télécharger une musique en MP3', usage: 'play <titre ou lien>', requiresInput: true }, async (ctx) => {
  if (!ctx.q) return ctx.reply(`❌ Usage : ${config.prefix}play <titre ou lien YouTube>`);
  await ctx.react('⏳');
  await ctx.reply(`${config.messages.wait}\n🎵 Recherche de *${ctx.q}*...`);
  let meta;
  try {
    meta = await ytResolve(ctx.q);
  } catch (e) {
    await ctx.react('❌');
    return ctx.reply(ytFail(e));
  }
  if (!meta) return ctx.reply('❌ Aucune vidéo trouvée. Précise le titre.');
  if (meta.seconds > 15 * 60) return ctx.reply(`❌ Durée trop longue (${formatDuration(meta.seconds * 1000)}) — limite 15 min.`);
  try {
    const audio = await ytDownloadAudio(meta.url);
    await send(ctx.sock, ctx.from, {
      audio,
      mimetype: 'audio/mpeg',
      ptt: false,
      fileName: `${meta.title.replace(/[^\w\s.-]/g, '').trim().slice(0, 60) || 'audio'}.mp3`,
    }, { quoted: ctx.msg });
    await ctx.reply(`🎵 *${meta.title}*\n👤 ${meta.author}\n⏱ ${formatDuration(meta.seconds * 1000)}`);
    await ctx.react('✅');
  } catch (e) {
    await ctx.react('❌');
    console.error('[DL play]', e.message);
    await ctx.reply(ytFail(e));
  }
});

cmd(['video', 'ytv', 'ytmp4'], { cat: 11, desc: 'Télécharger une vidéo YouTube', usage: 'video <titre ou lien>', requiresInput: true }, async (ctx) => {
  if (!ctx.q) return ctx.reply(`❌ Usage : ${config.prefix}video <titre ou lien YouTube>`);
  await ctx.react('⏳');
  await ctx.reply(`${config.messages.wait}\n🎬 Recherche de *${ctx.q}*...`);
  let meta;
  try {
    meta = await ytResolve(ctx.q);
  } catch (e) {
    await ctx.react('❌');
    return ctx.reply(ytFail(e));
  }
  if (!meta) return ctx.reply('❌ Aucune vidéo trouvée. Précise le titre.');
  if (meta.seconds > 20 * 60) return ctx.reply(`❌ Durée trop longue (${formatDuration(meta.seconds * 1000)}) — limite 20 min.`);
  try {
    const buf = await ytDownloadVideo(meta.url);
    await send(ctx.sock, ctx.from, {
      video: buf,
      mimetype: 'video/mp4',
      caption: `🎬 *${meta.title}*\n👤 ${meta.author}\n⏱ ${formatDuration(meta.seconds * 1000)} · ${(buf.length / 1048576).toFixed(1)} Mo`,
      fileName: `${meta.title.replace(/[^\w\s.-]/g, '').trim().slice(0, 60) || 'video'}.mp4`,
    }, { quoted: ctx.msg });
    await ctx.react('✅');
  } catch (e) {
    await ctx.react('❌');
    console.error('[DL video]', e.message);
    await ctx.reply(ytFail(e));
  }
});

/* ════════════════════════════════════════════════════════════
   5. EXÉCUTION DES COMMANDES
   ════════════════════════════════════════════════════════════ */

/* ── LUDO : module externe (dossier ludo/ + plugins/ludo.js) ────────────
   Le moteur (règles, salons, rendu PNG) est dans ludo/src et n'a aucune
   dépendance à handler.js — seules les 3 commandes sont branchées ici.
   try/catch : un module absent ou une dépendance manquante (canvas) ne
   doit jamais empêcher le bot de démarrer. ── */
try {
  require('./plugins/ludo')(cmd, commands);
} catch (e) {
  console.error('[LUDO] module non chargé :', e.message);
}

async function executeCommand(sock, msg, name, args, base) {
  const entry = commands.get(String(name).toLowerCase());
  if (!entry) return false;

  const ctx = {
    ...base,
    sock,
    msg,
    content: base.content,
    args,
    q: args.join(' '),
    /* Réponses : tout ce qui commence par ❌ est automatiquement
       encadré dans le style ERREUR officiel (rendu centralisé) ;
       les cadres (╭…) sont transmis tels quels. */
    reply: async (text, mentions) => {
      let body = text;
      if (typeof body === 'string' && body.startsWith('❌')) {
        body = renderError([body.slice(1).trim()]);
      }
      return send(sock, base.from, mentions ? { text: body, mentions } : { text: body }, { quoted: msg });
    },
    error: async (lines) =>
      send(sock, base.from, { text: renderError(Array.isArray(lines) ? lines : [lines]) }, { quoted: msg }),
    info: async (lines) =>
      send(sock, base.from, { text: renderInfo(Array.isArray(lines) ? lines : [lines]) }, { quoted: msg }),
    success: async (lines) =>
      send(sock, base.from, { text: renderSuccess(Array.isArray(lines) ? lines : [lines]) }, { quoted: msg }),
    saisie: async (hint) =>
      send(sock, base.from, { text: renderSaisie(hint) }, { quoted: msg }),
    react: async (emoji) => {
      try {
        await send(sock, base.from, { react: { text: emoji, key: msg.key } });
      } catch (e) {
        console.error('[CMD] react:', e.message);
      }
    },
  };

  /* Permissions */
  if (config.selfMode || state.settings.selfMode) {
    if (!ctx.isOwner && !msg.key.fromMe) return true; // silencieux
  }
  if (entry.owner && !ctx.isOwner) return ctx.error([config.messages.ownerOnly.toUpperCase()]), true;
  if (entry.group && !ctx.isGroup) return ctx.error([config.messages.groupOnly.toUpperCase()]), true;
  if (entry.admin && ctx.isGroup && !ctx.isAdmin && !ctx.isOwner) return ctx.error([config.messages.adminOnly.toUpperCase()]), true;
  if (entry.botAdmin && ctx.isGroup && !ctx.isBotAdmin) return ctx.error([config.messages.botAdminNeeded.toUpperCase()]), true;

  /* Saisie en attente (§9) : argument requis absent → on invite à
     répondre ; le prochain message texte sera passé en argument. */
  if (entry.requiresInput && !args.length) {
    setInput(base.from, entry.name, entry.usage || entry.name);
    await ctx.saisie(`POUR COMPLÉTER : ${config.prefix}${(entry.usage || entry.name).toUpperCase()}`);
    return true;
  }

  state.stats.commands += 1;
  saveState();

  typingOn(sock, base.from);
  try {
    await entry.handler(ctx);
  } catch (e) {
    console.error(`[CMD] ${entry.name}:`, e.message);
    await ctx.error([config.messages.error.replace(/^❌\s*/, '').toUpperCase(), `[${e.message}]`]).catch(() => {});
  }
  typingOff(sock, base.from);
  return true;
}

/* ════════════════════════════════════════════════════════════
   6. MENU INTERACTIF (chiffres 1 → 11)
   ════════════════════════════════════════════════════════════ */

async function handleNumeric(sock, msg, text, base) {
  if (!/^\d{1,2}$/.test(text)) return false;
  const chat = base.from;
  let st = menuState.get(chat);
  if (st && Date.now() - st.ts > MENU_TTL) {
    menuState.delete(chat);
    st = null;
  }
  if (!st) return false; // pas de menu ouvert → on ne détoure jamais les chiffres

  const n = parseInt(text, 10);
  st.ts = Date.now();

  if (n === 0) {
    setMenu(chat, 0);
    await sendMenu(sock, chat, renderMainMenu(base), msg);
    return true;
  }

  if (st.cat === 0) {
    const cats = CATEGORIES
      .map((c) => ({ ...c, list: visibleCommands(c.n, base) }))
      .filter((c) => c.list.length > 0);
    const hit = cats.find((c) => c.n === n);
    if (!hit) {
      await send(sock, chat, {
        text: renderError(['CHIFFRE INVALIDE', 'REPONDEZ 0 POUR LE MENU PRINCIPAL']),
      }, { quoted: msg });
      return true;
    }
    setMenu(chat, hit.n);
    await sendMenu(sock, chat, renderCategory(hit.n, base), msg);
    return true;
  }

  const list = visibleCommands(st.cat, base);
  if (n >= 1 && n <= list.length) {
    await executeCommand(sock, msg, list[n - 1].name, [], base);
    return true;
  }
  await send(sock, 
    chat,
    { text: renderError([`CHIFFRE INVALIDE (1-${list.length})`, 'REPONDEZ 0 POUR LE MENU PRINCIPAL']) },
    { quoted: msg }
  );
  return true;
}

/* ════════════════════════════════════════════════════════════
   6bis. AINORIA — intention en langage naturel → commande
   Actif uniquement pendant l'ouverture du menu (.menu, TTL 5 min) :
   l'utilisateur écrit « télécharge une chanson de… » au lieu de
   « .play … », AINORIA identifie l'intention et exécute la commande.
   Aucune correspondance → silence (on ne détourne pas la conversation).
   ════════════════════════════════════════════════════════════ */

const STOP_WORDS = new Set([
  'avec', 'dans', 'pour', 'sans', 'sous', 'tout', 'tous', 'toute', 'toutes',
  'mais', 'donc', 'puis', 'comme', 'quand', 'quel', 'quelle', 'ceux', 'cette',
  'these', 'leur', 'leurs', 'entre', 'vers', 'chez', 'ici', 'voici', 'cela',
  'bonjour', 'salut', 'coucou', 'merci', 'svp', 'please', 'hello', 'thanks',
  'comment', 'pourquoi', 'est-ce', 'peux', 'peut', 'voudrais', 'veux', 'faire',
]);

const normKeepLen = (s) =>
  String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const normText = (s) => normKeepLen(s).replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();

const INTENTS = [
  { cmd: 'video', keys: ['telecharge une video', 'telecharge la video', 'video youtube', 'envoie une video'] },
  { cmd: 'play', keys: ['telecharge une chanson', 'telecharge la musique', 'telecharge de la musique', 'mets de la musique', 'joue cette chanson', 'joue la musique', 'telecharge', 'musique', 'chanson', 'mp3'] },
  { cmd: 'yt', keys: ['cherche sur youtube', 'recherche youtube', 'resultats youtube', 'youtube', 'cherche'] },
  { cmd: 'sticker', keys: ['transforme en sticker', 'mets en sticker', 'fais un sticker', 'sticker'] },
  { cmd: 'toimg', keys: ['transforme en image', 'sticker en image'] },
  { cmd: 'translate', keys: ['traduis', 'traduire', 'traduit', 'traduction'] },
  { cmd: 'weather', keys: ['quelle meteo', 'meteo', 'quel temps', 'temperature'] },
  { cmd: 'calc', keys: ['combien font', 'combien fait', 'calcule', 'calcul'] },
  { cmd: 'joke', keys: ['fais moi rire', 'raconte une blague', 'blague', 'rigole'] },
  { cmd: 'level', keys: ['mon niveau', 'mon xp', 'experience', 'niveau'] },
  { cmd: 'menu', keys: ['menu', 'aide', 'help', 'commandes', 'liste des commandes'] },
  { cmd: 'info', keys: ['qui es tu', 'presente toi', 'informations', 'infos'] },
  { cmd: 'ping', keys: ['es tu la', 'tu es la', 'ping'] },
  { cmd: 'owner', keys: ['contacte le proprietaire', 'proprietaire', 'owner'] },
  { cmd: 'stats', keys: ['statistiques', 'stats'] },
  { cmd: 'ai', keys: ['intelligence artificielle', 'question a l ia', 'gemini', 'ia'] },
  { cmd: '8ball', keys: ['boule magique', '8ball'] },
  { cmd: 'coin', keys: ['pile ou face'] },
  { cmd: 'roll', keys: ['lance un des', 'jet de des'] },
  { cmd: 'ship', keys: ['compatibilite', 'ship'] },
  { cmd: 'wiki', keys: ['wikipedia', 'wiki'] },
  { cmd: 'github', keys: ['github'] },
  { cmd: 'convert', keys: ['taux de change', 'change de devise', 'convertis', 'conversion'] },
  { cmd: 'groupinfo', keys: ['infos du groupe', 'membres du groupe', 'qui est dans le groupe'] },
  { cmd: 'tagall', keys: ['tag tout le monde', 'mentionne tout le monde'] },
  { cmd: 'afk', keys: ['je suis afk', 'afk'] },
  { cmd: 'source', keys: ['code source', 'lien du code'] },
  { cmd: 'uptime', keys: ['depuis quand', 'temps de fonctionnement'] },
  { cmd: 'welcome', keys: ['message de bienvenue', 'active le bienvenue', 'bienvenue'] },
  { cmd: 'goodbye', keys: ['message d adieu', 'goodbye'] },
  { cmd: 'antilink', keys: ['interdit les liens', 'bloque les liens', 'anti lien', 'antilink'] },
  { cmd: 'antidelete', keys: ['renvoie les messages supprimes', 'anti suppression', 'antidelete'] },
  { cmd: 'warn', keys: ['avertis', 'avertissement'] },
  { cmd: 'poll', keys: ['sondage', 'question au groupe', 'un vote'] },
  { cmd: 'statut', keys: ['publie un statut', 'mets un statut', 'publier un status'] },
  { cmd: 'location', keys: ['envoie une position', 'partage une position'] },
  { cmd: 'vcard', keys: ['carte de contact', 'envoie un contact'] },
  { cmd: 'event', keys: ['creer un rendez vous', 'programme un evenement', 'un rendez vous'] },
  { cmd: 'analyse', keys: ['fais un ocr', 'transcris ce vocal', 'analyse cette image', 'decrit cette image'] },
];

function stripIntentKey(text, key) {
  const nt = normKeepLen(text);
  const nk = normKeepLen(key);
  const idx = nt.indexOf(nk);
  if (idx < 0) return text;
  return (text.slice(0, idx) + ' ' + text.slice(idx + nk.length)).trim();
}

async function runIntent(sock, msg, text, base) {
  const chat = base.from;
  const st = menuState.get(chat);
  if (!st || Date.now() - st.ts > MENU_TTL) return false; // menu fermé → jamais de détournement
  if (text.startsWith(config.prefix)) return false;         // préfixe = commande classique
  const n = normText(text);
  if (n.length < 3) return false;

  /* 1. Phrases d'intention explicites — on garde la clé la plus longue */
  let matched = null;
  for (const it of INTENTS) {
    if (!commands.has(it.cmd)) continue;
    for (const k of it.keys) {
      const nk = normText(k);
      if (!nk) continue;
      if (new RegExp(`(^| )${nk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`).test(n)) {
        if (!matched || nk.length > matched.key.length) matched = { cmd: it.cmd, key: nk };
      }
    }
  }

  /* 2. Repli flou : recoupement de mots avec noms/alias/descriptions */
  if (!matched) {
    const qTokens = n.split(' ').filter((t) => t.length >= 4 && !STOP_WORDS.has(t));
    if (qTokens.length) {
      const seen = new Set();
      let bestName = null, bestScore = 0, bestLen = 0;
      for (const c of commands.values()) {
        if (seen.has(c.name)) continue;
        seen.add(c.name);
        const hay = new Set(normText(`${c.name} ${c.aliases.join(' ')} ${c.desc}`).split(' ').filter(Boolean));
        let score = 0, maxLen = 0;
        for (const t of qTokens) {
          for (const h of hay) {
            if (h === t || (t.length >= 4 && h.startsWith(t)) || (h.length >= 4 && t.startsWith(h))) {
              score += 1;
              maxLen = Math.max(maxLen, Math.min(t.length, h.length));
              break;
            }
          }
        }
        const strong = score >= 2 || (score >= 1 && maxLen >= 6);
        if (strong && (score > bestScore || (score === bestScore && maxLen > bestLen))) {
          bestScore = score; bestLen = maxLen; bestName = c.name;
        }
      }
      if (bestName) matched = { cmd: bestName, key: null };
    }
  }

  if (!matched) return false;

  const rest = matched.key ? stripIntentKey(text, matched.key).trim() : text.trim();
  const args = rest ? rest.split(/\s+/) : [];
  const entry = commands.get(matched.cmd);

  st.ts = Date.now();
  await send(sock, chat, {
    text: buildFrame('AINORIA', [
      note(`${toUnicode('INTENTION')}: ${config.prefix}${entry.name}`),
      ...(args.length ? [note(`${toUnicode('ARGS')}: ${args.join(' ')}`)] : []),
    ]),
  }, { quoted: msg });
  await executeCommand(sock, msg, entry.name, args, base);
  return true;
}

/* ════════════════════════════════════════════════════════════
   7. PROTECTIONS DE GROUPE — moteur DJOUSSE GUARD (guard/)
   blacklist maison → exemptions → mute → 8 protections → sanction
   ════════════════════════════════════════════════════════════ */

async function guardDelete(sock, msg, base) {
  try {
    await send(sock, base.from, { delete: msg.key });
  } catch (e) {
    console.error('[GUARD] suppression impossible:', e.message);
  }
}

async function runGroupProtections(sock, msg, base, text, meta) {
  /* 1) Blacklist maison (owner) : au-dessus de tout, suppression muette */
  if (state.blacklist.includes(base.senderNum)) {
    guardEngine.markDeleted(msg.key.id);
    await guardDelete(sock, msg, base);
    return true;
  }

  /* 2) MOTEUR DJOUSSE GUARD : passifs → exemptions → mute → protections → sanction.
        Un seul point d'appel ; reçoit le parse COMPLET (statut, transfert, contact, sondage…)
        et les métadonnées déjà chargées (une seule requête groupMetadata). */
  const gp = guardParse(msg);
  const r = await guardEngine.runProtections({
    ...gp,
    sock,
    msg,
    meta,
    from: base.from,
    sender: base.sender,
    senderNum: base.senderNum,
    text: gp.text || text,
    isBotSelf: base.isBotSelf,
    isOwner: base.isOwner,
  });
  return !!r.handled;
}

/* ════════════════════════════════════════════════════════════
   8. POINT D'ENTRÉE — appelé par index.js
   ════════════════════════════════════════════════════════════ */

const isSystemJid = (jid) =>
  !jid || jid.includes('@broadcast') || jid.includes('status@') || jid.includes('@newsletter');

/* Moteur STATUTS (stories) : vu auto + réaction auto + réponse auto */
async function handleStatus(sock, msg) {
  try {
    if (msg.key.fromMe) return;
    if (config.autoStatusSeen) {
      await sock.readMessages([msg.key]).catch(() => {});
    }
    if (config.autoStatusReact) {
      await send(sock, 'status@broadcast', {
        react: { text: config.likeEmoji || '👍', key: msg.key },
      }).catch(() => {});
    }
    if (config.autoReplyStatus && config.statusReadMsg && msg.key.participant) {
      await send(sock, msg.key.participant, { text: config.statusReadMsg }).catch(() => {});
    }
  } catch (e) {}
}

async function handleMessage(sock, msg) {
  try {
    if (!msg?.message || !msg.key?.id) return;
    const from = msg.key.remoteJid;

    /* ── Statuts reçus → moteur STATUTS (avant tout filtre) ── */
    if (from === 'status@broadcast') {
      await handleStatus(sock, msg);
      return;
    }

    if (isSystemJid(from)) return;
    // Horloge téléphone / serveur parfois décalée : 30 min, et on ne drop jamais fromMe
    const ageMs = msg.messageTimestamp ? Date.now() - Number(msg.messageTimestamp) * 1000 : 0;
    if (ageMs > 30 * 60 * 1000 && !msg.key.fromMe) {
      console.log(`[HANDLER] message trop ancien ignoré (${from}) age=${Math.round(ageMs/1000)}s`);
      return;
    }

    const content = unwrap(msg.message);
    const text = textOf(content).trim();
    const isGroup = from.endsWith('@g.us');
    const fromMe = !!msg.key.fromMe;
    const sender = fromMe ? sock.user?.id || from : msg.key.participant || from;
    const senderNum = num(sender);
    const senderAlt = msg.key.participantAlt || msg.key.senderPn || null; // numéro réel quand l'ID est un LID

    // Ignore les échos de nos propres messages (sauf commandes owner testées en « moi-même »)
    if (fromMe && text && !text.startsWith(config.prefix)) {
      putCache(from, msg.key.id, msg);
      return;
    }

    state.stats.messages += 1;
    saveState();
    putCache(from, msg.key.id, msg);

    /* ── Auto-réaction aux messages entrants (flag AUTO_REACT) ── */
    if (
      config.autoReact &&
      !fromMe &&
      !content?.reactionMessage &&
      !content?.protocolMessage &&
      !text.startsWith(config.prefix)
    ) {
      send(sock, from, { react: { text: config.likeEmoji || '👍', key: msg.key } }).catch(() => {});
    }

    /* Base de contexte partagée */
    const botNum = num(sock.user?.id);
    const base = {
      from,
      sender,
      senderNum,
      isGroup,
      isOwner:
        fromMe ||
        isOwnerJid(sender) ||
        isOwnerJid(senderAlt) ||
        (senderNum && botNum && senderNum === botNum) ||
        (senderNum && config.ownerNumber.some((o) => senderNum === o || senderNum.endsWith(o) || o.endsWith(senderNum))),
      isBotSelf: fromMe,
      isAdmin: false,
      isBotAdmin: false,
      content,
      msg,
    };

    /* Métadonnées + rôles (groupes uniquement, en cache) */
    let meta = null;
    if (isGroup) {
      meta = await groupMeta(sock, from);
      base.isAdmin = isAdminIn(meta, sender) || base.isOwner;
      base.isBotAdmin = botIsAdmin(sock, meta);
    }

    /* ── PROTECTIONS DE GROUPE
          Les commandes (préfixe) passent TOUJOURS : on ne laisse pas le guard
          « avaler » .menu / .ping avant le moteur de commandes. ── */
    const isCommandText = !!(text && text.startsWith(config.prefix));
    if (isGroup && !fromMe && !isCommandText) {
      if (await runGroupProtections(sock, msg, base, text, meta)) return;
    }

    /* Mode self : les non-owners sont ignorés totalement */
    if ((config.selfMode || state.settings.selfMode) && !base.isOwner && !fromMe) {
      if (text && text.startsWith(config.prefix)) {
        console.log(`[HANDLER] SELF MODE — ignore ${senderNum} (owner: ${config.ownerNumber.join(',')})`);
      }
      return;
    }

    /* ── Suppression détectée → renvoi (antidelete) ── */
    const proto = content?.protocolMessage;
    if (proto && (proto.type === 'REVOKE' || proto.type === 0)) {
      const key = proto.key;
      if (key?.remoteJid && key?.id) {
        const cached = getCache(key.remoteJid, key.id);
        const g = getGroup(key.remoteJid);
        const gg = guardDb.db().getGroup(key.remoteJid);
        const byBot = msg.key.fromMe || guardEngine.wasDeleted(key.id); // supprimé par le bot / le guard
        const leaksLink = cached && gg.antilink &&
          findLinks(textOf(unwrap(cached.msg.message)), gg.linkWhitelist).length > 0;
        if (cached && g.antidelete && !cached.msg.key.fromMe && !byBot && !leaksLink) {
          const author = key.participant || key.remoteJid;
          await send(sock, key.remoteJid, {
            text: `♻️ *Message supprimé détecté*\nDe : +${num(author)}`,
            mentions: [author],
          }).catch(() => {});
          await send(sock, key.remoteJid, cached.msg.message, { quoted: cached.msg }).catch(() => {});
        }
      }
      return;
    }

    /* ── Vue unique reçue → auto-sauvegarde (.autonce on) ── */
    if (!fromMe && !isOwnerJid(sender) && state.once?.[from] && isOnceContent(msg.message)) {
      await autoSaveOnce(sock, msg, content, from, sender);
    }

    if (!text) return;

    /* ── Mémoire contextuelle : on garde les 10 derniers messages du chat ── */
    remember(from, senderNum, text);

    /* ── AFK : sortie + notifications ── */
    const u = getUser(senderNum);
    if (u.afk && !fromMe) {
      const d = Date.now() - u.afk.ts;
      u.afk = null;
      saveState();
      await send(sock, from, {
        text: `👋 Bienvenue, +${senderNum} ! Tu étais AFK ${formatDuration(d)}.`,
      }, { quoted: msg }).catch(() => {});
    }
    const ci = ctxInfo(content);
    if (ci?.mentionedJid?.length) {
      const afkMentions = ci.mentionedJid
        .map((j) => num(j))
        .filter((n) => state.users[n]?.afk);
      if (afkMentions.length) {
        const lines = afkMentions.map((n) => `💤 +${n} est AFK : ${state.users[n].afk.reason || 'sans raison'}`);
        await send(sock, from, { text: lines.join('\n'), mentions: ci.mentionedJid }, { quoted: msg }).catch(() => {});
      }
    }

    /* ── XP (légère progression) ── */
    if (!fromMe) {
      u.xp = (u.xp || 0) + 1 + Math.floor(Math.random() * 3);
      if (state.stats.messages % 20 === 0) saveState();
    }

    /* ── Saisie en attente (§9) : le message devient l'argument ── */
    const pending = peekInput(from);
    if (pending) {
      const trimmed = text.trim();
      if (/^annuler$/i.test(trimmed)) {
        clearInput(from);
        await send(sock, from, { text: renderSuccess(['SAISIE ANNULÉE']) }, { quoted: msg }).catch(() => {});
        return;
      }
      if (trimmed.startsWith(config.prefix)) {
        clearInput(from); // l'utilisateur a changé d'avis → on laisse passer la commande
      } else {
        clearInput(from);
        if (commands.has(pending.cmd)) {
          await executeCommand(sock, msg, pending.cmd, trimmed.split(/\s+/), base);
        }
        return;
      }
    }

    /* ── Menu interactif par chiffres ── */
    if (await handleNumeric(sock, msg, text, base)) return;

    /* ── AINORIA : intention en langage naturel (menu ouvert) ── */
    if (await runIntent(sock, msg, text, base)) return;

    /* ── Commande textuelle ── */
    const prefix = config.prefix;
    if (!text.startsWith(prefix)) return;

    const body = text.slice(prefix.length).trim();
    if (!body) return;
    const args = body.split(/\s+/);
    const name = args.shift();

    console.log(`[CMD] ${from} → ${prefix}${name} | owner=${base.isOwner} self=${!!(config.selfMode || state.settings.selfMode)} args=${args.length} text=${JSON.stringify(text.slice(0, 80))}`);

    if (!rateOk(sender)) {
      console.log('[CMD] rate-limit', senderNum);
      return;
    }

    const cmdName = name.toLowerCase();
    if (!commands.has(cmdName)) {
      console.log(`[CMD] inconnue: ${name} (total commandes: ${commands.size})`);
      try {
        await send(sock, from, {
          text: renderError(['COMMANDE INVALIDE', 'UTILISEZ LE MENU POUR CONTINUER']),
        }, { quoted: msg });
      } catch (e) {
        console.error('[CMD] envoi erreur commande invalide:', e.message);
      }
      return;
    }

    try {
      await executeCommand(sock, msg, name, args, base);
      console.log(`[CMD] OK ${cmdName}`);
    } catch (e) {
      console.error(`[CMD] ÉCHEC ${cmdName}:`, e.message);
      if (e.stack) console.error(e.stack.split('\n').slice(0, 6).join('\n'));
      // Secours : au moins répondre pour ping/menu
      try {
        await send(sock, from, {
          text: `⚠️ Erreur commande ${cmdName}: ${e.message}`,
        }, { quoted: msg });
      } catch (e2) {
        console.error('[CMD] envoi secours impossible:', e2.message);
      }
    }
  } catch (e) {
    console.error('[HANDLER]', e.message);
    if (e.stack) console.error(e.stack.split('\n').slice(0, 5).join('\n'));
  }
}

/* ════════════════════════════════════════════════════════════
   9. ÉVÉNEMENTS DE GROUPE — source de vérité UNIQUE
   (index.js → sock.ev.on('group-participants.update') → ici)

   RÈGLES ABSOLUES :
     add       → BIENVENUE
     remove    → DÉPART
     promote   → PROMOTION ADMIN
     demote    → RÉTROGRADATION
     toute autre action ('modify', inconnue, communauté…) → IGNORÉE
       (journalisée en debug, JAMAIS interprétée comme un départ)

   Drapeaux projet conservés : .welcome / .goodbye pilotent
   add / remove. promote et demote sont toujours annoncés.
   ════════════════════════════════════════════════════════════ */

/* — Le style (toUnicode, frameHeader, frameFooter, buildFrame) est
     centralisé en section 3bis — un seul endroit à modifier. — */

/* — Anti-doublon des événements de groupe —
   Baileys n'envoie PAS d'identifiant d'événement : on construit une
   empreinte groupe|action|participants(triés)|auteur. Le rejeu d'un
   même événement (re-stream, redémarrage) est ignoré pendant TTL. */
const groupEventCache = new Map();
const GROUP_EVENT_TTL = 10 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [k, ts] of groupEventCache) if (now - ts > GROUP_EVENT_TTL) groupEventCache.delete(k);
}, 60000).unref();

async function handleGroupUpdate(sock, update) {
  try {
    const { id, action } = update || {};
    if (!id || !id.endsWith('@g.us')) return;

    /* NORMALISATION (cas réel Baileys) : messageStubParameters est
       JSON.parse → les participants arrivent parfois en OBJETS
       ({ id, phoneNumber… }), jamais uniquement en chaînes. On exige
       des JID strings avant toute empreinte, mention ou envoi. */
    const normJid = (p) => {
      if (typeof p === 'string' && p) return p;
      if (p && typeof p === 'object') return p.id || p.jid || p.phoneNumber || null;
      return null;
    };
    let participants = (Array.isArray(update.participants) ? update.participants : [])
      .map(normJid)
      .filter((j) => typeof j === 'string' && j.length);
    const author = normJid(update.author ?? update.authorPn) || '-';

    if (!participants.length) return;

    /* Événement inconnu → journalisé, AUCUN message utilisateur */
    if (action !== 'add' && action !== 'remove' && action !== 'promote' && action !== 'demote') {
      console.log(`⚠️ GROUP EVENT IGNORED\nACTION: ${action}\nREASON: UNSUPPORTED_ACTION`);
      return;
    }

    /* Empreinte anti-doublon */
    const eventId = [id, action, [...participants].sort().join(','), author || '-'].join('|');
    if (groupEventCache.has(eventId)) {
      console.log(`[GROUPE] doublon ignoré — ${eventId}`);
      return;
    }
    groupEventCache.set(eventId, Date.now());

    /* Anti-fake (guard) : expulse les indicatifs non autorisés AVANT le message de bienvenue */
    if (action === 'add') {
      const fakes = await guardEvents.enforceAntiFake(sock, { id, participants, action });
      if (fakes.length) {
        participants = participants.filter((p) => !fakes.includes(p));
        if (!participants.length) return;
      }
    }

    const g = getGroup(id);
    const wantsMessage =
      action === 'promote' || action === 'demote' ||
      (action === 'add' && g.welcome) ||
      (action === 'remove' && g.goodbye);

    /* Nom du groupe : TOUJOURS dynamique depuis les métadonnées */
    const meta = await groupMeta(sock, id);
    if (!meta) console.log(`[GROUPE] métadonnées indisponibles (${id}) → nom par défaut`);
    const groupName = meta?.subject || 'CE GROUPE';

    /* Photo de profil du groupe — échec = simple message texte,
       jamais bloquant (test : groupe sans photo) */
    let groupProfilePicture = null;
    if (wantsMessage) {
      try {
        groupProfilePicture = await sock.profilePictureUrl(id);
      } catch (error) {
        console.log(`[GROUPE] photo indisponible (${id}): ${error.message}`);
      }
    }

    /* Log de diagnostic — reflette la réalité (après les appels réseau) */
    console.log(
      '========== GROUP EVENT ==========\n' +
      `GROUP: ${id}\n` +
      `ACTION: ${action}\n` +
      `PARTICIPANTS: ${participants.join(', ')}\n` +
      `AUTHOR: ${author || '-'}\n` +
      `GROUP NAME: ${groupName}\n` +
      `PROFILE PICTURE: ${groupProfilePicture || 'aucune'}\n` +
      `EVENT ID: ${eventId}\n` +
      '================================='
    );

    if (!wantsMessage) {
      console.log(`[GROUPE] message non demandé — ${action} désactivé (${action === 'add' ? '.welcome off' : '.goodbye off'})`);
      return;
    }

    /* Style officiel DJOUSSE TECH — STRATÉGIE MULTI-PARTICIPANTS :
       UN SEUL message par événement, une ligne ✦ par participant
       (zéro spam, zéro doublon). Mentions réelles transmises à Baileys. */
    const mentionLines = participants
      .map((p) => note(`👤 @${num(p)}`))
      .join('\n');
    const groupLine = note(`${toUnicode('GROUPE')}: ${groupName}`);

    const textByAction = {
      add: buildFrame('BIENVENUE', [
        mentionLines,
        note(toUnicode('BIENVENUE DANS LE GROUPE')),
        groupLine,
      ]),
      remove: buildFrame('DÉPART', [
        mentionLines,
        note(toUnicode('VIENT DE QUITTER LE GROUPE')),
        groupLine,
      ]),
      promote: buildFrame('ADMIN PROMOTION', [
        mentionLines,
        note(toUnicode('NOUVEAU ADMINISTRATEUR')),
        groupLine,
      ]),
      demote: buildFrame('RÉTROGRADATION', [
        mentionLines,
        note(toUnicode("N'EST PLUS ADMINISTRATEUR")),
        groupLine,
      ]),
    };
    const text = textByAction[action];

    /* Photo + légende = UN seul message WhatsApp ; sans photo → texte.
       ✅ logué seulement APRÈS un await réussi. */
    try {
      if (groupProfilePicture) {
        await send(sock, id, {
          image: { url: groupProfilePicture },
          caption: text,
          mentions: participants,
        });
      } else {
        await send(sock, id, { text, mentions: participants });
      }
      console.log(`[GROUPE] ✅ ${action} envoyé → ${id} (${participants.length} participant(s))`);
    } catch (error) {
      console.error('[GROUPE] envoi impossible:', error.message);
    }
  } catch (error) {
    console.error('[GROUPE] group-update:', error.message);
  }
}

/* ════════════════════════════════════════════════════════════
   9bis. messages.update — éditions, votes de sondages, status
   ════════════════════════════════════════════════════════════ */

async function handleMessagesUpdate(sock, updates) {
  if (!Array.isArray(updates) || !updates.length) return;
  for (const u of updates) {
    try {
      const key = u?.key;
      const update = u?.update;
      if (!key?.id || !update) continue;

      // Garder le cache à jour si le message est édité
      if (update.message) {
        const cached = getCache(key.remoteJid, key.id);
        if (cached?.msg) {
          cached.msg.message = update.message;
          cached.ts = Date.now();
        }
      }

      // Votes de sondage (log léger — le reste est géré par Baileys si getMessage est branché)
      if (update.pollUpdates?.length) {
        console.log(`[POLL] vote reçu sur ${key.remoteJid} / ${key.id} (${update.pollUpdates.length})`);
      }
    } catch (e) {
      console.error('[HANDLER] messages.update:', e.message);
    }
  }
}

/* ════════════════════════════════════════════════════════════
   10. MÉTADONNÉES DE GROUPE — journal .glog (groups.update)
   ════════════════════════════════════════════════════════════ */

async function handleGroupInfo(sock, update) {
  try {
    if (!update?.id?.endsWith('@g.us')) return;
    const g = getGroup(update.id);
    if (!g.glog) return;
    const lines = [];
    if (update.subject) lines.push(`📝 Nom → *${update.subject}*`);
    if (update.desc !== undefined && update.desc !== null) lines.push('📄 Description modifiée');
    if (update.announcement !== undefined) {
      lines.push(update.announcement ? '🔒 Groupe fermé (admins seulement)' : '🔓 Groupe ouvert à tous');
    }
    if (!lines.length) return;
    await send(sock, update.id, { text: `📢 *Groupe mis à jour*\n${lines.join('\n')}` }).catch(() => {});
  } catch (e) {
    console.error('[HANDLER] group-info:', e.message);
  }
}

module.exports = {
  isSystemJid,
  handleMessage,
  handleGroupUpdate,
  handleGroupInfo,
  handleMessagesUpdate,
  commands,
  CATEGORIES,
  renderMainMenu,
  state,
  saveState,
  askGemini,
  getMessageForBaileys,
  putCache,
  getCache,
  getScheduler,
  getStore,
};
