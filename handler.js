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
const { downloadMediaMessage } = require('@itsukichan/baileys');
// ATTENTION : sharp DOIT être chargé AVANT wa-sticker-formatter.
// wsf embarque son propre sharp@0.30 (dossier imbriqué) : s'il est chargé en
// premier, ses DLL libvips entrent en conflit avec sharp@0.32 du projet →
// « procedure not found » au chargement du binaire natif.
const sharp = require('sharp');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const math = require('mathjs');
const QRCode = require('qrcode');
const { translate } = require('@vitalets/google-translate-api');
const yts = require('yt-search');
const https = require('https');
const ffmpegPath = require('ffmpeg-static');

/* ════════════════════════════════════════════════════════════
   1. ÉTAT PERSISTANT — session/state.json
   ════════════════════════════════════════════════════════════ */

const STATE_FILE = path.join(__dirname, config.sessionDir, 'state.json');

function defaultState() {
  return {
    settings: { selfMode: config.selfMode },
    groups: {},
    users: {},
    warns: {},
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
      warns: raw.warns || {},
      blacklist: Array.isArray(raw.blacklist) ? raw.blacklist : [],
    };
  } catch (e) {
    return defaultState();
  }
}

const state = loadState();
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

const num = (jid) => String(jid || '').split('@')[0].split(':')[0];
const isOwnerJid = (jid) => config.ownerNumber.includes(num(jid));

const escRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function unwrap(message) {
  let m = message || {};
  for (let i = 0; i < 5; i++) {
    const inner =
      m.ephemeralMessage?.message ||
      m.viewOnceMessage?.message ||
      m.viewOnceMessageV2?.message ||
      m.viewOnceMessageV2Extension?.message ||
      m.documentWithCaptionMessage?.message;
    if (!inner) break;
    m = inner;
  }
  return m;
}

function textOf(content) {
  if (!content) return '';
  return (
    content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    content.videoMessage?.caption ||
    content.documentMessage?.caption ||
    content.buttonsResponseMessage?.selectedDisplayText ||
    content.buttonsResponseMessage?.selectedButtonId ||
    content.listResponseMessage?.title ||
    content.listResponseMessage?.singleSelectReply?.selectedRowId ||
    content.templateButtonReplyMessage?.selectedDisplayText ||
    content.templateButtonReplyMessage?.selectedId ||
    ''
  );
}

function ctxInfo(content) {
  if (!content) return null;
  return (
    content.extendedTextMessage?.contextInfo ||
    content.imageMessage?.contextInfo ||
    content.videoMessage?.contextInfo ||
    content.documentMessage?.contextInfo ||
    content.stickerMessage?.contextInfo ||
    content.audioMessage?.contextInfo ||
    null
  );
}

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts = [];
  if (d) parts.push(`${d}j`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${sec}s`);
  return parts.join(' ');
}

const LINK_RE =
  /https?:\/\/|www\.|chat\.whatsapp\.com\/|wa\.me\/|t\.me\/|\b[a-z0-9-]+\.(?:com|net|org|io|me|xyz|link|app|site|online|shop|top|club|co|tv|fr)\b/i;

const BAD_WORDS = [
  'fuck', 'shit', 'bitch', 'asshole', 'motherfucker', 'nigga', 'nigger',
  'puta', 'enculeur', 'enculé', 'connard', 'connasse', 'salope', 'enculé',
  'fdp', 'ntm', 'tafiole', 'pédé', 'enculer', 'bite', 'pute',
];

/* Cache des messages (antidelete) : `${chat}|${id}` → message complet */
const msgCache = new Map();
function putCache(jid, id, msg) {
  if (!jid || !id) return;
  msgCache.set(`${jid}|${id}`, { msg, ts: Date.now() });
  if (msgCache.size > 400) {
    const oldest = msgCache.keys().next().value;
    msgCache.delete(oldest);
  }
}
function getCache(jid, id) {
  return msgCache.get(`${jid}|${id}`) || null;
}

/* Métadonnées de groupe en cache (60 s) */
const metaCache = new Map();
async function groupMeta(sock, jid) {
  const hit = metaCache.get(jid);
  if (hit && Date.now() - hit.ts < 60000) return hit.data;
  try {
    const data = await sock.groupMetadata(jid);
    metaCache.set(jid, { data, ts: Date.now() });
    return data;
  } catch (e) {
    return hit ? hit.data : null;
  }
}

function participantNumbers(p) {
  return [p.id, p.lid, p.phoneNumber, p.jid].filter(Boolean).map(num);
}

function findParticipant(meta, jid) {
  if (!meta?.participants) return null;
  const target = num(jid);
  return meta.participants.find((p) => participantNumbers(p).includes(target)) || null;
}

function isAdminIn(meta, jid) {
  const p = findParticipant(meta, jid);
  return p?.admin === 'admin' || p?.admin === 'superadmin';
}

function botIsAdmin(sock, meta) {
  if (!meta) return false;
  const refs = [sock.user?.id, sock.user?.lid].filter(Boolean);
  return refs.some((ref) => isAdminIn(meta, ref));
}

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

/* Cooldown des avertissements de protection (évite le spam) */
const guardCooldown = new Map();
function guardAllows(chat, who) {
  const key = `${chat}|${who}`;
  const now = Date.now();
  const last = guardCooldown.get(key) || 0;
  if (now - last < 5000) return false;
  guardCooldown.set(key, now);
  return true;
}

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

function streamToBuffer(stream, maxMB) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    stream.on('data', (c) => {
      size += c.length;
      if (size > maxMB * 1024 * 1024) {
        stream.destroy();
        reject(new Error(`Fichier trop volumineux (> ${maxMB} MB)`));
      } else chunks.push(c);
    });
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
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
    handler,
  };
  commands.set(entry.name, entry);
  for (const a of entry.aliases) commands.set(a, entry);
}

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

function categoryCommands(cat) {
  const seen = new Set();
  const list = [];
  for (const c of commands.values()) {
    if (c.cat !== cat || seen.has(c.name)) continue;
    seen.add(c.name);
    list.push(c);
  }
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

function renderMainMenu() {
  const lines = [
    `╭─────────────────────────────`,
    `│  *${config.botName} — MENU*`,
    `│  Préfixe : ${config.prefix}  ·  v${config.version}`,
    `│`,
  ];
  for (const c of CATEGORIES) {
    lines.push(`│  ${String(c.n).padStart(2, ' ')}. ${c.emoji} *${c.label}*`);
  }
  lines.push(`│`);
  lines.push(`│  Réponds avec un chiffre *1 à ${CATEGORIES.length}*`);
  lines.push(`│  🧠 Ou écris ton intention en clair :`);
  lines.push(`│  « télécharge … », « bienvenue à … », « météo à … »`);
  lines.push(`╰─────────────────────────────`);
  return lines.join('\n');
}

function renderCategory(catNum) {
  const cat = CATEGORIES.find((c) => c.n === catNum);
  const list = categoryCommands(catNum);
  const lines = [
    `╭─────────────────────────────`,
    `│  *${cat.emoji} ${cat.label}* (${list.length} commandes)`,
    `│`,
  ];
  list.forEach((c, i) => {
    const usage = c.usage ? ` — \`${config.prefix}${c.usage}\`` : '';
    lines.push(`│  ${String(i + 1).padStart(2, ' ')}. *.${c.name}* — ${c.desc}${usage}`);
  });
  lines.push(`│`);
  lines.push(`│  *0* — ↩️ Retour au menu`);
  lines.push(`│  Ou tape : ${config.prefix}nom`);
  lines.push(`╰─────────────────────────────`);
  return lines.join('\n');
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

/* ════════════════════════════════════════════════════════════
   4. DÉFINITION DES COMMANDES (~65)
   ════════════════════════════════════════════════════════════ */

/* ── 1. GÉNÉRAL ───────────────────────────────────────────── */

cmd('menu', { cat: 1, desc: 'Menu interactif par chiffres' }, async (ctx) => {
  setMenu(ctx.from, 0);
  await ctx.reply(renderMainMenu());
});

cmd('ping', { cat: 1, desc: 'Latence du bot' }, async (ctx) => {
  const latency = ctx.msg.messageTimestamp
    ? Date.now() - Number(ctx.msg.messageTimestamp) * 1000
    : 0;
  await ctx.reply(`🏓 Pong !\nLatence : ${Math.max(0, latency)} ms\nUptime : ${formatDuration(process.uptime() * 1000)}`);
});

cmd('info', { cat: 1, desc: 'Informations du bot' }, async (ctx) => {
  await ctx.reply(
    `╭─────────────────────────────\n` +
    `│  *${config.botName} — INFOS*\n│\n` +
    `│  Version : ${config.version}\n` +
    `│  Préfixe : ${config.prefix}\n` +
    `│  Owner : ${config.botOwnerName} (+${config.ownerNumber[0]})\n` +
    `│  Node : ${process.version}\n` +
    `│  Uptime : ${formatDuration(process.uptime() * 1000)}\n` +
    `│  Mode : ${state.settings.selfMode ? 'SELF (owner seul)' : 'PUBLIC'}\n` +
    `╰─────────────────────────────`
  );
});

cmd('uptime', { cat: 1, desc: 'Temps de fonctionnement' }, async (ctx) => {
  await ctx.reply(`⏱️ En ligne depuis ${formatDuration(process.uptime() * 1000)}`);
});

cmd('owner', { cat: 1, desc: 'Contacter le propriétaire' }, async (ctx) => {
  const n = config.ownerNumber[0];
  const vcard =
    `BEGIN:VCARD\nVERSION:3.0\nFN:${config.botOwnerName}\n` +
    `TEL;type=CELL;type=VOICE;waid=${n}:+${n}\nEND:VCARD`;
  await ctx.sock.sendMessage(ctx.from, {
    contacts: { displayName: config.botOwnerName, contacts: [{ vcard }] },
  }, { quoted: ctx.msg });
});

cmd('source', { cat: 1, desc: 'Code source du bot' }, async (ctx) => {
  await ctx.reply(`📂 Code source :\n${config.social.github}`);
});

cmd('list', { cat: 1, desc: 'Toutes les commandes' }, async (ctx) => {
  const lines = [`╭─────────────────────────────`, `│  *TOUTES LES COMMANDES*`, `│`];
  for (const cat of CATEGORIES) {
    const list = categoryCommands(cat.n);
    if (!list.length) continue;
    lines.push(`│  *${cat.emoji} ${cat.label}*`);
    lines.push(`│  ${list.map((c) => `.${c.name}`).join('  ')}`);
    lines.push(`│`);
  }
  lines.push(`╰─────────────────────────────`);
  await ctx.reply(lines.join('\n'));
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
  await ctx.sock.sendMessage(ctx.from, { text, mentions: ids }, { quoted: ctx.msg });
});

cmd('hidetag', { cat: 2, desc: 'Mention invisible', usage: 'hidetag [message]', group: true, admin: true }, async (ctx) => {
  const meta = await groupMeta(ctx.sock, ctx.from);
  const ids = meta.participants.map((p) => p.id).filter(Boolean);
  await ctx.sock.sendMessage(ctx.from, { text: ctx.q || '👋', mentions: ids }, { quoted: ctx.msg });
});

cmd('groupinfo', { cat: 2, desc: 'Infos du groupe', group: true }, async (ctx) => {
  const meta = await groupMeta(ctx.sock, ctx.from);
  if (!meta) return ctx.reply('❌ Groupe introuvable.');
  const admins = meta.participants.filter((p) => p.admin).length;
  await ctx.reply(
    `╭─────────────────────────────\n` +
    `│  *${meta.subject || 'Groupe'}*\n│\n` +
    `│  ID : ${meta.id}\n` +
    `│  Membres : ${meta.participants.length}\n` +
    `│  Admins : ${admins}\n` +
    `│  Créé : ${meta.creation ? new Date(meta.creation * 1000).toLocaleDateString('fr-FR') : '?'}\n` +
    `╰─────────────────────────────`
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
  await ctx.sock.sendMessage(ctx.from, {
    poll: { name: question, values, selectableCount: 1 },
  });
});

/* ── 3. PROTECTION ────────────────────────────────────────── */

function toggleReply(g, key, label) {
  return `${g[key] ? '✅' : '❌'} *${label}* : ${g[key] ? 'activée' : 'désactivée'}\nTape à nouveau pour basculer.`;
}

cmd('antilink', { cat: 3, desc: 'Supprimer les liens', usage: 'antilink on|off', group: true, admin: true }, async (ctx) => {
  const g = getGroup(ctx.from);
  if (ctx.args[0]) g.antilink = ['on', 'true', 'activer', 'activate'].includes(ctx.args[0].toLowerCase());
  saveState();
  await ctx.reply(toggleReply(g, 'antilink', 'Anti-lien'));
});

cmd('antibad', { cat: 3, desc: 'Filtrer les gros mots', usage: 'antibad on|off', group: true, admin: true }, async (ctx) => {
  const g = getGroup(ctx.from);
  if (ctx.args[0]) g.antibad = ['on', 'true'].includes(ctx.args[0].toLowerCase());
  saveState();
  await ctx.reply(toggleReply(g, 'antibad', 'Anti-gros mots'));
});

cmd('antidelete', { cat: 3, desc: 'Renvoyer les messages supprimés', usage: 'antidelete on|off', group: true, admin: true }, async (ctx) => {
  const g = getGroup(ctx.from);
  if (ctx.args[0]) g.antidelete = ['on', 'true'].includes(ctx.args[0].toLowerCase());
  saveState();
  await ctx.reply(toggleReply(g, 'antidelete', 'Anti-suppression'));
});

cmd('welcome', { cat: 3, desc: 'Message de bienvenue', usage: 'welcome on|off', group: true, admin: true }, async (ctx) => {
  const g = getGroup(ctx.from);
  if (ctx.args[0]) g.welcome = ['on', 'true'].includes(ctx.args[0].toLowerCase());
  saveState();
  await ctx.reply(toggleReply(g, 'welcome', 'Bienvenue'));
});

cmd('goodbye', { cat: 3, desc: 'Message de départ', usage: 'goodbye on|off', group: true, admin: true }, async (ctx) => {
  const g = getGroup(ctx.from);
  if (ctx.args[0]) g.goodbye = ['on', 'true'].includes(ctx.args[0].toLowerCase());
  saveState();
  await ctx.reply(toggleReply(g, 'goodbye', 'Au revoir'));
});

function warnCount(chat, who) {
  const key = `${chat}|${who}`;
  return state.warns[key] || 0;
}
function setWarns(chat, who, n) {
  const key = `${chat}|${who}`;
  if (n <= 0) delete state.warns[key];
  else state.warns[key] = n;
}

cmd('warn', { cat: 3, desc: 'Avertir un membre', usage: 'warn @user [raison]', group: true, admin: true }, async (ctx) => {
  const target = targetFrom(ctx);
  if (!target) return ctx.reply(`❌ ${config.prefix}warn @user [raison]`);
  const who = num(target);
  const count = warnCount(ctx.from, who) + 1;
  const reason = ctx.q.replace(/@\d+/g, '').trim() || 'raison non précisée';
  if (count >= config.messages.maxWarnings) {
    setWarns(ctx.from, who, 0);
    await ctx.reply(`🚫 *@${who}* a atteint ${count} avertissements → expulsion.\nRaison : ${reason}`, [target]);
    try {
      const meta = await groupMeta(ctx.sock, ctx.from);
      const p = findParticipant(meta, target);
      await ctx.sock.groupParticipantsUpdate(ctx.from, [p?.id || target], 'remove');
    } catch (e) {}
  } else {
    setWarns(ctx.from, who, count);
    saveState();
    await ctx.reply(`⚠️ *@${who}* averti (${count}/3)\nRaison : ${reason}`, [target]);
  }
});

cmd('unwarn', { cat: 3, desc: 'Retirer un avertissement', usage: 'unwarn @user', group: true, admin: true }, async (ctx) => {
  const target = targetFrom(ctx);
  if (!target) return ctx.reply(`❌ ${config.prefix}unwarn @user`);
  setWarns(ctx.from, num(target), 0);
  saveState();
  await ctx.reply(`✅ Avertissements remis à zéro pour +${num(target)}.`);
});

cmd('warnings', { cat: 3, desc: 'Voir les avertissements', usage: 'warnings @user', group: true, admin: true }, async (ctx) => {
  const target = targetFrom(ctx);
  if (!target) return ctx.reply(`❌ ${config.prefix}warnings @user`);
  await ctx.reply(`⚠️ +${num(target)} : *${warnCount(ctx.from, num(target))}/3* avertissements.`);
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
    await ctx.sock.sendMessage(ctx.from, { sticker: await sticker.toBuffer() }, { quoted: ctx.msg });
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
    await ctx.sock.sendMessage(ctx.from, { sticker: await sticker.toBuffer() }, { quoted: ctx.msg });
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
    await ctx.sock.sendMessage(ctx.from, { image: png, caption: '🖼️' }, { quoted: ctx.msg });
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
    await ctx.sock.sendMessage(ctx.from, { audio: mp3, mimetype: 'audio/mpeg' }, { quoted: ctx.msg });
  } catch (e) {
    await ctx.reply(`❌ Conversion impossible : ${e.message}`);
  }
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
    await ctx.sock.sendMessage(ctx.from, { image: png, caption: `🔲 QR : ${ctx.q.slice(0, 100)}` }, { quoted: ctx.msg });
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
      await ctx.sock.sendMessage(jid, { text: `📢 *${config.botName}*\n\n${ctx.q}` });
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
  await ctx.sock.sendMessage(
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
  await ctx.sock.sendMessage(ctx.from, {
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
  await ctx.sock.sendMessage(ctx.from, {
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
  await ctx.sock.sendMessage(ctx.from, {
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

cmd('glog', { cat: 2, desc: 'Annoncer les changements du groupe', usage: 'glog on|off', group: true, admin: true }, async (ctx) => {
  const g = getGroup(ctx.from);
  if (ctx.args[0]) g.glog = ['on', 'true'].includes(ctx.args[0].toLowerCase());
  saveState();
  await ctx.reply(toggleReply(g, 'glog', 'Journal du groupe'));
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
  await ctx.sock.sendMessage(ownerJid, {
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

function ffmpegBuffer(input, args, maxBytes) {
  return new Promise((resolve, reject) => {
    const ff = spawn(ffmpegPath, ['-hide_banner', '-loglevel', 'error', ...args]);
    const chunks = [];
    let size = 0;
    let err = '';
    ff.stdout.on('data', (c) => {
      size += c.length;
      if (size > maxBytes) {
        try { ff.kill(); } catch {}
        reject(new Error('fichier trop volumineux après conversion'));
      } else chunks.push(c);
    });
    ff.stderr.on('data', (c) => { err += c.toString().slice(0, 400); });
    ff.on('error', reject);
    ff.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(chunks));
      else reject(new Error(err.trim() || `ffmpeg (code ${code})`));
    });
    ff.stdin.on('error', () => {});
    ff.stdin.end(input);
  });
}

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

cmd(['yt', 'yts', 'ytsearch'], { cat: 11, desc: 'Rechercher une vidéo YouTube', usage: 'yt <titre>' }, async (ctx) => {
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

cmd(['play', 'mp3', 'yta'], { cat: 11, desc: 'Télécharger une musique en MP3', usage: 'play <titre ou lien>' }, async (ctx) => {
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
    await ctx.sock.sendMessage(ctx.from, {
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

cmd(['video', 'ytv', 'ytmp4'], { cat: 11, desc: 'Télécharger une vidéo YouTube', usage: 'video <titre ou lien>' }, async (ctx) => {
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
    await ctx.sock.sendMessage(ctx.from, {
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
    reply: async (text, mentions) =>
      sock.sendMessage(base.from, mentions ? { text, mentions } : { text }, { quoted: msg }),
    react: async (emoji) => {
      try {
        await sock.sendMessage(base.from, { react: { text: emoji, key: msg.key } });
      } catch (e) {}
    },
  };

  /* Permissions */
  if (config.selfMode || state.settings.selfMode) {
    if (!ctx.isOwner && !msg.key.fromMe) return true; // silencieux
  }
  if (entry.owner && !ctx.isOwner) return ctx.reply(config.messages.ownerOnly), true;
  if (entry.group && !ctx.isGroup) return ctx.reply(config.messages.groupOnly), true;
  if (entry.admin && ctx.isGroup && !ctx.isAdmin && !ctx.isOwner) return ctx.reply(config.messages.adminOnly), true;
  if (entry.botAdmin && ctx.isGroup && !ctx.isBotAdmin) return ctx.reply(config.messages.botAdminNeeded), true;

  state.stats.commands += 1;
  saveState();

  typingOn(sock, base.from);
  try {
    await entry.handler(ctx);
  } catch (e) {
    console.error(`[CMD] ${entry.name}:`, e.message);
    await ctx.reply(`${config.messages.error}\n\`[${e.message}]\``).catch(() => {});
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
    await sock.sendMessage(chat, { text: renderMainMenu() }, { quoted: msg });
    return true;
  }

  if (st.cat === 0) {
    if (n >= 1 && n <= CATEGORIES.length) {
      setMenu(chat, n);
      await sock.sendMessage(chat, { text: renderCategory(n) }, { quoted: msg });
      return true;
    }
    return false;
  }

  const list = categoryCommands(st.cat);
  if (n >= 1 && n <= list.length) {
    await executeCommand(sock, msg, list[n - 1].name, [], base);
    return true;
  }
  await sock.sendMessage(
    chat,
    { text: `❌ Chiffre invalide (1-${list.length}). Réponds *0* pour le menu.` },
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
  await sock.sendMessage(chat, {
    text: `🧠 *AINORIA* → \`${config.prefix}${entry.name}\`${args.length ? `\n💬 ${args.join(' ')}` : ''}`,
  }, { quoted: msg });
  await executeCommand(sock, msg, entry.name, args, base);
  return true;
}

/* ════════════════════════════════════════════════════════════
   7. PROTECTIONS DE GROUPE (avant toute commande)
   ════════════════════════════════════════════════════════════ */

async function guardDelete(sock, msg, base, warning) {
  try {
    await sock.sendMessage(base.from, { delete: msg.key });
  } catch (e) {}
  if (warning && guardAllows(base.from, base.senderNum)) {
    await sock
      .sendMessage(base.from, {
        text: warning,
        mentions: [base.from.endsWith('@g.us') ? base.sender : base.from],
      })
      .catch(() => {});
  }
}

async function runProtections(sock, msg, base, text) {
  const g = getGroup(base.from);
  const meta = await groupMeta(sock, base.from);

  // Blacklist : suppression systématique
  if (state.blacklist.includes(base.senderNum)) {
    await guardDelete(sock, msg, base, null);
    return true;
  }

  if (base.isAdmin || base.isOwner || base.isBotSelf) return false;

  if (!botIsAdmin(sock, meta)) return false; // sans admin, rien à supprimer

  if (g.antilink && LINK_RE.test(text)) {
    await guardDelete(sock, msg, base, `🚫 Liens interdits ici, @${base.senderNum} !`);
    return true;
  }

  if (g.antibad && text) {
    const lower = text.toLowerCase();
    const hit = BAD_WORDS.find((w) => new RegExp(`\\b${escRegExp(w)}\\b`, 'i').test(lower));
    if (hit) {
      await guardDelete(sock, msg, base, `🚫 Langage interdit, @${base.senderNum} !`);
      return true;
    }
  }

  return false;
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
      await sock.sendMessage('status@broadcast', {
        react: { text: config.likeEmoji || '👍', key: msg.key },
      }).catch(() => {});
    }
    if (config.autoReplyStatus && config.statusReadMsg && msg.key.participant) {
      await sock.sendMessage(msg.key.participant, { text: config.statusReadMsg }).catch(() => {});
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
    if (msg.messageTimestamp && Date.now() - Number(msg.messageTimestamp) * 1000 > 5 * 60 * 1000) return;

    const content = unwrap(msg.message);
    const text = textOf(content).trim();
    const isGroup = from.endsWith('@g.us');
    const fromMe = !!msg.key.fromMe;
    const sender = fromMe ? sock.user?.id || from : msg.key.participant || from;
    const senderNum = num(sender);

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
      sock.sendMessage(from, { react: { text: config.likeEmoji || '👍', key: msg.key } }).catch(() => {});
    }

    /* Base de contexte partagée */
    const base = {
      from,
      sender,
      senderNum,
      isGroup,
      isOwner: fromMe || isOwnerJid(sender) || senderNum === num(sock.user?.id),
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

    /* Mode self : les non-owners sont ignorés totalement */
    if ((config.selfMode || state.settings.selfMode) && !base.isOwner && !fromMe) return;

    /* ── Suppression détectée → renvoi (antidelete) ── */
    const proto = content?.protocolMessage;
    if (proto && (proto.type === 'REVOKE' || proto.type === 0)) {
      const key = proto.key;
      if (key?.remoteJid && key?.id) {
        const cached = getCache(key.remoteJid, key.id);
        const g = getGroup(key.remoteJid);
        if (cached && g.antidelete && !cached.msg.key.fromMe) {
          const author = key.participant || key.remoteJid;
          await sock.sendMessage(key.remoteJid, {
            text: `♻️ *Message supprimé détecté*\nDe : +${num(author)}`,
            mentions: [author],
          }).catch(() => {});
          await sock.sendMessage(key.remoteJid, cached.msg.message, { quoted: cached.msg }).catch(() => {});
        }
      }
      return;
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
      await sock.sendMessage(from, {
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
        await sock.sendMessage(from, { text: lines.join('\n'), mentions: ci.mentionedJid }, { quoted: msg }).catch(() => {});
      }
    }

    /* ── XP (légère progression) ── */
    if (!fromMe) {
      u.xp = (u.xp || 0) + 1 + Math.floor(Math.random() * 3);
      if (state.stats.messages % 20 === 0) saveState();
    }

    /* ── Menu interactif par chiffres ── */
    if (await handleNumeric(sock, msg, text, base)) return;

    /* ── Protégions de groupe (suppression) ── */
    if (isGroup && !fromMe) {
      if (await runProtections(sock, msg, base, text)) return;
    }

    /* ── AINORIA : intention en langage naturel (menu ouvert) ── */
    if (await runIntent(sock, msg, text, base)) return;

    /* ── Commande textuelle ── */
    const prefix = config.prefix;
    if (!text.startsWith(prefix)) return;

    const body = text.slice(prefix.length).trim();
    if (!body) return;
    const args = body.split(/\s+/);
    const name = args.shift();

    if (!rateOk(sender)) return;

    if (!commands.has(name.toLowerCase())) {
      await sock.sendMessage(from, { text: config.messages.unknown }, { quoted: msg }).catch(() => {});
      return;
    }

    await executeCommand(sock, msg, name, args, base);
  } catch (e) {
    console.error('[HANDLER]', e.message);
  }
}

/* ════════════════════════════════════════════════════════════
   9. ARRIVÉES / DÉPARTS — welcome & goodbye
   ════════════════════════════════════════════════════════════ */

async function handleGroupUpdate(sock, update) {
  try {
    const { id, participants, action } = update;
    if (!id || !id.endsWith('@g.us') || !participants?.length) return;
    const g = getGroup(id);

    if (action === 'add' && g.welcome) {
      const meta = await groupMeta(sock, id).catch(() => null);
      for (const p of participants) {
        const jid = typeof p === 'string' ? p : p?.id;
        if (!jid) continue;
        const text = (g.welcomeMessage || 'Bienvenue @user !')
          .replace(/@user/g, `@${num(jid)}`)
          .replace(/@group/g, meta?.subject || 'ce groupe')
          .replace(/#memberCount/g, String(meta?.participants?.length || '?'));
        await sock.sendMessage(id, { text, mentions: [jid] }).catch(() => {});
        await new Promise((r) => setTimeout(r, 700));
      }
      saveState();
    } else if ((action === 'remove' || action === 'leave') && g.goodbye) {
      for (const p of participants) {
        const jid = typeof p === 'string' ? p : p?.id;
        if (!jid || jid === sock.user?.id) continue;
        const text = (g.goodbyeMessage || '@user a quitté le groupe.').replace(/@user/g, `@${num(jid)}`);
        await sock.sendMessage(id, { text, mentions: [jid] }).catch(() => {});
        await new Promise((r) => setTimeout(r, 700));
      }
    }
  } catch (e) {
    console.error('[HANDLER] group-update:', e.message);
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
    await sock.sendMessage(update.id, { text: `📢 *Groupe mis à jour*\n${lines.join('\n')}` }).catch(() => {});
  } catch (e) {
    console.error('[HANDLER] group-info:', e.message);
  }
}

module.exports = {
  handleMessage,
  handleGroupUpdate,
  handleGroupInfo,
  commands,
  CATEGORIES,
  renderMainMenu,
  state,
  saveState,
  askGemini,
};
