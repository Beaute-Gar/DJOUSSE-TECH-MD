'use strict';
/**
 * scripts/cmd-sweep.js — Balayage systématique des commandes du bot
 * ──────────────────────────────────────────────────────────────────
 * Exécute CHAQUE commande du registre via le VRAI pipeline
 * (handler.handleMessage → executeCommand → plugin.handler) avec une
 * socket MOCK qui capture les envois. Aucun message WhatsApp ne part.
 *
 *   node scripts/cmd-sweep.js                 → toutes les commandes
 *   node scripts/cmd-sweep.js --only ping,menu
 *   node scripts/cmd-sweep.js --limit 20      → aperçu rapide
 *
 * ── Isolation (l'état réel du projet n'est jamais touché) ────────
 *   • DATA_DIR / SESSION_DIR / .env → dossier temporaire
 *   • RATE_MAX=999999 (pas de rate-limit artificiel)
 *   • child_process (exec/spawn/execSync) → bloqué : aucune commande
 *     ne peut lancer git/npm/shell sur la machine
 *   • process.exit → sentinelle (les commandes .restart2/.reboot
 *     s'exécutent sans tuer le harnais)
 *   • Baileys : downloadMediaMessage / downloadContentFromMessage
 *     → VRAI octets de src/assets/djousse-md-logo.png (image du bot),
 *     donc les commandes média tournent réellement (conversion
 *     sticker/toimg via sharp) sans réseau WhatsApp
 *
 * ── Contextes testés (progressivement : A → F) ──────────────────
 *   A  privé     texte                       `.cmd`
 *   B  privé     image EN LÉGENDE            image + `.cmd`
 *   C  privé     sticker CITÉ                `.cmd` répondant à un sticker
 *   D  groupe    texte                       (owner = admin, bot = superadmin)
 *   E  groupe    image EN LÉGENDE
 *   F  groupe    image CITÉE
 * Une commande est « OK_d » dès qu'elle répond dans le contexte d
 * (hors message de garde exact = config.messages.*).
 *
 * ── Classification ──────────────────────────────────────────────
 *   OK_A…OK_F  a répondu dans ce contexte
 *   GATED      n'a répondu que par des messages de garde
 *   BROKEN     erreur console ([CMD] …) et zéro réponse
 *   NOT_REG    « COMMANDE INCONNUE » alors qu'elle figure au registre
 *   SILENT     rien du tout, aucune erreur
 *   TIMEOUT    gel > 15 s
 *
 * Sortie : logs/cmd-sweep-report.json + logs/cmd-sweep.log
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const events = require('events');

const ROOT = path.resolve(__dirname, '..');
const LOG_DIR = path.join(ROOT, 'logs');
const TIMEOUT_MS = 15000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/* Console d'origine, capturée AVANT la redirection vers le journal :
   LOG doit rester visible même une fois console.error redirigé. */
const realConsoleError = console.error.bind(console);
const LOG = (...a) => realConsoleError('[sweep]', ...a);

/* Trace EN DIRECT : une ligne par commande au début de son test, une
   ligne à sa classification. Écrite sur la console réelle ET dans
   logs/cmd-sweep-live.txt (une seule chaîne, aucune fuite console). */
const LIVE_PATH = path.join(LOG_DIR, 'cmd-sweep-live.txt');
fs.mkdirSync(LOG_DIR, { recursive: true });
const live = (s) => {
  realConsoleError(s);
  try { fs.appendFileSync(LIVE_PATH, s + '\n', 'utf8'); } catch { /* logs/ inaccessible */ }
};

/* ═══════════ 1. Environnement isolé (AVANT tout require src) ═══════════ */
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'djou-sweep-'));
const TMP_DATA = path.join(TMP, 'data');
const TMP_SESSION = path.join(TMP, 'session');
const TMP_ENV = path.join(TMP, '.env');
fs.mkdirSync(TMP_DATA, { recursive: true });
fs.mkdirSync(TMP_SESSION, { recursive: true });
fs.writeFileSync(TMP_ENV, [
  'PREFIX=.',
  'HUMAN_DELAY=0',
  'RATE_MAX=999999',
  'RATE_WINDOW_MS=9999999',
  'FORCE_PUBLIC=1',
  'AGENT_MODE=off',
  'AUTO_REACT=0',
  `DATA_DIR=${TMP_DATA}`,
  `SESSION_DIR=${TMP_SESSION}`,
  '',
].join('\n'));

process.env.ENV_FILE = TMP_ENV;
process.env.DATA_DIR = TMP_DATA;
process.env.SESSION_DIR = TMP_SESSION;
process.env.PREFIX = '.';
process.env.OWNER_NUMBER = '237600111222';
process.env.RATE_MAX = '999999';
process.env.RATE_WINDOW_MS = '9999999';
process.env.HUMAN_DELAY = '0';
process.env.FORCE_PUBLIC = '1';
process.env.AGENT_MODE = 'off';
process.env.AUTO_REACT = '0';
delete process.env.MODE;

/* ═══════════ 2. Boucliers (AVANT tout require src) ═══════════ */

/* 2a. Aucune commande ne doit lancer de sous-processus réel */
const cp = require('child_process');
const blockedProc = (what) => function blocked() {
  const ee = new events.EventEmitter();
  ee.kill = () => {};
  ee.stdout = new events.EventEmitter();
  ee.stderr = new events.EventEmitter();
  process.nextTick(() => ee.emit('error', new Error(`[sweep] sous-processus bloqué (${what})`)));
  return ee;
};
cp.exec = blockedProc('exec');
cp.execFile = blockedProc('execFile');
cp.spawn = blockedProc('spawn');
cp.execSync = () => { throw new Error('[sweep] execSync bloqué'); };
cp.spawnSync = () => ({ status: 1, stdout: Buffer.alloc(0), stderr: Buffer.from('[sweep] bloqué') });

/* 2b. Les commandes média reçoivent de VRAIS octets (image du bot) */
const baileysId = require.resolve('@whiskeysockets/baileys');
require(baileysId);
{
  const BOT_IMG = fs.readFileSync(path.join(ROOT, 'src', 'assets', 'djousse-md-logo.png'));
  const mod = require.cache[baileysId];
  const orig = mod.exports;
  const stub = Object.assign(Object.create(Object.getPrototypeOf(orig)), orig, {
    /* mediaMessage: quel que soit le type annoncé, on rend l'image du bot */
    downloadMediaMessage: async () => BOT_IMG,
    downloadContentFromMessage: async () => {
      const g = async function* () { yield BOT_IMG; };
      return g();
    },
  });
  mod.exports = stub;
}

/* 2c. process.exit → sentinelle (restart2/reboot ne tuent pas le harnais) */
const REAL_EXIT = process.exit.bind(process);
let exitRequests = 0;
process.exit = (code) => { exitRequests += 1; return undefined; };

/* 2d. Rejets de promesses non gérés → journalisés, jamais fatals */
const strayErrors = [];
process.on('unhandledRejection', (e) => { strayErrors.push(String(e && e.message || e).slice(0, 300)); });
process.on('uncaughtException', (e) => { strayErrors.push('uncaught: ' + String(e && e.message || e).slice(0, 300)); });

/* ═══════════ 3. Chargement du cerveau ═══════════ */
const t0 = Date.now();
const handler = require(path.join(ROOT, 'src', 'handlers', 'handler.js'));
const config = require(path.join(ROOT, 'src', 'config', 'config.js'));
LOG(`cerveau chargé en ${((Date.now() - t0) / 1000).toFixed(1)} s · ${handler.commands.size} entrées de registre`);

/* ═══════════ 4. Journal des lignes console par commande ═══════════ */
const rawLog = console.log.bind(console);
const rawErr = console.error.bind(console);
const journal = [];          // { name, ctx, line }
let current = null;          // { name, ctx } commande en cours
const fmt = (a) => a.map((x) => (typeof x === 'string' ? x : require('util').inspect(x, { depth: 1, breakLength: 160 }))).join(' ');
const tap = (args) => {
  if (current) journal.push({ name: current.name, ctx: current.ctx, line: fmt(args) });
};
console.log = (...a) => tap(a);
console.warn = (...a) => tap(a);
console.error = (...a) => tap(a);

/* ═══════════ 5. Socket mock ═══════════ */
/* Les cadres du bot (style.js → toUnicode) convertissent les lettres en
   « lettres mathématiques » Unicode. On inverse la transformation pour
   pouvoir comparer les réponses à des motifs lisibles (gardes, usages). */
const DESTYLE = (() => {
  const m = new Map();
  const build = (start, chars) => { for (let i = 0; i < chars.length; i += 1) m.set(start + i, chars[i]); };
  build(0x1D670, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  build(0x1D68A, 'abcdefghijklmnopqrstuvwxyz');
  build(0x1D7F6, '0123456789');
  return m;
})();
const destyle = (s) => String(s || '').replace(/[\u{1D400}-\u{1D7FF}]/gu, (ch) => DESTYLE.get(ch.codePointAt(0)) || ch);

const GROUP_JID = '120363555000111222@g.us';
const OWNER_JID = '237600111222:1@s.whatsapp.net';
const BOT_JID = '237600333444:1@s.whatsapp.net';

const GROUP_META = {
  id: GROUP_JID,
  subject: 'Sweep Test Group',
  size: 3,
  creation: 1700000000,
  desc: 'Groupe de test pour le balayage des commandes',
  announce: false,
  restrict: false,
  ephemeralDuration: 0,
  participants: [
    { id: BOT_JID, admin: 'superadmin', isAdmin: true },
    { id: OWNER_JID, admin: 'admin', isAdmin: true },
    { id: '237600222333:1@s.whatsapp.net', admin: null, isAdmin: false },
  ],
};

const BOT_IMG = fs.readFileSync(path.join(ROOT, 'src', 'assets', 'djousse-md-logo.png'));

const sends = [];   // { t, jid, kind, text, raw }
const recordSend = (jid, content) => {
  let kind = 'autre';
  let raw = '';
  if (content) {
    if (typeof content.text === 'string') { kind = 'texte'; raw = content.text; }
    else if (content.image) { kind = 'image'; raw = content.image.caption || ''; }
    else if (content.video) { kind = 'video'; raw = content.video.caption || ''; }
    else if (content.audio) { kind = 'audio'; }
    else if (content.sticker) { kind = 'sticker'; }
    else if (content.document) { kind = 'document'; raw = content.document.caption || ''; }
    else if (content.reaction) { kind = 'reaction'; raw = content.reaction.text || ''; }
    else if (content.poll) { kind = 'poll'; raw = content.poll.name || ''; }
    else kind = Object.keys(content)[0] || 'autre';
  }
  sends.push({ t: Date.now(), jid, kind, text: destyle(raw), raw });
  return { key: { id: 'SWEEP' + sends.length, remoteJid: jid, fromMe: true } };
};

const genericCache = new Map();
function makeSock() {
  const sock = {
    user: { id: BOT_JID, name: 'Sweep', lid: undefined },
    ev: {
      on() {}, off() {}, emit() {}, removeAllListeners() {},
      process() {}, run() {}, consume() {}, bufferedEvents: {},
      createBufferedEvent() { return {}; },
    },
    sendMessage: async (jid, content) => recordSend(jid, content),
    relayMessage: async (jid) => recordSend(jid, { relay: true }),
    groupMetadata: async (gid) => Object.assign(
      JSON.parse(JSON.stringify(GROUP_META)),
      gid ? { id: gid } : {}
    ),
    groupInviteCode: async () => 'SWEEPBALAYAGE01',
    groupGetInviteInfo: async () => JSON.parse(JSON.stringify(GROUP_META)),
    groupFetchAllParticipating: async () => [JSON.parse(JSON.stringify(GROUP_META))],
    groupParticipantsUpdate: async () => [{ status: '200' }],
    groupRequestParticipantsList: async () => [],
    groupRequestParticipantsUpdate: async () => [],
    groupAcceptInvite: async () => GROUP_JID,
    groupLeave: async () => {},
    groupCreate: async () => ({ id: GROUP_JID }),
    profilePictureUrl: async () => 'https://raw.githubusercontent.com/Beaute-Gar/DJOUSSE-TECH-MD/main/web/public/assets/icons/icon-192.png',
    fetchStatus: async () => ({ status: 'En ligne', setAt: new Date().toISOString() }),
    onWhatsApp: async (...jids) => jids.map((jid) => ({ exists: true, jid })),
    fetchBlocklist: async () => [],
    fetchPrivacySettings: async () => ({}),
    getUSyncDevices: async () => [],
    readMessages: async () => {},
    sendPresenceUpdate: async () => {},
    presenceSubscribe: async () => {},
    sendReceipt: async () => {},
    chatModify: async () => {},
    updateBlockStatus: async () => {},
    rejectCall: async () => {},
    logout: async () => {},
    updateProfileStatus: async () => {},
    updateProfileName: async () => {},
    updateProfilePicture: async () => {},
    removeProfilePicture: async () => {},
    newsletterMetadata: async () => ({ id: 'newsletter@s.whatsapp.net', name: 'Sweep', state: 'ACTIVE' }),
  };
  /* Toute API Baileys non listée renvoie une promesse résolue : une
     commande peut appeler n'importe quelle méthode sans faire planter
     le harnais. */
  return new Proxy(sock, {
    get(t, p) {
      if (typeof p === 'symbol') return undefined;
      if (p in t) return t[p];
      if (!genericCache.has(p)) genericCache.set(p, async () => ({}));
      return genericCache.get(p);
    },
  });
}

/* ═══════════ 6. Liste des commandes ═══════════ */
const onlyArg = process.argv.find((a) => a.startsWith('--only'));
const limitArg = process.argv.find((a) => a.startsWith('--limit'));

const uniq = new Map();
for (const entry of handler.commands.values()) {
  if (!entry || !entry.name) continue;
  const n = String(entry.name).toLowerCase();
  if (!uniq.has(n)) uniq.set(n, entry);
}

/* On balaye l'UNION des clés de registre et des noms canoniques :
   • les clés = ce que l'utilisateur tape réellement (dont les alias :
     `.listbgm` et `.setbgm` passent par des branches DIFFÉRENTES) ;
   • les noms canoniques dont la clé a été retirée (PHASE B) : on veut
     les voir échouer explicitement plutôt que de les ignorer. */
const keySet = new Set(handler.commands.keys());
const nameSet = new Set(uniq.keys());
const union = new Set([...keySet, ...nameSet]);
let names = [...union].sort();

if (onlyArg) {
  const raw = onlyArg.includes('=') ? onlyArg.split('=')[1] : (process.argv[process.argv.indexOf(onlyArg) + 1] || '');
  const wanted = raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const wantedSet = new Set(wanted);
  /* on garde aussi tout nom/alias pointant vers une commande demandée */
  const aliasOf = new Map();
  for (const [n, e] of uniq) aliasOf.set(n, e.name.toLowerCase());
  names = names.filter((n) => wantedSet.has(n) || wantedSet.has(aliasOf.get(n)));
}
if (limitArg) {
  const raw = limitArg.includes('=') ? limitArg.split('=')[1] : (process.argv[process.argv.indexOf(limitArg) + 1] || '0');
  names = names.slice(0, Number(raw) || 0);
}

const BY_NAME = new Map();
for (const [n, e] of uniq) if (!BY_NAME.has(n)) BY_NAME.set(n, e);

/* ═══════════ 7. Fabrication des messages ═══════════ */
const CTX = ['A', 'B', 'C', 'D', 'E', 'F'];
const CTX_LABEL = {
  A: 'privé · texte',
  B: 'privé · image en légende',
  C: 'privé · sticker cité',
  D: 'groupe · texte',
  E: 'groupe · image en légende',
  F: 'groupe · image citée',
};
const chatOf = (ctx, idx) =>
  (ctx === 'D' || ctx === 'E' || ctx === 'F')
    /* groupe unique par commande : une commande qui modifierait l'état
       du groupe (antilink, blacklist…) ne peut pas empoisonner la suite */
    ? `120363${String(9000000000 + idx)}@g.us`
    : `23769${String(100000000 + idx)}@s.whatsapp.net`;

function imageMsg() {
  return {
    mimetype: 'image/jpeg',
    fileLength: String(BOT_IMG.length),
    height: 720,
    width: 720,
    mediaKey: Buffer.alloc(32, 7),
    directPath: '/v/t62.7118-24/sweep',
    contextInfo: {},
  };
}
function stickerMsg() {
  return {
    mimetype: 'image/webp',
    fileLength: String(BOT_IMG.length),
    height: 512,
    width: 512,
    isAnimated: false,
    mediaKey: Buffer.alloc(32, 3),
    directPath: '/v/t62.7118-24/sweep',
    contextInfo: {},
  };
}

function makeMessage(name, ctx, idx) {
  const text = `.${name}`;
  const chat = chatOf(ctx, idx);
  const isGroup = ctx === 'D' || ctx === 'E' || ctx === 'F';
  /* Chemin de PRODUCTION : le bot tourne sur le compte du propriétaire,
     donc ses propres messages lui arrivent avec fromMe=true (constaté
     dans les logs Render : `fromMe=true 13679903363:xx@s.whatsapp.net`). */
  const key = {
    remoteJid: chat,
    fromMe: true,
    id: `SWEEPM${idx}${ctx}${String(Date.now()).slice(-5)}`,
    ...(isGroup ? { participant: BOT_JID } : {}),
  };
  const base = { key, messageTimestamp: Math.floor(Date.now() / 1000), pushName: 'Owner' };

  if (ctx === 'B' || ctx === 'E') {
    base.message = { imageMessage: Object.assign(imageMsg(), { caption: text }) };
  } else if (ctx === 'C') {
    base.message = {
      extendedTextMessage: {
        text,
        contextInfo: { quotedMessage: { stickerMessage: stickerMsg() }, participant: BOT_JID },
      },
    };
  } else if (ctx === 'F') {
    base.message = {
      extendedTextMessage: {
        text,
        contextInfo: { quotedMessage: { imageMessage: imageMsg() }, participant: '237600222333:1@s.whatsapp.net' },
      },
    };
  } else {
    base.message = { conversation: text };
  }
  return base;
}

/* ═══════════ 8. Exécution ═══════════ */
/* Les gardes partent par ctx.error → renderError qui les passe EN
   MAJUSCULES dans une cadre : on compare sans tenir compte de la casse
   et sans l'emoji de tête. */
const GATE_NEEDLES = (() => {
  const g = config.messages || {};
  return [
    ...[g.groupOnly, g.adminOnly, g.botAdminNeeded, g.ownerOnly, g.privateOnly],
    /* gardes codées en dur dans executeCommand (command-access) */
    'ACCÈS RESTREINT',
    'CE BOT EST PRIVÉ',
  ]
    .filter(Boolean)
    .map((m) => {
      const s = String(m).trim();
      /* On ne retire le 1ᵉʳ jeton que s'il s'agit d'un EMOJI (> 0x2000) :
         « ACCÈS RESTREINT » sans emoji ne doit PAS devenir « restreint »,
         sinon toute réponse contenant « RESTREINT: NON » est prise à tort
         pour une garde (faux positif constaté sur .comminfo). */
      const cp = s.codePointAt(0) || 0;
      return (cp > 0x2000 ? s.replace(/^\S+\s*/, '') : s).trim().toLowerCase();
    })
    .filter(Boolean);
})();

function isGate(text) {
  if (!text) return false;
  const t = String(text).toLowerCase();
  return GATE_NEEDLES.some((n) => t.includes(n));
}

/* Réponse « mode d'emploi » (image requise, args requis…) : la commande
   répond, mais ce n'est pas encore sa fonction réelle — on continue dans
   un contexte plus riche (médias) pour vérifier qu'elle fonctionne VRAIMENT. */
const HINT_RX = /réponds à une image|réponds à un sticker|réponds à une vidéo|réponds à (un|une) audio|usage\s*:|utilisation\s*:|pour compléter|besoin d['’](une|un) (image|vidéo|audio)|envoie (d['’])?(une|un) (image|vidéo|audio)|ex\s*:|exemple\s*:/i;

async function runOne(name, ctx, idx) {
  const sock = makeSock();
  const msg = makeMessage(name, ctx, idx);
  const from = msg.key.remoteJid;
  const mark = sends.length;
  const jmark = journal.length;
  const t0 = Date.now();
  let timedOut = false;
  let failure = null;

  current = { name, ctx };
  try {
    await Promise.race([
      handler.handleMessage(sock, msg),
      new Promise((_, rej) => setTimeout(() => {
        const e = new Error('timeout harnais');
        e.isSweepTimeout = true;
        rej(e);
      }, TIMEOUT_MS)),
    ]);
  } catch (e) {
    if (e && e.isSweepTimeout) timedOut = true;
    else failure = String(e && e.message || e);
  }
  current = null;
  await sleep(700);   // laisse le temps aux envois différés (.catch() fuyants)

  const replies = sends.slice(mark);
  const lines = journal.slice(jmark).map((j) => j.line);
  const errors = lines.filter(
    (l) => l.startsWith(`[CMD] ${name}:`) || l.startsWith(`[CMD] ${name} `) || l.startsWith(`[CMD] ÉCHEC ${name}`)
  );
  const inconnue = lines.some((l) => l.startsWith(`[CMD] inconnue: ${name}`));
  /* « ⚠️ Erreur commande » = le plugin a THROW : ce n'est pas une
     réponse valide (executeCommand envoie ce secours automatiquement). */
  const realReplies = replies.filter(
    (r) => r.kind !== 'reaction' && !isGate(r.text) && !/erreur commande/i.test(r.text)
  );

  return {
    ctx,
    from,
    durationMs: Date.now() - t0,
    timedOut,
    failure,
    replies,
    realReplies,
    gates: replies.filter((r) => isGate(r.text)),
    errors,
    inconnue,
  };
}

/* ═══════════ 9. Balayage ═══════════ */
const results = {};
const startedAt = Date.now();
let done = 0;

/* État global à restaurer APRÈS CHAQUE commande : une commande qui
   changerait le préfixe (.setprefix), bannirait l'expéditeur (.ban) ou
   modifierait les réglages ne doit pas fausser tout le reste du
   balayage. */
function snapshotGlobals() {
  return {
    prefix: config.prefix,
    selfMode: config.selfMode,
    settings: JSON.parse(JSON.stringify(handler.state && handler.state.settings || {})),
    banned: global.bannedUsers instanceof Set ? new Set(global.bannedUsers) : null,
  };
}
function restoreGlobals(snap) {
  config.prefix = snap.prefix;
  config.selfMode = snap.selfMode;
  if (handler.state && handler.state.settings) {
    const s = handler.state.settings;
    for (const k of Object.keys(s)) delete s[k];
    Object.assign(s, snap.settings);
  }
  if (snap.banned) global.bannedUsers = snap.banned;
}

const INDEX = new Map([...uniq.keys()].map((n, i) => [n, i]));

(async () => {
  fs.writeFileSync(LIVE_PATH, '', 'utf8');
  LOG(`balayage de ${names.length} commande(s) — timeout ${TIMEOUT_MS / 1000} s par exécution`);
  live(`═══ BALAYAGE ${names.length} COMMANDES — ${new Date().toLocaleString('fr-FR')} ═══`);

  for (const name of names) {
    const idx = INDEX.get(name);
    const snap = snapshotGlobals();
    let lastHint = null;
    const no = String(done + 1).padStart(String(names.length).length, ' ');
    live(`[${no}/${names.length}] ▸ .${name} — test…`);
    const rec = { name, category: (BY_NAME.get(name) || {}).cat ?? null, attempts: [], status: '', ctx: '', sample: '', tag: '', errors: [] };
    results[name] = rec;

    for (const ctx of CTX) {
      const r = await runOne(name, ctx, idx);
      rec.attempts.push(r);

      if (r.inconnue) { rec.status = 'NOT_REG'; break; }
      if (r.realReplies.length) {
        /* Toutes les réponses sont des modes d'emploi (image requise,
           arguments requis…) → on tente un contexte plus riche avant de
           conclure. Mais si le message d'usage est IDENTIQUE à celui du
           contexte précédent, la commande attend des arguments (pas un
           média) : inutile de continuer. */
        const onlyHints = r.realReplies.every((x) => HINT_RX.test(x.text || ''));
        const hintText = onlyHints ? (r.realReplies.find((x) => x.text) || {}).text || '' : null;
        if (onlyHints && hintText && hintText === lastHint) {
          rec.tag = 'ARGS';
          rec.status = 'OK_' + ctx;
          rec.ctx = ctx;
          rec.sample = `usage :: ${hintText.replace(/\s+/g, ' ').slice(0, 150)}`;
          break;
        }
        if (onlyHints && ctx !== CTX[CTX.length - 1]) {
          lastHint = hintText;
          rec.tag = 'MEDIA_OU_ARGS';
          continue;
        }
        rec.status = 'OK_' + ctx;
        rec.ctx = ctx;
        const t = r.realReplies.find((x) => x.text) || r.realReplies[0];
        rec.sample = `${t.kind}${t.text ? ' :: ' + t.text.replace(/\s+/g, ' ').slice(0, 150) : ''}`;
        break;
      }
      if (r.inconnue) { rec.status = 'NOT_REG'; break; }
    }

    if (!rec.status) {
      const anyErr = rec.attempts.flatMap((a) => a.errors);
      const anyGates = rec.attempts.flatMap((a) => a.gates);
      const anyReplies = rec.attempts.flatMap((a) => a.replies);
      if (anyErr.length) rec.status = 'BROKEN';
      else if (rec.attempts.every((a) => a.timedOut)) rec.status = 'TIMEOUT';
      else if (anyGates.length || anyReplies.length) {
        rec.status = 'GATED';
        rec.sample = (anyGates[0] || anyReplies[0]).text.replace(/\s+/g, ' ').slice(0, 150);
      } else rec.status = 'SILENT';
      rec.errors = anyErr.map((e) => e.slice(0, 250));
    }

    restoreGlobals(snap);

    const ICON = { OK: '✅', BROKEN: '❌', NOT_REG: '⛔', SILENT: '🔕', GATED: '🚪', TIMEOUT: '⏱️' };
    const icon = ICON[String(rec.status).replace(/_.*/, '')] || '❔';
    const ctxLabel = rec.ctx ? CTX_LABEL[rec.ctx] : '';
    const detail = (rec.errors[0] || rec.sample || '').replace(/\s+/g, ' ').slice(0, 90);
    live(`[${no}/${names.length}] ${icon} .${name} → ${rec.status}${ctxLabel ? ' · ' + ctxLabel : ''}${detail ? ' · ' + detail : ''}`);

    done += 1;
    if (done % 25 === 0 || done === names.length) {
      const el = ((Date.now() - startedAt) / 1000).toFixed(0);
      const okCount = Object.values(results).filter((r) => r.status.startsWith('OK')).length;
      LOG(`${done}/${names.length} · ${el}s · OK=${okCount} · dernier=${name}:${rec.status}`);
    }
  }

  /* ═══════════ 10. Rapport ═══════════ */
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const summary = {};
  for (const r of Object.values(results)) summary[r.status] = (summary[r.status] || 0) + 1;

  const report = {
    generatedAt: new Date().toISOString(),
    durationSec: Math.round((Date.now() - startedAt) / 1000),
    totalCommands: names.length,
    summary,
    exitRequests,
    strayErrors: strayErrors.slice(0, 40),
    results,
  };
  fs.writeFileSync(path.join(LOG_DIR, 'cmd-sweep-report.json'), JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(
    path.join(LOG_DIR, 'cmd-sweep.log'),
    journal.map((j) => `[${j.name}/${j.ctx}] ${j.line}`).join('\n'),
    'utf8'
  );

  /* ═══════════ 11. Synthèse ═══════════ */
  const line = (s) => rawLog(s);
  line('\n════════════ BALAYAGE TERMINÉ ════════════');
  line(`commandes balayées : ${names.length} · durée ${report.durationSec}s · exit interceptés: ${exitRequests}`);
  for (const [k, v] of Object.entries(summary).sort()) line(`  ${k.padEnd(8)} : ${v}`);

  const dump = (pred, title, limit = 80) => {
    const list = Object.values(results).filter(pred).sort((a, b) => a.name.localeCompare(b.name));
    if (!list.length) return;
    line(`\n───── ${title} (${list.length}) ─────`);
    for (const r of list.slice(0, limit)) {
      const why = (r.errors[0] || r.sample || '').replace(/\n/g, ' ');
      line(`  ${r.name.padEnd(22)} [${r.ctx || '--'}] ${why.slice(0, 120)}`);
    }
    if (list.length > limit) line(`  … +${list.length - limit} autres → logs/cmd-sweep-report.json`);
  };

  dump((r) => r.status === 'NOT_REG', 'INACCESSIBLES (registre)');
  dump((r) => r.status === 'BROKEN', 'EN ERREUR (BROKEN)');
  dump((r) => r.status === 'TIMEOUT', 'BLOQUÉES (TIMEOUT)');
  dump((r) => r.status === 'SILENT', 'SILENCIEUSES (SILENT)');
  dump((r) => r.status === 'GATED', 'GARDES (GATED)');
  dump((r) => /^OK_/.test(r.status) && r.errors.length, 'OK MAIS AVEC ERREURS CONSOLE');
  line('\n[fichiers] logs/cmd-sweep-report.json · logs/cmd-sweep.log');

  REAL_EXIT(0);
})().catch((e) => {
  rawErr('[sweep] ÉCHEC DU BALAYAGE:', e && e.stack || e);
  REAL_EXIT(1);
});
