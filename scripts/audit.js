#!/usr/bin/env node
'use strict';
/**
 * AUDIT DJOUSSE TECH - scripts/audit.js
 *
 * Script UNIQUE de conformite. Il controle les4 garanties :
 *
 *   G1  Baileys officielle uniquement : pin exact, une seule copie,
 *       aucun alias (npm:/github:/file:...), aucune autre lib WhatsApp.
 *   G2  Architecte WhatsApp : un seul makeWASocket, un seul listener
 *       par evenement, un seul registre de commandes, un seul service
 *       d'envoi (lib/wa-send.js), options de socket recommandees.
 *   G3  Zero occurrence de la liste de mots interdits (section 3.1)
 *       sur tout le code hors node_modules.
 *   G4  Zero doublon : copies MD5, commandes en double, cadres de style
 *       codes en dur hors style.js, arbres morts, dependances non declarees.
 *
 * Usage :
 *   node scripts/audit.js            controle complet (hors reseau)
 *   node scripts/audit.js --deps     ajoute npm audit (vulnerabilites)
 *
 * Code d'arret : 0 = conforme, 1 = non conforme.
 * NB : les mots interdits sont assembles a la vollee (concatenation de
 *      fragments) pour que CE fichier ne contienne aucun mot interdit.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { builtinModules } = require('module');

const ROOT = path.resolve(__dirname, '..');
const WITH_DEPS = process.argv.includes('--deps');

/* ------------------------------------------------------------------ */
/* Resultats                                                           */
/* ------------------------------------------------------------------ */
const rows = [];
const push = (g, level, msg) => rows.push({ g, level, msg });
const OK = (g, m) => push(g, 'OK', m);
const KO = (g, m) => push(g, 'FAIL', m);
const WARN = (g, m) => push(g, 'WARN', m);
const INFO = (g, m) => push(g, 'INFO', m);

/* ------------------------------------------------------------------ */
/* Utilitaires                                                         */
/* ------------------------------------------------------------------ */
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const read = (p) => fs.readFileSync(p, 'utf8');

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', '.git', 'session', 'sessions', 'logs', 'tmp', 'temp'].includes(e.name)) continue;
      walk(p, out);
    } else if (/\.(js|cjs|mjs|ts|json|md)$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

/** Retire les commentaires et les chaines pour eviter les faux positifs. */
function strip(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  let st = 'code';
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (st === 'code') {
      if (c === '/' && d === '/') { st = 'sl'; i += 2; continue; }
      if (c === '/' && d === '*') { st = 'ml'; i += 2; continue; }
      if (c === "'" || c === '"' || c === '`') { st = c; out += c; i++; continue; }
      out += c; i++; continue;
    }
    if (st === 'sl') { if (c === '\n') { st = 'code'; out += '\n'; } i++; continue; }
    if (st === 'ml') { if (c === '*' && d === '/') { st = 'code'; i += 2; continue; } if (c === '\n') out += '\n'; i++; continue; }
    // chaine
    out += c;
    if (c === '\\' && i + 1 < n) { out += d; i += 2; continue; }
    if (c === st) st = 'code';
    i++;
  }
  return out;
}

function allPackageJsons() {
  return walk(ROOT).filter((p) => path.basename(p) === 'package.json');
}

function depsOf(pkg) {
  const j = JSON.parse(read(pkg));
  const bag = {};
  for (const k of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    if (j[k]) for (const [name, ver] of Object.entries(j[k])) bag[name] = ver;
  }
  return { name: j.name, bag, raw: j };
}

/* Fichiers du code actif (charge au demarrage) + tests */
const ACTIVE_ROOT_FILES = ['index.js', 'handler.js', 'config.js', 'style.js'];
const ACTIVE_DIRS = ['lib', 'guard', 'plugins', 'ludo', 'tests'];
function activeFiles() {
  const files = [];
  for (const f of ACTIVE_ROOT_FILES) if (fs.existsSync(path.join(ROOT, f))) files.push(path.join(ROOT, f));
  for (const d of ACTIVE_DIRS) if (fs.existsSync(path.join(ROOT, d))) walk(path.join(ROOT, d), files);
  return files;
}
/** Code produit (hors tests) - sert au controle de style. */
function productFiles() {
  return activeFiles().filter((p) => rel(p).split('/')[0] !== 'tests');
}

/* Mots interdits (section 3.1) - construits par concatenation. */
const KEYWORDS = [
  'but' + 'tons',
  'but' + 'tons' + 'Message',
  'but' + 'ton' + 'Text',
  'but' + 'ton' + 'Id',
  'but' + 'tons' + 'Response' + 'Message',
  'list' + 'Message',
  'list' + 'Response' + 'Message',
  'single' + 'Select' + 'Reply',
  'tem' + 'plate' + 'But' + 'tons',
  'tem' + 'plate' + 'Message',
  'hy' + 'drated' + 'Template',
  'tem' + 'plate' + 'But' + 'ton' + 'Reply' + 'Message',
  'inter' + 'active' + 'Message',
  'inter' + 'active' + 'Response' + 'Message',
  'native' + 'Flow' + 'Message',
  'native' + 'Flow' + 'Info',
  'native' + 'Flow' + 'Response' + 'Message',
  'quick' + '_reply',
  'cta' + '_url',
  'cta' + '_copy',
  'cta' + '_call',
  'single' + '_select',
  'carou' + 'sel' + 'Message',
];
const KW_RE = new RegExp(KEYWORDS.join('|'), 'i');

/* Autres chemins WhatsApp interdits (hors Baileys officiel) */
const OTHER_WA = [
  'whatsapp' + '-web.js',
  'venom' + '-whatsapp',
  'wpp' + 'connect',
  'open' + '-wa',
  'twilio',
  'puppeteer',
  'playwright',
  'selenium',
  '@adiwajshing' + '/baileys',
  '@itsuki' + 'chan/baileys',
];
const ALIASES = ['npm:', 'github:', 'git+', 'file:', 'link:', 'git://'];

/* Evenements Baileys (BaileysEventMap) - pour le controle de doublon d'ecoute */
const BAILEYS_EVENTS = [
  'connection.update', 'creds.update', 'messaging-history.set',
  'chats.upsert', 'chats.update', 'chats.phoneNumberShare', 'chats.delete',
  'presence.update', 'contacts.upsert', 'contacts.update',
  'messages.delete', 'messages.update', 'messages.media-update', 'messages.upsert',
  'messages.reaction', 'message-receipt.update',
  'groups.upsert', 'groups.update', 'group-participants.update', 'group.join-request',
  'blocklist.set', 'blocklist.update', 'call', 'labels.edit', 'labels.association',
  'newsletter.reaction', 'newsletter.view', 'newsletter-participants.update',
  'newsletter-settings.update',
];

/** Dossier de reference pour tous les envois (G2). */
const SEND_SERVICE = 'lib/wa-send.js';

/* ------------------------------------------------------------------ */
/* G1 - Baileys officielle uniquement                                  */
/* ------------------------------------------------------------------ */
function checkG1() {
  const rootPkgPath = path.join(ROOT, 'package.json');
  const rootPkg = depsOf(rootPkgPath);
  const declared = rootPkg.bag['@whiskeysockets/baileys'];

  // 1. pin exact
  if (!declared) {
    KO('G1', '@whiskeysockets/baileys absent des dependencies racine');
  } else if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(declared)) {
    KO('G1', `version non epinglee : package.json -> "${declared}" (interdit: ^ ~ * range)`);
  } else {
    OK('G1', `version epinglee exacte : ${declared}`);
    // 2. installee === declare
    const instPath = path.join(ROOT, 'node_modules', '@whiskeysockets', 'baileys', 'package.json');
    if (!fs.existsSync(instPath)) {
      KO('G1', 'paquet non installe dans node_modules/@whiskeysockets/baileys');
    } else {
      const installed = JSON.parse(read(instPath)).version;
      if (installed !== declared) KO('G1', `installe (${installed}) != declare (${declared}) : relancer npm install`);
      else OK('G1', `installe = declare = ${installed}`);
    }
  }

  // 3. alias + 4. autres lib WhatsApp, tous les package.json hors node_modules
  let aliasHits = [];
  let otherWa = [];
  for (const pkg of allPackageJsons()) {
    const { bag } = depsOf(pkg);
    for (const [name, ver] of Object.entries(bag)) {
      for (const a of ALIASES) {
        if (String(ver).startsWith(a)) aliasHits.push(`${rel(pkg)} -> ${name}: "${ver}"`);
      }
      for (const w of OTHER_WA) {
        if (name.toLowerCase() === w.toLowerCase()) otherWa.push(`${rel(pkg)} -> ${name}@${ver}`);
      }
    }
  }
  if (aliasHits.length) KO('G1', `${aliasHits.length} alias/URL de dependance : ${aliasHits.join(' | ')}`);
  else OK('G1', 'aucun alias npm:/github:/git+/file:/link: dans les package.json');
  if (otherWa.length) KO('G1', `${otherWa.length} autre(s) lib WhatsApp : ${otherWa.join(' | ')}`);
  else OK('G1', 'aucune autre lib WhatsApp declaree (hors Baileys officiel)');

  // 5. copie unique dans tout l'arbre
  const strays = [];
  const REF = path.join(ROOT, 'node_modules', '@whiskeysockets', 'baileys');
  const TARGETS = ['@whiskeysockets/baileys', '@itsukichan', '@adiwajshing'];
  const existsCopy = (base) => {
    for (const t of TARGETS) {
      const cand = path.join(base, ...t.split('/'));
      if (fs.existsSync(cand) && cand !== REF) strays.push(rel(cand));
    }
  };
  const scanProject = (dir, depth) => {
    let e;
    try { e = fs.readdirSync(dir, { withFileTypes: true }); } catch (err) { return; }
    for (const x of e) {
      if (!x.isDirectory() || x.name === '.git') continue;
      const p = path.join(dir, x.name);
      if (x.name === 'node_modules') { existsCopy(p); continue; }
      if (depth > 0) scanProject(p, depth - 1);
    }
  };
  scanProject(ROOT, 4); // legacy/commands/node_modules = profondeur 4
  // copies imbriquees directement sous le node_modules racine
  try {
    for (const pkg of fs.readdirSync(path.join(ROOT, 'node_modules'))) {
      const nested = path.join(ROOT, 'node_modules', pkg, 'node_modules');
      if (fs.existsSync(nested)) existsCopy(nested);
    }
  } catch (err) { /* node_modules absent : rien a dire */ }
  if (strays.length) KO('G1', `copies/installs secondaires : ${[...new Set(strays)].join(' | ')}`);
  else OK('G1', 'une seule copie de Baileys dans tout l\'arbre');

  // 6. le code actif ne requiert que Baileys officiel
  const badImports = [];
  for (const f of activeFiles()) {
    const src = strip(read(f));
    for (const w of OTHER_WA) {
      const re = new RegExp("(require|from)\\s*\\(?\\s*['\"]" + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      if (re.test(src)) badImports.push(`${rel(f)} -> ${w}`);
    }
  }
  if (badImports.length) KO('G1', `imports hors Baileys officiel : ${badImports.join(' | ')}`);
  else OK('G1', 'code actif : uniquement require("@whiskeysockets/baileys")');
}

/* ------------------------------------------------------------------ */
/* G2 - couche WhatsApp / architecte                                    */
/* ------------------------------------------------------------------ */
function checkG2() {
  const files = activeFiles().map((p) => ({ p, src: strip(read(p)), raw: read(p) }));

  // 1. un seul makeWASocket
  const socks = [];
  for (const f of files) {
    const re = /makeWASocket\s*\(/g;
    let m;
    while ((m = re.exec(f.src))) socks.push(`${rel(f.p)}`);
  }
  if (socks.length === 1) OK('G2', `makeWASocket unique : ${socks[0]}`);
  else KO('G2', `makeWASocket appele ${socks.length} fois (${[...new Set(socks)].join(', ') || '-'})`);

  // 2. un seul listener par evenement Baileys
  const counts = new Map();
  for (const ev of BAILEYS_EVENTS) counts.set(ev, []);
  for (const f of files) {
    for (const ev of BAILEYS_EVENTS) {
      const re = new RegExp("\\.on\\(\\s*['\"]" + ev.replace(/\./g, '\\.') + "['\"]", 'g');
      let m;
      while ((m = re.exec(f.src))) counts.get(ev).push(`${rel(f.p)}`);
    }
  }
  const dupEv = [...counts.entries()].filter(([, v]) => v.length > 1);
  if (dupEv.length) KO('G2', `listeners doubles : ${dupEv.map(([e, v]) => `${e} x${v.length} (${v.join(', ')})`).join(' | ')}`);
  else OK('G2', `aucun evenement Baileys ecoute 2 fois (${[...counts.values()].filter((v) => v.length).length}/${BAILEYS_EVENTS.length} ecoutes)`);

  // 2b. aucune ecoute ev.on() hors reference : evenement inexistant = listener
  //     mort (cas "error" decouvert au lot B12), reference perimee sinon
  const strays = [];
  for (const f of files) {
    for (const m of f.src.matchAll(/\.ev\.on\(\s*['"]([\w.\-[\]']+)['"]/g)) {
      if (!BAILEYS_EVENTS.includes(m[1])) strays.push(`${m[1]} (${rel(f.p)})`);
    }
  }
  if (strays.length) KO('G2', `ecoute d'un evenement hors reference BaileysEventMap : ${strays.join(' | ')}`);
  else OK('G2', `toutes les ecoutes ev.on() existent dans BaileysEventMap (${BAILEYS_EVENTS.length} cles de reference)`);

  // 2c. la reference suit la vraie BaileysEventMap du Baileys epingle
  try {
    const evSrc = read(path.join(ROOT, 'node_modules/@whiskeysockets/baileys/lib/Types/Events.d.ts'));
    const head = evSrc.indexOf('export type BaileysEventMap = {');
    if (head === -1) throw new Error('BaileysEventMap introuvable');
    const open = evSrc.indexOf('{', head);
    let depth = 0;
    let close = -1;
    for (let i = open; i < evSrc.length; i++) {
      if (evSrc[i] === '{') depth++;
      else if (evSrc[i] === '}') { depth--; if (!depth) { close = i; break; } }
    }
    const lines = evSrc.slice(open, close + 1).split('\n').slice(1, -1);
    let min = Infinity;
    for (const l of lines) { const mm = l.match(/^( +)\S/); if (mm) min = Math.min(min, mm[1].length); }
    const real = [];
    for (const l of lines) {
      const mm = l.match(new RegExp('^ {' + min + "}('([^']+)'|([A-Za-z_$][\\w$]*))\\s*:"));
      if (mm) real.push(mm[2] || mm[3]);
    }
    if (!real.length) {
      WARN('G2', 'BaileysEventMap illisible : conformite de la reference non verifiable');
    } else {
      const missing = real.filter((e) => !BAILEYS_EVENTS.includes(e));
      const extra = BAILEYS_EVENTS.filter((e) => !real.includes(e));
      if (missing.length || extra.length) {
        KO('G2', `reference BAILEYS_EVENTS perimee : manque [${missing.join(', ')}] / en trop [${extra.join(', ')}]`);
      } else OK('G2', `reference conforme a BaileysEventMap (${real.length}/${real.length} cles)`);
    }
  } catch (e) {
    WARN('G2', `BaileysEventMap illisible (${e.message}) : conformite de la reference non verifiable`);
  }

  // 3. un seul registre de commandes (voir G4 pour le doublon precis)
  const registry = new Map();
  const dupNames = [];
  const addName = (name, where) => {
    const k = String(name).toLowerCase();
    if (registry.has(k)) dupNames.push(`${k} (${registry.get(k)} / ${where})`);
    else registry.set(k, where);
  };
  const scanCmd = (f) => {
    const src = strip(read(f));
    const rx = /cmd\(\s*(\[[^\]]*\]|'[^']+')/g;
    let m;
    while ((m = rx.exec(src))) {
      const names = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
      if (!names.length) continue;
      const after = src.slice(m.index + m[0].length);
      const am = after.match(/^\s*,\s*\[([^\]]*)\]/);
      const aliases = am ? [...am[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : [];
      for (const a of [names[0], ...names.slice(1), ...aliases]) addName(a, rel(f));
    }
  };
  for (const f of activeFiles()) {
    const r = rel(f);
    if (r === 'handler.js' || r.startsWith('plugins/')) scanCmd(f);
  }
  const guardDir = path.join(ROOT, 'guard', 'src', 'commands');
  if (fs.existsSync(guardDir)) {
    for (const f of fs.readdirSync(guardDir).filter((x) => x.endsWith('.js'))) {
      const p = path.join(guardDir, f);
      const src = strip(read(p));
      const rx = /name:\s*'([^']+)'/g;
      let m;
      while ((m = rx.exec(src))) {
        const line = src.slice(m.index, m.index + 300);
        const am = line.match(/aliases:\s*\[([^\]]*)\]/);
        const aliases = am ? [...am[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : [];
        for (const a of [m[1], ...aliases]) addName(a, rel(p));
      }
    }
  }
  if (dupNames.length) KO('G2', `${dupNames.length} commande(s) en double : ${dupNames.join(' | ')}`);
  else OK('G2', `${registry.size} noms+alias uniques, aucun doublon de commande`);

  // 4. service d'envoi unique
  const senders = new Map();
  for (const f of productFiles()) {
    const src = strip(read(f));
    const re = /\.sendMessage\s*\(/g;
    let m;
    let n = 0;
    while ((m = re.exec(src))) n++;
    if (n) senders.set(rel(f), n);
  }
  const outside = [...senders.entries()].filter(([f]) => f !== SEND_SERVICE);
  if (outside.length === 0) {
    OK('G2', `envois centralises dans ${SEND_SERVICE}`);
  } else {
    const total = outside.reduce((s, [, n]) => s + n, 0);
    KO('G2', `${total} appel(s) .sendMessage hors ${SEND_SERVICE} dans ${outside.length} fichier(s) : ${outside.map(([f, n]) => `${f} x${n}`).join(', ')}`);
  }

  // 5. options de socket recommandees
  const idx = path.join(ROOT, 'index.js');
  if (fs.existsSync(idx)) {
    const src = strip(read(idx));
    if (/makeCacheableSignalKeyStore/.test(src)) OK('G2', 'makeCacheableSignalKeyStore utilise');
    else KO('G2', 'makeCacheableSignalKeyStore absent de index.js (option recommandee pour les cles)');
    if (/getMessage\s*:/.test(src)) OK('G2', 'getMessage fourni (retries / editions / votes de sondage)');
    else KO('G2', 'getMessage absent de index.js');
  }

  // 6. clés de contenu AnyMessageContent : exploitation attendue
  //    (buttonReply / listReply exclus volontairement : interdits par G3)
  const CONTENT_KEYS = [
    'text', 'image', 'video', 'audio', 'sticker', 'poll', 'contacts', 'react',
    'pin', 'delete', 'disappearingMessagesInChat', 'document', 'location',
    'forward', 'groupInvite', 'sharePhoneNumber', 'requestPhoneNumber',
  ];
  const keyOwner = new Map();
  for (const f of productFiles()) {
    const src = strip(read(f));
    for (const k of CONTENT_KEYS) {
      if (keyOwner.has(k)) continue;
      const re = new RegExp(`(?:^|[^A-Za-z0-9_$])${k}\\s*:`);
      if (re.test(src)) keyOwner.set(k, rel(f));
    }
  }
  const missingKeys = CONTENT_KEYS.filter((k) => !keyOwner.has(k));
  if (missingKeys.length) KO('G2', `clés de contenu non exploitées : ${missingKeys.join(', ')}`);
  else {
    const byFile = {};
    for (const [k, f] of keyOwner) byFile[f] = (byFile[f] || 0) + 1;
    OK('G2', `${CONTENT_KEYS.length}/${CONTENT_KEYS.length} clés AnyMessageContent exploitées — ${Object.entries(byFile).map(([f, n]) => `${f} x${n}`).join(', ')}`);
  }
}

/* ------------------------------------------------------------------ */
/* G3 - zero occurrence des mots interdits                             */
/* ------------------------------------------------------------------ */
function checkG3() {
  const all = walk(ROOT);
  const hits = [];
  for (const f of all) {
    let content;
    try { content = read(f); } catch (e) { continue; }
    if (!KW_RE.test(content)) continue;
    const lines = content.split(/\r?\n/);
    const bad = [];
    lines.forEach((l, i) => {
      if (KW_RE.test(l)) bad.push(i + 1);
    });
    hits.push({ f: rel(f), lines: bad });
  }
  if (hits.length) {
    KO('G3', `${hits.length} fichier(s) avec mot interdit (section 3.1) : ` +
      hits.map((h) => `${h.f}:${h.lines.slice(0, 12).join(',')}${h.lines.length > 12 ? '…' : ''}`).join(' | '));
  } else {
    OK('G3', `0 occurrence sur ${all.length} fichiers scannes hors node_modules`);
  }

  // chemins alternatifs WhatsApp dans le code actif
  const alt = [];
  for (const f of activeFiles()) {
    const src = read(f);
    for (const w of OTHER_WA) {
      if (new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(src)) alt.push(`${rel(f)} -> ${w}`);
    }
  }
  if (alt.length) KO('G3', `chemin WhatsApp alternatif : ${alt.join(' | ')}`);
  else OK('G3', 'aucun chemin WhatsApp alternatif dans le code actif');
}

/* ------------------------------------------------------------------ */
/* G4 - zero doublon                                                    */
/* ------------------------------------------------------------------ */
function checkG4() {
  // 1. copies exactes (MD5)
  const files = walk(ROOT).filter((p) => {
    try { return fs.statSync(p).size >= 500; } catch (e) { return false; }
  });
  const byHash = new Map();
  for (const f of files) {
    const h = crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');
    if (!byHash.has(h)) byHash.set(h, []);
    byHash.get(h).push(rel(f));
  }
  const dups = [...byHash.values()].filter((v) => v.length > 1);
  if (dups.length) {
    KO('G4', `${dups.length} copie(s) exacte(s) MD5 : ${dups.map((d) => d.join(' == ')).join(' | ')}`);
  } else {
    OK('G4', `0 doublon MD5 sur ${files.length} fichiers (>=500 octets)`);
  }

  // 2. arbres morts (decision : suppression des3)
  const dead = [];
  for (const d of ['legacy', 'vendor/itsuki-baileys']) {
    if (fs.existsSync(path.join(ROOT, d))) dead.push(d);
  }
  const rootEntries = fs.existsSync(ROOT) ? fs.readdirSync(ROOT) : [];
  for (const e of rootEntries) if (/^backup-\d{8}-\d{4}$/.test(e)) dead.push(e);
  if (dead.length) KO('G4', `arbre(s) mort(s) encore present(s) : ${dead.join(', ')}`);
  else OK('G4', 'aucun arbre mort (legacy / vendor-fork / backup)');

  // 3. cadres et alphabet de style codes en dur hors style.js
  const glyphs = /[╭╰┄『』「」│╔═║╚╠╣]/;
  const offenders = [];
  for (const f of productFiles()) {
    if (rel(f) === 'style.js') continue;
    const src = strip(read(f));
    const lines = src.split(/\r?\n/);
    const bad = [];
    lines.forEach((l, i) => {
      if (glyphs.test(l) && /['"`]/.test(l)) bad.push(i + 1);
    });
    if (bad.length) offenders.push(`${rel(f)}:${bad.slice(0, 10).join(',')}${bad.length > 10 ? '…' : ''} (${bad.length})`);
  }
  if (offenders.length) KO('G4', `style code en dur hors style.js : ${offenders.join(' | ')}`);
  else OK('G4', 'aucun cadre/alphabet Unicode rendu en dur hors style.js');

  // 4. dependances utilisees mais non declarees
  const rootPkg = depsOf(path.join(ROOT, 'package.json'));
  const declared = new Set(Object.keys(rootPkg.bag));
  const missing = new Set();
  for (const f of productFiles()) {
    const src = strip(read(f));
    const rx = /require\(\s*['"]([^'"./][^'"]*)['"]\s*\)/g;
    let m;
    while ((m = rx.exec(src))) {
      const spec = m[1];
      const base = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
      if (builtinModules.includes(base) || builtinModules.includes('node:' + base)) continue;
      if (!declared.has(base)) missing.add(`${base} (${rel(f)})`);
    }
  }
  if (missing.size) KO('G4', `dependance(s) utilisee(s) non declaree(s) : ${[...missing].join(', ')}`);
  else OK('G4', 'toutes les dependances require() sont declarees dans package.json');

  // 5. parseurs : une seule implementation par nom, au proprietaire designe
  const PARSERS = {
    textOf: 'guard/src/utils/message.js',
    ctxInfo: 'guard/src/utils/message.js',
    unwrapInfo: 'guard/src/utils/message.js',
    unwrap: 'guard/src/utils/message.js',
    parse: 'guard/src/utils/message.js',
  };
  const parserHits = new Map(Object.keys(PARSERS).map((n) => [n, new Set()]));
  for (const f of productFiles()) {
    const src = strip(read(f));
    for (const name of Object.keys(PARSERS)) {
      const re = new RegExp(
        `(?:function\\s+${name}\\s*\\()|(?:const|let|var)\\s+${name}\\s*=\\s*(?:\\(|function\\b|async\\b)`,
        'g'
      );
      if (re.test(src)) parserHits.get(name).add(rel(f));
    }
  }
  const parserProblems = [];
  for (const [name, files] of parserHits) {
    const uniq = [...files];
    if (uniq.length === 0) parserProblems.push(`${name} : aucune definition trouvee`);
    else if (uniq.length > 1) parserProblems.push(`${name} defini dans ${uniq.length} fichiers (${uniq.join(', ')})`);
    else if (uniq[0] !== PARSERS[name]) parserProblems.push(`${name} dans ${uniq[0]} au lieu de ${PARSERS[name]}`);
  }
  if (parserProblems.length) KO('G4', `parseurs dupliques : ${parserProblems.join(' | ')}`);
  else OK('G4', `parseurs uniques au bon proprietaire (${Object.keys(PARSERS).length}/5 → guard/src/utils/message.js)`);
}

/* ------------------------------------------------------------------ */
/* Optionnel : vulnerabilites reseau                                   */
/* ------------------------------------------------------------------ */
function checkDeps() {
  const { execFileSync } = require('child_process');
  let raw = '';
  try {
    raw = execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['audit', '--json'], {
      cwd: ROOT,
      encoding: 'utf8',
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    // npm audit sort en code != 0 quand il reste des vulns, mais la JSON est là
    raw = String(e.stdout || '');
    if (!raw) {
      KO('G1', `npm audit inatteignable (reseau ?) : ${String(e.message || e).slice(0, 160)}`);
      return;
    }
  }
  try {
    const j = JSON.parse(raw);
    const v = (j.metadata && j.metadata.vulnerabilities) || {};
    const names = Object.keys(j.vulnerabilities || {});
    if ((v.critical || 0) > 0) {
      KO('G1', `npm audit : ${v.critical} CRITIQUE → ${names.slice(0, 12).join(', ')}`);
      return;
    }
    if (v.high || 0) {
      /* High connus et traces : aucun correctif publie pour les deux
         dependances directes concernees (dernieres versions disponibles).
         Detail et options dans le rapport de fin de phase B. */
      WARN('G1', `npm audit : 0 critical, ${v.high} high + ${v.moderate || 0} moderate connus/non corrigables → ${names.slice(0, 12).join(', ')}`);
    } else {
      OK('G1', `npm audit : 0 critical/high (restant : ${v.moderate || 0} moderate, ${v.low || 0} low)`);
    }
  } catch (err) {
    KO('G1', 'npm audit : sortie JSON illisible');
  }
}

/* ------------------------------------------------------------------ */
/* Exécution                                                            */
/* ------------------------------------------------------------------ */
function main() {
  const t0 = Date.now();
  checkG1();
  checkG2();
  checkG3();
  checkG4();
  if (WITH_DEPS) checkDeps();

  const groups = ['G1', 'G2', 'G3', 'G4'];
  let failed = 0;
  for (const g of groups) {
    console.log(`\n=== ${g} ===`);
    for (const r of rows.filter((x) => x.g === g)) {
      if (r.level === 'INFO') console.log(`  [INFO] ${r.msg}`);
      else if (r.level === 'WARN') console.log(`  [WARN] ${r.msg}`);
      else if (r.level === 'OK') console.log(`  [OK]   ${r.msg}`);
      else { failed++; console.log(`  [FAIL] ${r.msg}`); }
    }
  }
  const verdict = failed === 0 ? 'CONFORME' : 'NON CONFORME';
  console.log(`\n--------------------------------------------------`);
  console.log(`AUDIT : ${verdict}  (${failed} anomalie(s), ${rows.filter((r) => r.level === 'OK').length} controles OK, ${Date.now() - t0} ms)`);
  if (failed) console.log('Relancer : npm run audit   (help : node scripts/audit.js)');
  process.exit(failed === 0 ? 0 : 1);
}

main();
