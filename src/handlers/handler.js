'use strict';
/**
 * handler.js — Cerveau unique de DJOUSSE TECH MD
 * ────────────────────────────────────────────────
 * • Menu interactif par chiffres de 1 à 10 (navigation par catégories)
 * • Commandes textuelles (.prefix + nom) — 210 commandes dans 11 catégories
 * • Protections de groupe : antilink, antibad, antidelete, warns, blacklist,
 *   welcome/goodbye
 * • État persistant : data/state.json + mémoire data/history.json
 *
 * index.js délègue ici : messages.upsert → handleMessage(),
 * group-participants.update → handleGroupUpdate().
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const config = require('../config/config');
const P = require('../config/paths');
/* Stats de connexion alimentées par index.js (commande .diag) */
const waStats = require('../lib/waStats');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const sharp = require('sharp');
/* Stickers : fabrique interne (lib/wa-sticker.js) — remplace
   wa-sticker-formatter (conflit de DLL sharp@0.30 + 4 vulnérabilités). */
const { Sticker, StickerTypes } = require('../lib/wa-sticker');
const math = require('mathjs');
const QRCode = require('qrcode');
const { translate } = require('@vitalets/google-translate-api');
const yts = require('yt-search');
const https = require('https');
const ffmpegPath = require('ffmpeg-static');
const { initStore, getStore } = require('../lib/store');
const { createMessageCache } = require('../lib/message-cache');
const { initScheduler, getScheduler } = require('../lib/scheduler');
const { commandAccess } = require('../lib/command-access');
const { withNetworkTimeout } = require('../lib/network-timeout');
const { registerExtras } = require('../lib/extras');
const { registerHackTools, GROUPES: HACK_SECTIONS } = require('../lib/hacktools');
const { loadCorePlugins } = require('../lib/plugin-loader');
const { appliquerTables, appliquerFamilles } = require('../commandes/_regles');
const { isDisabled: commandeMorte } = require('../config/disabled-commands');
const chargerCommandes = require('../commandes/_maison');
const { registerPortedAuto, onMessage: autoOnMessage, onStatus: autoOnStatus, startOnlineTimer: autoStartTimer, autoSettings } = require('../lib/ported-auto');
const portedGroup = require('../lib/ported-group');
const portedAudio = require('../lib/ported-audio');
const portedFun = require('../lib/ported-fun');
const { registerPortedLogo, registerPortedLookup } = require('../lib/ported-logo');
const { registerPortedShot } = require('../lib/ported-shot');
const { registerPortedFoot } = require('../lib/ported-foot');
/* Conversion vidéo via ffmpeg-static — helper partagé (voir lib/wa-sticker.js) */
const { ffmpegBuffer } = require('../lib/ffmpeg');
const { registerTools } = require('../lib/tools');
const { registerMissing } = require('../lib/missing');
/* Service unique d'envoi WhatsApp (G2) : tout envoi passe par send()
   MODULE 2 : typingOn/typingOff = présence « écrit… », implémentation
   UNIQUE dans wa-send (humanisation du transport — plus de copie ici) */
const { send, typingOn, typingOff } = require('../lib/wa-send');
/* Durées éphémères partagées (.disappear ↔ .community ephemeral) */
const { parseEphemeral } = require('../lib/ephemeral');

/* ── DJOUSSE GUARD — moteur de protections de groupe (dossier guard/) ── */
const guardDb = require('../guard/db');
const guardEngine = require('../guard/engine');
const { parse: guardParse, unwrap, textOf, ctxInfo } = require('../guard/utils/message');
const guardPerms = require('../guard/utils/perms');
/* MODULE 1 : autorisations (owner/sudo/accepted) — implémentation unique */
const auth = require('../lib/auth');
/* MODULE 2 : détection de conflits bot↔bot + pause de chat */
const conflict = require('../lib/conflict');
/* MODULE 4 : IA unifiée — Gemini + secours OpenRouter, messages d'erreur élégants */
const { askAI, hasAIKey, aiUserMessage, MSG_NO_KEY } = require('../lib/ai');
/* Moteur auto-statuts (vue + réaction + réponse) — voir lib/auto-status.js */
const autoStatus = require('../lib/auto-status');
const guardEvents = require('../guard/events');
const guardUi = require('../guard/ui');
const { findLinks } = require('../guard/utils/links');
const { formatDuration } = require('../guard/utils/time');
const {
  toUnicode, frameFooter, buildFrame, listHeader, listItem, bullet, signature, signatureBox,
  renderInfo, renderSuccess, renderError, renderSaisie, nowTime, nowDate,
  row, blank, title, note, catBox, numItem, backBox,
} = require('../config/style');
const guardSanctions = require('../guard/sanctions');
const guardRegistry = require('../guard/commands');
const guardProtections = require('../guard/protections');
/* Base locale séparée de session/ : voir lib/dataDir.js.
   La migration s'exécute UNE fois ici, AVANT toute lecture, pour que
   state.json / guard.json soient déjà au bon endroit. */
const { DATA_DIR, inData, migrate } = require('../lib/dataDir');
migrate();

/* Base SQLite (node:sqlite) : config, historique et journal dans un
   seul data/bot.db. Si le module manque (Node < 22.5), on retombe
   exactement sur les fichiers JSON d'origine. */
const localDb = require('../lib/db');
const useSqlite = localDb.available();

/* Base du moteur : initialisation paresseuse (tests locaux sans index.js) */
try { guardDb.db(); } catch (e) { guardDb.init(inData(config.guard.dbFile)); }

/* ════════════════════════════════════════════════════════════
   1. ÉTAT PERSISTANT — data/bot.db (table kv), JSON en repli
   ════════════════════════════════════════════════════════════ */

const STATE_FILE = inData('state.json');
const HISTORY_FILE = inData('history.json');

const readJSONFile = (p) => {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
};

/* Adaptateur à deux moteurs, même signature des deux côtés.
   Au premier passage en SQLite, l'ancien JSON est encore lu (migration
   passive) ; la première écriture le remplace définitivement. */
const store = useSqlite ? {
  read(key, file) { return localDb.has(key) ? localDb.getJSON(key) : readJSONFile(file); },
  write(key, file, value) { localDb.setJSON(key, value); },
} : {
  read(key, file) { return readJSONFile(file); },
  write(key, file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
    fs.renameSync(tmp, file);
  },
};

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
  const raw = store.read('state', STATE_FILE);
  if (!raw || typeof raw !== 'object') return defaultState();
  const base = defaultState();
  try {
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
    console.error('[STATE] Fichier illisible, État par défaut :', e.message);
    return defaultState();
  }
}

const state = loadState();
/* MODULE 1 : lie lib/auth à l'état persistant (sudo + accepted).
   saveState est une function → hoistée, déjà déclarée en dessous. */
auth.bind(state, saveState);
try {
  initStore(DATA_DIR);
  initScheduler(DATA_DIR);
} catch (e) {
  console.error('[INIT] store/scheduler:', e.message);
}
// Secours : si FORCE_PUBLIC=1 dans .env, on force le mode public à chaque démarrage
if (process.env.FORCE_PUBLIC === '1' || process.env.FORCE_PUBLIC === 'true') {
  state.settings.selfMode = false;
  console.log('[STATE] FORCE_PUBLIC=1 → selfMode désactivé');
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
      store.write('state', STATE_FILE, state);
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
/* MODULE 1 : les tests d'autorisation sont délégués à lib/auth.js
   (implémentation unique — comparaison EXACTE, plus aucun endsWith) */
function isPrimaryOwner(n) {
  return auth.isOwner(n);
}

function isSudoNumber(n) {
  return auth.isSudo(n);
}

const isOwnerJid = (jid) => {
  if (!jid) return false;
  const n = num(jid);
  if (!n) return false;
  return auth.isOwner(n) || auth.isSudo(n);
};

/* Message « vue unique » (view once) — détection sur le brut,
   AVANT unwrap (les wrappers portent l'information).

   On DESCEND la chaîne d'enveloppes au lieu d'un test plat : WhatsApp
   intercale régulièrement ephemeralMessage (chat à durée limitée) ou
   documentWithCaptionMessage AVANT le wrapper vue unique. Le test à un
   seul niveau déclenchait un faux « CE MESSAGE N'EST PAS EN VUE UNIQUE »
   et faisait manquer l'auto-sauvegarde (.autonce). */
function isOnceContent(raw) {
  let cur = raw;
  for (let i = 0; i < 6 && cur; i++) {
    if (cur.viewOnceMessage || cur.viewOnceMessageV2 || cur.viewOnceMessageV2Extension) return true;
    const inner = cur.ephemeralMessage?.message
      || cur.documentWithCaptionMessage?.message
      || (cur.editedMessage?.message?.protocolMessage?.editedMessage)
      || cur.editedMessage?.message
      || null;
    if (!inner) return false;
    cur = inner;
  }
  return false;
}

function unwrapOnce(raw) {
  let current = raw;
  for (let i = 0; i < 6 && current; i++) {
    const next = current.ephemeralMessage?.message
      || current.viewOnceMessage?.message
      || current.viewOnceMessageV2?.message
      || current.viewOnceMessageV2Extension?.message
      || current.documentWithCaptionMessage?.message
      || current.editedMessage?.message?.protocolMessage?.editedMessage
      || current.editedMessage?.message
      || null;
    if (!next) break;
    current = next;
  }
  return current || null;
}

/* textOf() et ctxInfo() ne sont plus définis ici : implementations uniques
   du projet, déplacées dans guard/src/utils/message.js (G4 « parseurs »).
   handler.js les importe en tête de fichier, comme unwrap/parse. */

/* Cache des messages (antidelete / getMessage / edit / pin) : `${chat}|${id}` → message complet
   Branché sur makeWASocket({ getMessage }) pour retry, polls, édition. */
const { put: putCache, get: getCache, listChats: getCachedChats } = createMessageCache({
  getStore,
  getMaxSize: () => config.msgCacheMax || 800,
});
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

/* Limitation de débit : 10 commandes / 10 s par expéditeur.
   Réglable par .env (RATE_MAX / RATE_WINDOW_MS) — mêmes valeurs par défaut.
   Utile aux balayages de test : sinon 1 seul expéditeur (ex. le créateur de
   l'agent) est coupé au 11ᵉ envoi, ce qui masque le comportement réel. */
const RATE_MAX = Number(process.env.RATE_MAX) > 0 ? Number(process.env.RATE_MAX) : 10;
const RATE_WINDOW_MS = Number(process.env.RATE_WINDOW_MS) > 0 ? Number(process.env.RATE_WINDOW_MS) : 10000;
const rateMap = new Map();
function rateOk(sender) {
  const now = Date.now();
  let r = rateMap.get(sender);
  if (!r || now - r.ts > RATE_WINDOW_MS) {
    r = { count: 0, ts: now };
    rateMap.set(sender, r);
  }
  r.count += 1;
  return r.count <= RATE_MAX;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, r] of rateMap) if (now - r.ts > 30000) rateMap.delete(k);
}, 30000).unref();

/* ── MODULE 2 : avertissement envoyé à la 1ʳᵉ détection de conflit ──
   Appelé aux deux points de détection de handleMessage (signature de
   cadre / ping-pong rapide, et participant isBot). Une seule fois. */
function avertirConflit(sock, msg, chat, raison) {
  console.log(`[CONFLIT] pause ${chat} — ${raison}`);
  send(sock, chat, {
    text: renderError([
      'CONFLIT DÉTECTÉ — UN AUTRE BOT RÉPOND SUR CE CHAT',
      'COMMANDES ET RÉPONSES EN PAUSE',
      'OWNER : .UNPAUSE POUR REPRENDRE',
    ]),
  }, { quoted: msg }).catch(() => {});
}

/* ════════════════════════════════════════════════════════════
   2bis. MÉMOIRE CONTEXTUELLE — derniers messages par chat (RAM)
   ════════════════════════════════════════════════════════════ */

const history = new Map(); // jid → [{ s, t, ts }] (max 10/chat, 300 chats)
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
    const raw = store.read('history', HISTORY_FILE);
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
    store.write('history', HISTORY_FILE, Object.fromEntries(history));
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

/* ── VUE UNIQUE — dossier de récupération + extensions ─────────
   Référence : DJOUSSE-TECH-VV. TOUT média récupéré est écrit dans
   downloads/ (créé au démarrage) avant d'être renvoyé. */
const DOWNLOAD_DIR = P.DOWNLOADS;
fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

const VV_EXT = {
  imageMessage: 'jpg',
  videoMessage: 'mp4',
  audioMessage: 'ogg',
  documentMessage: 'bin',
  stickerMessage: 'webp',
};

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

/* ── VUE UNIQUE — téléchargement + sauvegarde disque ───────────
   Structure de référence (downloadVV) : le média est téléchargé,
   ÉCRIT dans downloads/, puis retourné avec ses métadonnées. */
async function downloadVV(sock, info) {
  const buffer = await downloadFrom(sock, info);
  if (!buffer?.length) throw new Error('Média vide — vue unique déjà ouverte ou URL expirée.');
  const ext = (String(info.mimetype || '').split('/')[1] || '').split(';')[0].replace('jpeg', 'jpg')
    || VV_EXT[info.type] || 'bin';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `vv-${stamp}.${ext}`;
  const output = path.join(DOWNLOAD_DIR, filename);
  fs.writeFileSync(output, buffer);
  console.log(`[VV] ${info.type} -> ${output} (${buffer.length} octets)`);
  return {
    output,
    filename,
    bytes: buffer.length,
    type: info.type,
    buffer,
    node: info.content?.[info.type] || null,
  };
}

/* Cible d'une récupération .vv : préférer le message complet du cache,
   sinon reconstruire la clé à partir du message cité. */
function findOnceTarget(msg) {
  const ci = ctxInfo(unwrapOnce(msg?.message));
  const quotedId = ci?.stanzaId;
  const cached = quotedId ? getCache(msg.key?.remoteJid, quotedId)?.msg : null;
  if (cached?.message) return cached;
  if (!ci?.quotedMessage) return null;
  return {
    key: {
      remoteJid: msg.key.remoteJid,
      fromMe: false,
      id: quotedId || `quoted-${Date.now()}`,
      participant: ci.participant,
    },
    message: ci.quotedMessage,
  };
}

/* Résout le média directement dans le message cible, sans suivre une
   éventuelle citation imbriquée présente dans le média lui-même. */
function onceMediaInfo(target) {
  const content = unwrapOnce(target?.message);
  if (!content) return null;
  const type = Object.keys(VV_EXT).find((key) => content[key]);
  if (!type) return null;
  return {
    target,
    type,
    mimetype: content[type]?.mimetype,
    content,
  };
}

/* ── VUE UNIQUE — envoi du média récupéré ──────────────────────
   Structure de référence (sendRecovered) : un branchement par type,
   puis message texte pour les types sans légende (audio/sticker).
   Transport garanti G2 : uniquement le service send(). */
async function sendRecovered(sock, jid, result, quoted, caption) {
  const body = caption
    || `✅ Vue unique récupérée\nType : ${result.type}\nTaille : ${result.bytes} octets`;
  const opts = quoted ? { quoted } : undefined;
  const payload = {};
  if (result.type === 'imageMessage') {
    payload.image = result.buffer;
    payload.caption = body;
  } else if (result.type === 'videoMessage') {
    payload.video = result.buffer;
    payload.caption = body;
  } else if (result.type === 'stickerMessage') {
    payload.sticker = result.buffer;
  } else if (result.type === 'audioMessage') {
    payload.audio = result.buffer;
    payload.mimetype = result.node?.mimetype || 'audio/ogg; codecs=opus';
    payload.ptt = !!result.node?.ptt;
  } else {
    payload.document = result.buffer;
    payload.mimetype = result.node?.mimetype || 'application/octet-stream';
    payload.fileName = result.node?.fileName || result.filename;
    payload.caption = body;
  }
  await send(sock, jid, payload, opts);
  if (result.type === 'audioMessage' || result.type === 'stickerMessage') {
    await send(sock, jid, { text: body }, opts);
  }
}

/* ── PHOTO ALÉATOIRE DU MENU ─────────────────────────────────
   L'image affichée par .menu tourne toute seule : à chaque
   expiration du cache de `getMenuImageBuffer()`, une nouvelle photo
   est téléchargée (Picsum — photos réelles aléatoires, hôte restreint,
   taille bornée). En cas d'échec réseau on retombe proprement sur
   l'image locale puis sur la bannière générée — le menu n'échoue
   jamais.

   (Remplace l'ancienne rotation de la PHOTO DE PROFIL WhatsApp :
   la photo qui change est celle du menu, pas le profil du bot.) */
async function fetchRandomMenuPhoto() {
  const image = await withNetworkTimeout(async (signal) => {
    const response = await fetch('https://picsum.photos/800/450', { signal });
    if (!response.ok) throw new Error(`Picsum a répondu HTTP ${response.status}.`);
    if (!response.headers.get('content-type')?.startsWith('image/')) {
      throw new Error('Picsum n’a pas retourné une image.');
    }
    const declaredSize = Number(response.headers.get('content-length') || 0);
    if (declaredSize > 10 * 1024 * 1024) throw new Error('Image Picsum trop volumineuse.');
    if (!response.body) throw new Error('Réponse image Picsum vide.');
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > 10 * 1024 * 1024) {
        await reader.cancel();
        throw new Error('Image Picsum trop volumineuse.');
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks, total);
  }, 30000, 'Téléchargement photo aléatoire Picsum');
  if (!image.length) throw new Error('Image Picsum vide.');
  /* Format menu : 800×450 JPEG léger, comme setmenuimg. */
  return sharp(image)
    .resize(800, 450, { fit: 'cover' })
    .jpeg({ quality: 75, mozjpeg: true })
    .toBuffer();
}

/* ════════════════════════════════════════════════════════════
   AUTO-SAUVEGARDE VUE UNIQUE (.autonce on)
   WhatsApp interdit de conserver un média « vue unique » :
   quand l'option est active sur un chat, chaque média vue unique
   reçu est téléchargé et envoyé en privé au propriétaire.
   ════════════════════════════════════════════════════════════ */
async function autoSaveOnce(sock, msg, from, sender) {
  try {
    const info = onceMediaInfo(msg);
    if (!info || !['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'].includes(info.type)) return;
    state.onceCd = state.onceCd || {};
    if (state.onceCd[from] && Date.now() - state.onceCd[from] < 60000) return;
    state.onceCd[from] = Date.now();
    const ownerJid = `${config.ownerNumber[0]}@s.whatsapp.net`;
    const result = await downloadVV(sock, info);
    const chatLabel = from.endsWith('@g.us') ? `GROUPE ${num(from)}` : 'CHAT PRIVÉ';
    await sendRecovered(sock, ownerJid, result, null, renderSuccess([
      'VUE UNIQUE RÉCUPÉRÉE',
      `DE: +${num(sender)}`,
      `CHAT: ${chatLabel}`,
    ]));
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

/* ── IA ── MODULE 4 : implémentation unifiée dans lib/ai.js
   (Gemini → repli OpenRouter, erreurs élégantes) — import en tête de fichier. */

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
  { n: 12, label: 'ARCHIVES', emoji: '🔐' },
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
  /* Méthode de connexion en vigueur (option B) :
     '' → auto (session existante = QR, sinon invitation au démarrage) */
  const linkLabel = config.connectMethod === 'pairing'
    ? `PAIRING ${config.pairingPhone ? `+${config.pairingPhone}` : '(auto)'}`
    : config.connectMethod === 'qr' ? 'QR' : 'AUTO';

  const header = buildFrame('INFO BOT', [
    bullet('PREFIX', `〔${config.prefix}〕`),
    bullet('BOT', config.botName),
    bullet('TIME', nowTime()),
    bullet('DATE', nowDate()),
    bullet('CONNEXION', linkLabel),
    title(toUnicode('STATUS PANEL')),
    row(toUnicode('REPLY WITH A NUMBER')),
  ]);

  const cats = CATEGORIES
    .map((c) => ({ ...c, list: visibleCommands(c.n, base) }))
    .filter((c) => c.list.length > 0 || c.n === 12); // ARCHIVES (cat.12) toujours visible

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

/* ── SOUS-MENU GROUPE : catalogue STATIQUE en 9 sections (89 commandes).
      L'affichage est déclaratif (charte du créateur) ; l'exécution au
      chiffre reste gérée par visibleCommands() — flux inchangé. */
const GROUPE_SECTIONS = [
  { emoji: '👑', label: 'ADMINISTRATION', items: ['admin', 'admins', 'promote', 'demote', 'kick', 'tagadmin', 'tagall', 'hidetag', 'mentionall', 'htag'] },
  { emoji: '👥', label: 'MEMBRES', items: ['listmembers', 'dmmembers', 'listadmins', 'mygroups', 'getjid'] },
  { emoji: '🔗', label: 'LIENS & INVITATIONS', items: ['link', 'revoke', 'ginvite', 'inviteinfo', 'joingroup', 'joinv4'] },
  { emoji: '🔒', label: 'OUVERTURE / FERMETURE', items: ['open', 'close', 'lock', 'unlock', 'joinmode'] },
  { emoji: '📝', label: 'CONFIGURATION', items: ['setname', 'setdesc', 'grouprules', 'rules', 'pin', 'pinmsg', 'unpin', 'disappear', 'groupcron', 'welcomequiz'] },
  { emoji: '🛡️', label: 'FILTRES & MUTES', items: ['addfilter', 'removefilter', 'clearfilters', 'listfilters', 'mutelist', 'muteuser', 'unmuteuser', 'automute', 'autounmute', 'addmode'] },
  { emoji: '📊', label: 'INFO & STATS', items: ['groupinfo', 'groupstatus', 'gstats', 'chatstats', 'analytics', 'rank', 'time', 'tz', 'expense', 'glog', 'auditlog', 'groupbackup', 'backupgroup'] },
  { emoji: '🏘️', label: 'COMMUNAUTÉ', items: ['community', 'comminfo', 'comminvite', 'commapprove', 'commreject', 'commrequests', 'commrevoke', 'newsletter'] },
  { emoji: '📦', label: 'DIVERS', items: ['leavegroup', 'bye2', 'hug', 'warnreset', 'reportuser', 'blocknum', 'blockuser', 'unblockuser', 'addnote', 'vcfgen', 'terminategc', 'subbot', 'pair', 'togglestatus', 'anon', 'listblock', 'massbc', 'broadcast2', 'revokev4', 'poll', 'dailychallenge', 'sondage'] },
];

/* Item de section : ┊ 𝟶𝟷 ⟩⟩ .cmd (chiffres gras + double chevron) */
const groupeItem = (n, cmd) => `┊ ${toUnicode(String(n).padStart(2, '0'))} ⟩⟩ .${cmd}`;

function renderGroupMenu() {
  const total = GROUPE_SECTIONS.reduce((s, c) => s + c.items.length, 0);

  const header = buildFrame('GROUPE MENU', [
    bullet('BOT', config.botName),
    bullet('PREFIX', `〔 ${config.prefix} 〕`),
    bullet('COMMANDES', `${toUnicode(String(total))} ${toUnicode('UNIQUES')}`),
    bullet('ALIAS', `${toUnicode('10')} ${toUnicode('cachés')}`),
    title(toUnicode('REPLY WITH A NUMBER')),
  ]);

  const blocks = GROUPE_SECTIONS.map((s) => [
    catBox(s.emoji, s.label, s.items.length),
    ...s.items.map((cmd, i) => groupeItem(i + 1, cmd)),
  ].join('\n'));

  return `${header}\n\n${blocks.join('\n\n')}\n\n${backBox(`⬅️ ${toUnicode('RETOUR AU MENU')}`)}\n\n${signature()}`;
}

/* ════════════════════════════════════════════════════════════
   7bis. ARCHIVES (cat.12) — catalogue déclaratif en 4 sections
   ────────────────────────────────────────────────────────────
   · 01 ARMES ANTI-COMPTE et 02 CONTENU ADULTE : AFFICHAGE SEUL,
     statut NEUTRALISÉE (règle projet « exclure crash/NSFW » +
     lib/hacktools.js) — AUCUNE fonctionnalité associée.
   · 03 API RÉPARÉES : commandes réelles portées (lib/hacktools.js).
   · 04 HACKTOOLS : métadonnées d'accès (mot de passe .env).
   Navigation identique au sous-menu GROUPE (chiffres) + accès
   owner / non-owner strictement distinct (2A vs 2B).
   Source des listes de commandes : HACK_SECTIONS (= lib/hacktools.js
   GROUPES) — une SEULE source, zéro doublon.
   ════════════════════════════════════════════════════════════ */

/* Barre de risque : █ plein + ░ vide (10 cases) — glyphes hors G4 */
const riskBar = (n, total = 10) => `${'█'.repeat(n)}${'░'.repeat(Math.max(0, total - n))}`;

/* Item ARCHIVES : ┊ 𝟶𝟷 ⟩⟩ emoji .cmd — desc (chiffres gras, comme GROUPE) */
const archivesItem = (n, label) => `┊ ${toUnicode(String(n).padStart(2, '0'))} ⟩⟩ ${label}`;

/* Métadonnées d'affichage des 4 sections (les COMMANDES viennent de HACK_SECTIONS) */
const ARCHIVES = {
  anti: {
    frame: '⚠️', emoji: '🔴', label: 'ARMES ANTI-COMPTE', statut: 'NEUTRALISÉE',
    risk: 8, riskLabel: 'CRITIQUE',
    raison: 'Fait planter l’app d’autrui',
    ban: 'Ton compte sera le premier banni',
    listTitle: 'COMMANDES BLOQUÉES', mark: '⛔', gi: 0,
  },
  nsfw: {
    frame: '⚠️', emoji: '🔴', label: 'CONTENU ADULTE / VULGAIRE', statut: 'NEUTRALISÉE',
    risk: 9, riskLabel: 'TRÈS ÉLEVÉ',
    raison: 'Contenu réservé aux adultes',
    ban: 'Bannissement quasi certain',
    extra: '🚫 MINEURS : INTERDIT',
    listTitle: 'COMMANDES BLOQUÉES', mark: '⛔', gi: 1,
  },
  api: {
    frame: '✅', emoji: '🟢', label: 'COMMANDES API RÉPARÉES', statut: 'PORTÉES ET FONCTIONNELLES',
    note: ['🔑 TOUTES DANS .ENV (RIEN EN DUR)', 'AUCUNE CLÉ TIERCE EXPOSÉE'],
    listTitle: 'COMMANDES ACTIVES', mark: '✅',
  },
  hack: {
    frame: '🔒', emoji: '🔒', label: 'HACKTOOLS', statut: 'OWNER UNIQUEMENT', metaOnly: true,
  },
};

/* Rendu 01/02 : NEUTRALISÉE — barre de risque + raison + liste ⛔ */
function renderNeutral(s) {
  const grp = HACK_SECTIONS[s.gi]; // liste de commandes (source unique)
  const header = buildFrame(`${s.frame} ${s.label}`, [
    bullet('STATUT', `${s.emoji} ${s.statut}`),
    bullet('RISQUE', `${riskBar(s.risk)} ${s.riskLabel}`),
    bullet('RAISON', s.raison),
    bullet('BAN', s.ban),
    s.extra ? bullet('NOTE', s.extra) : null,
    title(toUnicode('REPLY WITH A NUMBER')),
  ].filter(Boolean));
  const items = grp.items.map(([name, desc], i) =>
    archivesItem(i + 1, `${s.mark} ${toUnicode('.' + name.toUpperCase())} — ${desc}`));
  const listBlock = [listHeader(s.listTitle), ...items, frameFooter()].join('\n');
  return `${header}\n\n${listBlock}\n\n${archivesItem(0, `⬅️ ${toUnicode('RETOUR')}`)}\n\n${signatureBox()}`;
}

/* Rendu 03 : API RÉPARÉES — 2 lignes par commande (nom + desc · 🔑 clé) */
const API_ROWS = [
  ['imdb', '🎬', 'Film : note, casting, synopsis', 'OMDB_API_KEY'],
  ['stickersearch', '🔎', 'Recherche de GIF', 'TENOR_API_KEY'],
  ['paste', '📝', 'Texte → page Telegraph', 'JETON AUTO'],
  ['technews', '📰', 'Actu tech', 'API TIERCE'],
  ['emomix', '🫂', 'Mélange de 2 emojis', 'API TIERCE'],
  ['videodoc', '🎞️', 'Vidéo → document', 'APIS TIERCES'],
];
function renderApi(s) {
  const header = buildFrame(`${s.frame} ${s.label}`, [
    bullet('STATUT', `${s.emoji} ${s.statut}`),
    ...s.note.map((n) => bullet('INFO', n)),
    title(toUnicode('REPLY WITH A NUMBER')),
  ]);
  const items = API_ROWS.flatMap(([name, icon, desc, key], i) => [
    archivesItem(i + 1, `${icon} ${toUnicode('.' + name.toUpperCase())}`),
    `       ⤷ ${desc} · 🔑 ${key}`,
  ]);
  const listBlock = [listHeader(s.listTitle), ...items, frameFooter()].join('\n');
  return `${header}\n\n${listBlock}\n\n${archivesItem(0, `⬅️ ${toUnicode('RETOUR')}`)}\n\n${signatureBox()}`;
}

/* Rendu 04 : HACKTOOLS — métadonnées d'accès uniquement (aucune commande) */
function renderHack(s) {
  const header = buildFrame(`${s.frame} ${s.label}`, [
    bullet('STATUT', `🔒 ${s.statut}`),
    bullet('ENTRÉE', `${config.prefix}hacktools <mot de passe>`),
    bullet('ACCÈS', '👑 PROPRIÉTAIRE UNIQUEMENT'),
    bullet('SESSION', '⏱ 10 MINUTES D’INACTIVITÉ'),
    bullet('MOT DE PASSE', String(process.env.HACKTOOLS_PASSWORD || '').trim() ? '🔑 DÉFINI DANS .ENV (HACHÉ)' : '⚠️ NON DÉFINI — SECTION DÉSACTIVÉE'),
    bullet('VISIBILITÉ', '🙈 AUCUN MENU POUR LES NON-OWNERS'),
    title(toUnicode('REPLY WITH A NUMBER')),
  ]);
  return `${header}\n\n${archivesItem(0, `⬅️ ${toUnicode('RETOUR')}`)}\n\n${signatureBox()}`;
}

/* Sous-menu ARCHIVES : 2B (owner, 4 sections) vs 2A (non-owner, seule l'API) */
function renderArchives(base) {
  const isOwner = !!base?.isOwner;
  const keys = isOwner ? ['anti', 'nsfw', 'api', 'hack'] : ['api'];
  const header = buildFrame('ARCHIVES', [
    bullet('ACCÈS', isOwner ? '👑 PROPRIÉTAIRE' : '⚠️ CONTENU SENSIBLE'),
    isOwner ? bullet('VISIBLE', '4 SECTIONS') : null,
    isOwner ? bullet('NOTE', '🔴 3 DANGEREUSES · 🟢 1 ACTIVE') : null,
    title(toUnicode('REPLY WITH A NUMBER')),
  ].filter(Boolean));
  const items = keys.map((k, i) => archivesItem(i + 1, `${ARCHIVES[k].emoji} ${toUnicode(ARCHIVES[k].label)}`));
  const listBlock = [catBox('🔐', 'SECTIONS', toUnicode(String(keys.length))), ...items, frameFooter()].join('\n');
  return `${header}\n\n${listBlock}\n\n${archivesItem(0, `⬅️ ${toUnicode('RETOUR')}`)}\n\n${signatureBox()}`;
}

/* Écran de section détaillé (dispatch anti | nsfw | api | hack) */
function renderArchiveSection(base, key) {
  const s = ARCHIVES[key];
  if (s.metaOnly) return renderHack(s);
  if (s.twoLine || key === 'api') return renderApi(s);
  return renderNeutral(s);
}

/* État du menu par chat : { cat: 0|1..12, ts } — TTL 5 minutes */
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
  path.join(P.ASSETS, 'menu.jpg'),
  path.join(P.ASSETS, 'menu.png'),
  path.join(P.ASSETS, 'bot.jpg'),
  path.join(P.ASSETS, 'bot.png'),
];

let _menuImgCache = null;
let _menuImgTs = 0;

async function getMenuImageBuffer() {
  // Cache 5 min — la photo aléatoire tourne donc régulièrement
  if (_menuImgCache && Date.now() - _menuImgTs < 5 * 60 * 1000) return _menuImgCache;

  /* ── Mode random (défaut) : photo aléatoire qui change avec le
        menu. Échec API/réseau → repli local → bannière : jamais
        d'erreur au destinataire. ── */
  if (config.menuPictureMode === 'random') {
    try {
      const photo = await fetchRandomMenuPhoto();
      _menuImgCache = photo;
      _menuImgTs = Date.now();
      console.log(`[MENU] Photo aléatoire du menu actualisée (${photo.length} octets).`);
      return _menuImgCache;
    } catch (e) {
      console.error('[MENU] Photo aléatoire indisponible, repli local:', e.message);
    }
  }

  /* Mode off : bannière générée uniquement. */
  if (config.menuPictureMode !== 'off') {
    const localPaths = config.menuPicturePath
      ? [path.resolve(P.ROOT, config.menuPicturePath), ...MENU_IMG_PATHS]
      : MENU_IMG_PATHS;
    for (const p of localPaths) {
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

/* ── COMMUTATEUR QR / PAIRING (option B) ──────────────────────
   Réécrit UNIQUEMENT CONNECT_METHOD et PAIRING_PHONE dans .env :
   toutes les autres lignes (secrets, tokens…) sont recopiées telles
   quelles. Écriture atomique via .tmp + rename : un process tué au
   milieu ne laisse jamais un .env tronqué (le bot ne redémarrerait
   plus). */
const ENV_PATH = path.resolve(process.env.ENV_FILE || path.join(P.ROOT, '.env'));
function persistConnectMethod(method, phone) {
  let lines = [];
  try { lines = fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/); } catch { /* .env absent : on le crée */ }
  const setVar = (key, val) => {
    const re = new RegExp(`^${key}=`);
    const idx = lines.findIndex((l) => re.test(l));
    if (idx >= 0) lines[idx] = `${key}=${val}`;
    else lines.push(`${key}=${val}`);
  };
  setVar('CONNECT_METHOD', method);
  setVar('PAIRING_PHONE', phone || '');
  const tmp = `${ENV_PATH}.tmp`;
  fs.writeFileSync(tmp, lines.join('\n'), 'utf8');
  fs.renameSync(tmp, ENV_PATH);

  /* synchronise la mémoire : config.js lit .env UNE fois au require */
  config.connectMethod = method;
  config.pairingPhone = phone || '';
  process.env.CONNECT_METHOD = method;
  process.env.PAIRING_PHONE = phone || '';
}

const ENV_COMMANDES = {
  get CATEGORIES() { return CATEGORIES; },
  get MSG_NO_KEY() { return MSG_NO_KEY; },
  get P() { return P; },
  get QRCode() { return QRCode; },
  get Sticker() { return Sticker; },
  get StickerTypes() { return StickerTypes; },
  get aiUserMessage() { return aiUserMessage; },
  get askAI() { return askAI; },
  get auth() { return auth; },
  get autoStatus() { return autoStatus; },
  get blank() { return blank; },
  get buildFrame() { return buildFrame; },
  get bullet() { return bullet; },
  get catBox() { return catBox; },
  get ciblesAccept() { return ciblesAccept; },
  get cmd() { return cmd; },
  get commands() { return commands; },
  get config() { return config; },
  get conflict() { return conflict; },
  get ctxInfo() { return ctxInfo; },
  get downloadFrom() { return downloadFrom; },
  get downloadVV() { return downloadVV; },
  get dureeAccept() { return dureeAccept; },
  get findOnceTarget() { return findOnceTarget; },
  get fmtTs() { return fmtTs; },
  get formatDuration() { return formatDuration; },
  get frameFooter() { return frameFooter; },
  get fs() { return fs; },
  get getCache() { return getCache; },
  get getCachedChats() { return getCachedChats; },
  get getGroup() { return getGroup; },
  get getUser() { return getUser; },
  get groupMeta() { return groupMeta; },
  get guardDb() { return guardDb; },
  get guardSanctions() { return guardSanctions; },
  get hasAIKey() { return hasAIKey; },
  get history() { return history; },
  get inData() { return inData; },
  get isOwnerJid() { return isOwnerJid; },
  get isPrimaryOwner() { return isPrimaryOwner; },
  get isSudoNumber() { return isSudoNumber; },
  get localDb() { return localDb; },
  get math() { return math; },
  get mediaInfo() { return mediaInfo; },
  get noSqlite() { return noSqlite; },
  get note() { return note; },
  get num() { return num; },
  get numItem() { return numItem; },
  get onceMediaInfo() { return onceMediaInfo; },
  get parseEphemeral() { return parseEphemeral; },
  get parseFrDate() { return parseFrDate; },
  get participantsUpdate() { return participantsUpdate; },
  get path() { return path; },
  get persistConnectMethod() { return persistConnectMethod; },
  get quotedKey() { return quotedKey; },
  get renderArchiveSection() { return renderArchiveSection; },
  get renderArchives() { return renderArchives; },
  get renderInfo() { return renderInfo; },
  get renderMainMenu() { return renderMainMenu; },
  get renderSuccess() { return renderSuccess; },
  get row() { return row; },
  get saveState() { return saveState; },
  get send() { return send; },
  get sendMenu() { return sendMenu; },
  get sendRecovered() { return sendRecovered; },
  get setMenu() { return setMenu; },
  get sharp() { return sharp; },
  get shortChat() { return shortChat; },
  get signature() { return signature; },
  get state() { return state; },
  get targetFrom() { return targetFrom; },
  get textOf() { return textOf; },
  get title() { return title; },
  get toAudioBuffer() { return toAudioBuffer; },
  get toUnicode() { return toUnicode; },
  get translate() { return translate; },
  get unwrap() { return unwrap; },
  get useSqlite() { return useSqlite; },
  get visibleCommands() { return visibleCommands; },
  get waStats() { return waStats; },
  get withNetworkTimeout() { return withNetworkTimeout; },
  get ytDownloadAudio() { return ytDownloadAudio; },
  get ytDownloadVideo() { return ytDownloadVideo; },
  get ytFail() { return ytFail; },
  get ytResolve() { return ytResolve; },
  get yts() { return yts; },
};
chargerCommandes(ENV_COMMANDES, ["01-general/menu-maison.js","12-archives/archives.js","10-divers/repo.js","10-divers/support.js","06-ia/ia.js"]);

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
    const dir = P.ASSETS;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'menu.jpg'), out);
    _menuImgCache = out;
    _menuImgTs = Date.now();
    await ctx.success(['IMAGE MENU ENREGISTRÉE', `${Math.round(out.length / 1024)} KO`, 'RELANCER .MENU POUR VOIR']);
  } catch (e) {
    await ctx.error(['SETMENUIMG', e.message]);
  }
});


chargerCommandes(ENV_COMMANDES, ["01-general/ping.js","01-general/info.js","01-general/diag.js"]);

/* ── Requêtes sur la base locale (option E) ──────────────────────── */
const fmtTs = (ts) => {
  const d = new Date(Number(ts) || Date.now());
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const shortChat = (j) => (!j ? '—' : (j.endsWith('@g.us') ? j : `+${num(j)}`));
const noSqlite = () => ['BASE SQLite INDISPONIBLE', 'NODE ≥ 22.5 REQUIS', 'LES FONCTIONS CLASSIQUES MARCHENT'];

chargerCommandes(ENV_COMMANDES, ["09-owner/journal.js","09-owner/chatlog.js","01-general/uptime-maison.js","01-general/owner-maison.js","01-general/source.js","01-general/list.js"]);

/* ── 2. GROUPE ────────────────────────────────────────────── */

function targetFrom(ctx) {
  const ci = ctxInfo(ctx.content);
  if (ci?.mentionedJid?.length) return ci.mentionedJid[0];
  if (ci?.participant) return ci.participant;
  const raw = (ctx.q || '').match(/\d{5,}/);
  if (raw) return `${raw[0]}@s.whatsapp.net`;
  return null;
}

/* Toutes les cibles d'un coup : mentions multiples (bulk), sinon repli
   1-cible (réponse citée / numéro tapé) — dédupliquées. */
function targetsFrom(ctx) {
  const ci = ctxInfo(ctx.content);
  if (ci?.mentionedJid?.length) return [...new Set(ci.mentionedJid.filter(Boolean))];
  if (ci?.participant) return [ci.participant];
  const raw = (ctx.q || '').match(/\d{5,}/);
  return raw ? [`${raw[0]}@s.whatsapp.net`] : [];
}

/* Actions sur membres (kick / promote / demote) — BULK (N mentions).
   .kick protège les admins : jamais expulsés, sauf si l'auteur est owner. */
async function participantsUpdate(ctx, action, label) {
  const targets = targetsFrom(ctx);
  if (!targets.length) return ctx.reply(`❌ Mentionne la personne : ${config.prefix}${action} @user`);
  const meta = await groupMeta(ctx.sock, ctx.from);

  const kickMode = label === 'remove';
  const canKickAdmins = !!ctx.isOwner;
  const toUpdate = [];
  let skippedAdmins = 0;
  for (const t of targets) {
    const p = findParticipant(meta, t);
    const id = (p && p.id) || t;
    const isAdmin = !!p && (p.admin === 'admin' || p.admin === 'superadmin');
    if (kickMode && isAdmin && !canKickAdmins) { skippedAdmins += 1; continue; }
    toUpdate.push(id);
  }

  if (!toUpdate.length) {
    return ctx.reply(`⚠️ ${skippedAdmins} admin${skippedAdmins > 1 ? 's' : ''} ignoré${skippedAdmins > 1 ? 's' : ''} — impossible d'expulser un admin.`);
  }

  try {
    await ctx.sock.groupParticipantsUpdate(ctx.from, toUpdate, label);
    await ctx.react('✅');
    const n = toUpdate.length;
    const pl = n > 1 ? 's' : '';
    if (kickMode) {
      // Message conditionnel : la mention des admins ignorés n'apparaît que si > 0.
      const sk = skippedAdmins;
      const skPart = sk ? ` ${sk} admin${sk > 1 ? 's' : ''} ignoré${sk > 1 ? 's' : ''}.` : '';
      await ctx.reply(`🦵 ${n} utilisateur${pl} expulsé${pl}.${skPart}`);
    } else if (label === 'promote') {
      await ctx.reply(`✅ ${n} utilisateur${pl} promu${pl} admin${pl}`);
    } else {
      await ctx.reply(`✅ ${n} utilisateur${pl} rétrogradé${pl}`);
    }
  } catch (e) {
    await ctx.reply(`❌ Échec : ${e.message}`);
  }
}

chargerCommandes(ENV_COMMANDES, ["02-groupe/kick.js","02-groupe/promote-maison.js","02-groupe/demote.js","02-groupe/tagall-maison.js","02-groupe/hidetag-maison.js","02-groupe/groupinfo-maison.js","02-groupe/setname.js","02-groupe/setdesc.js","02-groupe/open.js","02-groupe/close.js","02-groupe/link.js","02-groupe/revoke.js","02-groupe/poll.js"]);

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
chargerCommandes(ENV_COMMANDES, ["03-protection/warn.js","03-protection/unwarn.js","03-protection/warnings.js","03-protection/blacklist.js","03-protection/unblacklist.js"]);

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
guardCmd('security', { cat: 3, desc: 'Toutes les protections on/off', usage: 'security on|off', group: true, admin: true, icon: '🛡️' });
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

chargerCommandes(ENV_COMMANDES, ["04-sticker-media/sticker.js","04-sticker-media/take.js","04-sticker-media/toimg.js","04-sticker-media/toaudio-maison.js","04-sticker-media/viewonce-maison.js","04-sticker-media/vv.js","04-sticker-media/autonce.js","05-outils/translate.js","05-outils/calc.js","05-outils/qr.js","05-outils/base64.js","05-outils/binary.js","05-outils/weather.js","06-ia/ai-maison.js","06-ia/summarize-maison.js","06-ia/analyse.js","07-fun/8ball-maison.js","07-fun/choose.js","07-fun/roll.js","07-fun/coin.js","07-fun/ship-maison.js","07-fun/rate.js","07-fun/joke-maison.js","08-recherche/wiki.js","08-recherche/github.js","08-recherche/convert.js","09-owner/self.js","09-owner/public.js","09-owner/autoview.js","09-owner/autolike.js","09-owner/autostatus.js","09-owner/broadcast.js","09-owner/join.js","09-owner/leave.js","09-owner/block.js","09-owner/unblock.js","09-owner/statut.js","05-outils/location.js","10-divers/vcard.js","10-divers/event.js","09-owner/derniers.js","10-divers/afk.js","10-divers/level.js","10-divers/report.js","10-divers/stats.js"]);

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

chargerCommandes(ENV_COMMANDES, ["05-outils/edit.js","02-groupe/pin.js","02-groupe/unpin.js","02-groupe/disappear.js","09-owner/mutechat.js","09-owner/unmutechat.js","09-owner/archive.js","09-owner/setpp.js","09-owner/setbotname.js","09-owner/setbio-maison.js","05-outils/react.js","05-outils/del.js","09-owner/read.js"]);



/* ── AUTORISATIONS OWNER / SUDO (pas tout le monde owner) ── */
/* ══ MODULE 1 — .accept : autorisation d'utiliser le bot ════════════
   .accept @user1 @user2 [30m|24h|7d|permanent] → accord (défaut : permanent)
   .unaccept @user|numéro                        → révocation
   .accepted                                     → liste + expirations
   Toutes en owner : seul le propriétaire ouvre l'accès. */
const DUREES_ACCEPT = { m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };

function ciblesAccept(ctx) {
  const ci = ctxInfo(ctx.content);
  const set = new Set((ci?.mentionedJid || []).map((j) => num(j)).filter(Boolean));
  for (const a of ctx.args || []) {
    const d = String(a).replace(/\D/g, '');
    if (d.length >= 8) set.add(d); // numéro tapé en dur (« @2376… » inclus)
  }
  return [...set];
}

function dureeAccept(ctx) {
  const dernier = String(ctx.args?.[ctx.args.length - 1] || '').toLowerCase();
  const m = dernier.match(/^(\d{1,5})(m|h|d)$/);
  if (m) return parseInt(m[1], 10) * DUREES_ACCEPT[m[2]];
  return null; // permanent par défaut (« permanent »/«jamais» acceptés aussi)
}

chargerCommandes(ENV_COMMANDES, ["09-owner/accept.js","09-owner/unaccept.js","09-owner/accepted.js","09-owner/unpause.js","09-owner/conflicts.js","09-owner/sudo.js","09-owner/authcode.js","01-general/claim.js"]);

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
  /* ── Portées de TEDDY-XMD : auto & présence ── */
  registerPortedAuto(cmd, {
    config,
    send,
    saveState,
    getSettings: () => state.settings.portedAuto || {},
    setSettings: (s) => { state.settings.portedAuto = s; },
    downloadFrom,
    mediaInfo,
    buildFrame,
    bullet,
  });
  /* ── Portées de TEDDY-XMD : groupe (anti-bot, cron, tagadmin) ── */
  portedGroup.registerPortedGroup(cmd, {
    config,
    send,
    saveState,
    getSettings: () => state.settings.portedGroup || {},
    setSettings: (s) => { state.settings.portedGroup = s; },
    buildFrame,
    bullet,
  });
  /* ── Portées de TEDDY-XMD : édition audio/vidéo ── */
  portedAudio.registerPortedAudio(cmd, {
    config,
    mediaInfo,
    downloadFrom,
    send,
    buildFrame,
    bullet,
  });
  /* ── Portées de TEDDY-XMD : animations & réactions anime ── */
  portedFun.registerPortedFun(cmd, { config, send });
  /* ── Portées de TEDDY-XMD : logos (23 effets) & lookups ── */
  registerPortedLogo(cmd, { config, send, buildFrame, bullet });
  registerPortedLookup(cmd, { config, send, buildFrame, bullet });
  /* ── Portée de TEDDY-XMD : capture d'écran web ── */
  registerPortedShot(cmd, { config, send });
  /* ── Portées de TEDDY-XMD : football live (36) ── */
  registerPortedFoot(cmd, { config, send, buildFrame, bullet });
  /* ── Section HACKTOOLS : hors menu, mot de passe requis ── */
  registerHackTools(cmd, { config, send, buildFrame, bullet, note });
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

/* ── PLUGINS TIERS — commandes/, adaptés au registre DJOUSE ── */
try {
  const rap = loadCorePlugins(cmd, {
    config, send,
    exists: (n) => commands.has(String(n).toLowerCase()),
    /* styles DJOUSE injectés : les messages d'erreur/succès des plugins
       tiers sont réencadrés dans NOTRE charte (renderError/renderSuccess),
       et toute marque tierce résiduelle est réécrite en identité maison. */
    style: { renderError, renderSuccess, botName: config.botName },
    /* Téléchargement de médias fourni aux plugins qui le déstructurent
       (`const { download } = ctx`). Accepte un WAMessage complet ou un
       nœud média (imageMessage, videoMessage…). */
    download: (m, type) => {
      const cle = type ? `${type}Message` : null;
      const cible = (m && m.message) ? m
        : (cle && m && m.mimetype) ? { key: {}, message: { [cle]: m } }
          : m;
      return downloadMediaMessage(cible, 'buffer', {}, {});
    },
  });
  console.log(`[CORE] ${rap.charges} plugins chargés · ${rap.commandes} commandes/alias enregistrés · ${rap.ignores} ignorés`);
  if (rap.echecs.length) {
    console.log(`[CORE] ${rap.echecs.length} fichier(s) ignoré(s) :`);
    for (const e of rap.echecs.slice(0, 15)) console.log(`   - ${e}`);
    if (rap.echecs.length > 15) console.log(`   … et ${rap.echecs.length - 15} autres`);
  }
} catch (e) {
  console.error('[CORE] chargement interrompu:', e.message);
}

appliquerTables(commands);

/* ── 11. TÉLÉCHARGEMENT ───────────────────────────────────── */

const YT_URL_RE = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/;

/* ── yt-dlp : moteur de téléchargement (auto-installé dans vendor/) ──
   @distube/ytdl-core ne sait plus déchiffrer le player YouTube actuel
   (« Could not parse decipher function ») : on s'appuie sur yt-dlp, le
   standard maintenu, plus ffmpeg (embarqué via ffmpeg-static). */

const YTDLP_BIN = path.join(P.BIN, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
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
    const v = await withNetworkTimeout(
      () => yts({ videoId: m[1] }),
      20000,
      'Recherche YouTube'
    );
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
  const r = await withNetworkTimeout(
    () => yts(query),
    20000,
    'Recherche YouTube'
  );
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
         '-crf', '28', '-c:a', 'aac', '-b:a', '96k', '-movflags', 'frag_keyframe+empty_moov', '-f', 'mp4', 'pipe:1'],
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

chargerCommandes(ENV_COMMANDES, ["11-telechargement/yt-maison.js","11-telechargement/play.js","11-telechargement/video.js"]);

/* ════════════════════════════════════════════════════════════
   5. EXÉCUTION DES COMMANDES
   ════════════════════════════════════════════════════════════ */

/* ── LUDO : module externe (dossier ludo/ + plugins/ludo.js) ────────────
   Le moteur (règles, salons, rendu PNG) est dans ludo/src et n'a aucune
   dépendance à handler.js — seules les 3 commandes sont branchées ici.
   try/catch : un module absent ou une dépendance manquante (canvas) ne
   doit jamais empêcher le bot de démarrer. ── */
const loadedPlugins = [];
try {
  require('../plugins/ludo')(cmd, commands);
  loadedPlugins.push('ludo');
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
    /* Nom de commande INVOQUÉ (sans préfixe, en minuscules).
       Les plugins tiers dispatchent dessus (`ctx.command`) : sans cette
       clé, tous leurs `if (command === 'x')` restaient faux et ils
       se terminaient sans envoyer MOINDRE message (constaté sur
       .newsletter, .setgreet, .setbgm, .rules — silencieux). */
    command: String(name).toLowerCase(),
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

  /* ── MODULE 1 : GATE D'ACCÈS STRICT ─────────────────────────────
     Ni owner, ni sudo, ni « accepted » (.accept) → AUCUNE commande.
     Les protections de groupe (guard/) passent AVANT ce point. */
  const access = commandAccess(entry, {
    isOwner: ctx.isOwner,
    fromMe: !!msg.key.fromMe,
    isGroup: ctx.isGroup,
    isAdmin: ctx.isAdmin,
    isBotAdmin: ctx.isBotAdmin,
  }, {
    selfMode: config.selfMode || state.settings.selfMode,
    publicMode: config.publicMode,
    canRun: () => auth.canRun(ctx.sender),
  });
  if (!access.allowed) {
    if (access.silent) return true;
    if (access.reason === 'PRIVATE') {
      if (auth.shouldNotifyGate(ctx.sender)) {
        await ctx.error([
          'ACCÈS RESTREINT',
          'CE BOT EST PRIVÉ — OWNER OU ACCEPTÉS UNIQUEMENT',
          'DEMANDE L’ACCÈS AU PROPRIÉTAIRE DU BOT',
        ]);
      }
      return true;
    }
    if (access.reason === 'OWNER') return ctx.error([config.messages.ownerOnly.toUpperCase()]), true;
    if (access.reason === 'GROUP') return ctx.error([config.messages.groupOnly.toUpperCase()]), true;
    if (access.reason === 'ADMIN') return ctx.error([config.messages.adminOnly.toUpperCase()]), true;
    if (access.reason === 'BOT_ADMIN') return ctx.error([config.messages.botAdminNeeded.toUpperCase()]), true;
  }

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
    /* Cat.12 ARCHIVES : catalogue déclaratif, pas de commands */
    if (n === 12) {
      setMenu(chat, 12);
      await sendMenu(sock, chat, renderArchives(base), msg);
      return true;
    }
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
    /* Cat.2 GROUPE : rendu statique en 9 sections (catalogue 89) ;
       les autres catégories gardent le rendu dynamique. */
    await sendMenu(sock, chat, hit.n === 2 ? renderGroupMenu() : renderCategory(hit.n, base), msg);
    return true;
  }

  /* Cat.12 ARCHIVES : sous-navigation par section */
  if (st.cat === 12) {
    const isOwner = !!base.isOwner;
    const map = isOwner ? { 1: 'anti', 2: 'nsfw', 3: 'api', 4: 'hack' } : { 1: 'api' };
    const which = map[n];
    if (!which) {
      const restricted = !isOwner && n >= 2 && n <= 4;
      await send(sock, chat, {
        text: restricted
          ? renderError(['SECTION RÉSERVÉE AU PROPRIÉTAIRE'])
          : renderError([`CHIFFRE INVALIDE (1-${Object.keys(map).length})`, 'REPONDEZ 0 POUR LE MENU PRINCIPAL']),
      }, { quoted: msg });
      return true;
    }
    setMenu(chat, 12);
    await sendMenu(sock, chat, renderArchiveSection(base, which), msg);
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

/* Moteur STATUTS (stories) — pont vers lib/auto-status.js :
   vue via sendReceipt, réaction avec statusJidList (sinon WhatsApp
   l'avale), réponse DM citée. Overrides runtime : .autoview/.autolike
   persistés dans state.settings.autoStatus. */
async function handleStatus(sock, msg) {
  await autoStatus.handleStatus(sock, msg, state.settings.portedAuto?.status || state.settings.autoStatus || {});
  /* porté TEDDY : sauvegarde des médias de statuts si activée */
  if (autoSettings(state.settings.portedAuto).autodlstatus) {
    await autoOnStatus({
      sock, msg, settings: state.settings.portedAuto,
      mediaInfo, downloadFrom,
    }).catch((e) => console.error('[AUTO] statut:', e.message));
  }
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
    /* Numéro réel du participant quand WhatsApp présente un @lid :
       participantPn est le champ OFFICIEL Baileys 6.7 (participantAlt et
       senderPn ne sont que des replis de forks — cf. lib/auto-status.js).
       Sans participantPn, l'owner était méconnu en @lid : en chat en
       pause, .unpause / .menu étaient ignorés. */
    const senderAlt = msg.key.participantPn || msg.key.participantAlt || msg.key.senderPn || null;

    /* ── MODULE 2 : observation du conflit bot↔bot ──────────────────
       AVANT le filtre d'échos ci-dessous : on doit voir aussi nos
       propres réponses (fromMe) pour compter les allers-retours. */
    const conflit = conflict.observe({
      chat: from,
      text,
      fromMe,
      owner: fromMe || auth.isOwner(senderNum) || auth.isSudo(senderNum),
    });
    if (conflit.first) avertirConflit(sock, msg, from, conflit.reason);

    // Ignore les échos de nos propres messages (sauf commandes owner testées en « moi-même »)
    if (fromMe && text && !text.startsWith(config.prefix)) {
      putCache(from, msg.key.id, msg);
      return;
    }

    state.stats.messages += 1;
    saveState();
    putCache(from, msg.key.id, msg);

    /* ── Porté TEDDY-XMD : présence & réponses auto ── */
    if (!fromMe) {
      await autoOnMessage({
        sock,
        from,
        sender,
        senderNum,
        isGroup,
        fromMe,
        isCommand: text.startsWith(config.prefix),
        isOwner: auth.isOwner(senderNum) || auth.isSudo(senderNum),
        knownSenders: new Set([...auth.listSudo?.() || [], ...auth.listOwners?.() || []]),
        settings: state.settings.portedAuto,
        msg,
      }).catch((e) => console.error('[AUTO] message:', e.message));
    }

    /* ── Historique SQLite : TOUS les messages, texte comme médias
         (requêtes via .chatlog). Une panne de la base ne doit jamais
         empêcher le message d'être traité. ── */
    localDb.logMessage({
      chat: from,
      sender: senderNum,
      kind: text ? 'text'
        : String(Object.keys(content || {})[0] || 'media').replace(/Message$/, ''),
      len: (text || '').length,
      text,
    });

    /* ── Auto-réaction aux messages entrants (flag AUTO_REACT) ── */
    if (
      config.autoReact &&
      !conflict.isPaused(from) &&
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
        (senderNum && (auth.isOwner(senderNum) || auth.isSudo(senderNum))),
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
      /* ── MODULE 2 : participant marqué isBot par le serveur WhatsApp
            (champ hors types Baileys, parfois présent) → conflit ── */
      if (conflict.hasBotParticipant(meta, botNum)) {
        const hit = conflict.markPaused(from, 'participant-isbot');
        if (hit.first) avertirConflit(sock, msg, from, hit.reason);
      }
    }

    /* ── PROTECTIONS DE GROUPE
          Les commandes (préfixe) passent TOUJOURS : on ne laisse pas le guard
          « avaler » .menu / .ping avant le moteur de commandes. ── */
    const isCommandText = !!(text && text.startsWith(config.prefix));
    if (isGroup && !fromMe && !isCommandText) {
      if (await runGroupProtections(sock, msg, base, text, meta)) return;
    }

    /* ── MODULE 2 : chat EN PAUSE (conflit bot↔bot) — OWNER EXCEPTÉ
          (il garde la main pour diagnostiquer et lancer .unpause).
          Les protections ci-dessus continuent de s'appliquer. ── */
    if (conflict.isPaused(from) && !base.isOwner) return;

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
      await autoSaveOnce(sock, msg, from, sender);
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
      localDb.logEvent({ type: 'cmd', chat: from, actor: senderNum, detail: cmdName });
    } catch (e) {
      console.error(`[CMD] ÉCHEC ${cmdName}:`, e.message);
      localDb.logEvent({ type: 'error', chat: from, actor: senderNum, detail: `${cmdName}: ${e.message}` });
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

    /* Journal SQLite : entrées/sorties/rôles, lisible via .journal */
    localDb.logEvent({
      type: action === 'add' ? 'join' : action === 'remove' ? 'leave' : action,
      chat: id,
      actor: author,
      detail: participants.map((p) => `+${num(p)}`).join(', '),
    });

    /* Anti-fake (guard) : expulse les indicatifs non autorisés AVANT le message de bienvenue */
    if (action === 'add') {
      const fakes = await guardEvents.enforceAntiFake(sock, { id, participants, action });
      if (fakes.length) {
        participants = participants.filter((p) => !fakes.includes(p));
        if (!participants.length) return;
      }
    }

    /* Porté TEDDY-XMD : anti-bot (expulsion/avertissement des bots qui entrent) */
    if (action === 'add') {
      try {
        const n = await portedGroup.onParticipantAdd(sock, id, participants, state.settings.portedGroup);
        if (n) console.log(`[ANTIBOT] ${n} bot(s) traité(s) dans ${id}`);
      } catch (e) { console.error('[ANTIBOT]', e.message); }
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

appliquerFamilles(commands);

/* ── FILTRE GLOBAL « SERVICE MORT » ──────────────────────────────
   Le chargeur de plugins applique déjà isDisabled() aux plugins tiers ;
   ce balayage couvre les commandes enregistrées ailleurs (lib/tools.js,
   hacktools…), sans quoi .quote/.citation restent joignables malgré leur
   entrée dans config/disabled-commands.js.
   ENABLE_DEAD_COMMANDS=1 neutralise l'ensemble. */
const _mortesRetirees = [];
for (const _cle of [...commands.keys()]) {
  if (commandeMorte(_cle)) { commands.delete(_cle); _mortesRetirees.push(_cle); }
}
if (_mortesRetirees.length) {
  console.log(`[REGISTRE] ${_mortesRetirees.length} commande(s) désactivée(s) (service mort): ${_mortesRetirees.join(', ')}`);
}

module.exports = {
  isSystemJid,
  handleMessage,
  handleGroupUpdate,
  handleGroupInfo,
  handleMessagesUpdate,
  commands,
  loadedPlugins,
  CATEGORIES,
  renderMainMenu,
  renderCategory,
  renderGroupMenu,
  renderArchives,
  renderArchiveSection,
  state,
  saveState,
  askAI,
  getMessageForBaileys,
  putCache,
  getCache,
  getScheduler,
  getStore,
  mediaInfo,
  // Porté TEDDY-XMD : présence & réponses auto
  autoSettings,
  startOnlineTimer: autoStartTimer,
  stopOnlineTimer: require('../lib/ported-auto').stopOnlineTimer,
  // Commutateur QR/Pairing : utilisé par .menu qr|pairing
  persistConnectMethod,
};
