#!/usr/bin/env node
'use strict';
/**
 * migrate-structure.js — DJOUSSE-TECH-MD : passage à l'arborescence
 *
 *   src/{config,handlers,lib,plugins,guard,ludo,assets}   code du bot
 *   web/{public,api,scripts}                              site + API Vercel
 *   deployment/                                           Docker, Fly, Render...
 *   storage/{sessions,data,logs,downloads,bin}            fichiers générés
 *
 * Usage (depuis la racine du projet, bot ARRÊTÉ) :
 *   node migrate-structure.js            simulation : n'écrit rien, affiche le plan
 *   node migrate-structure.js --apply    exécute la migration
 *
 * Sans dépendance. Conserve les fins de ligne (CRLF/LF) des fichiers.
 * Tous les contrôles sont faits AVANT la première écriture : si un motif
 * attendu est introuvable, rien n'est modifié.
 */
const fs = require('fs');
const path = require('path');

const APPLY = process.argv.includes('--apply');
const ROOT = process.cwd();
const posix = (p) => p.split(path.sep).join('/');

/* ─────────────── 1. Table de correspondance ancien → nouveau ─────────────── */
const EXACT = {
  'config.js': 'src/config/config.js', config: 'src/config/config',
  'style.js': 'src/config/style.js', style: 'src/config/style',
  'handler.js': 'src/handlers/handler.js', handler: 'src/handlers/handler',
  Dockerfile: 'deployment/Dockerfile',
  'docker-compose.yml': 'deployment/docker-compose.yml',
  'fly.toml': 'deployment/fly.toml',
  'render.yaml': 'deployment/render.yaml',
  'vercel.json': 'deployment/vercel.json',
  '.dockerignore': 'deployment/Dockerfile.dockerignore',
  'AMELIORATIONS.md': 'docs/notes/AMELIORATIONS.md',
  'CHANGELOG.md': 'docs/notes/CHANGELOG.md',
  'DIAGNOSTIC.md': 'docs/notes/DIAGNOSTIC.md',
  'liste-commandes.txt': 'docs/reference/liste-commandes.txt',
  'fix-dashboard.cjs': 'scripts/archive/fix-dashboard.cjs',
  'fix-dashboard-v2.cjs': 'scripts/archive/fix-dashboard-v2.cjs',
  'fix-dashboard-v3.cjs': 'scripts/archive/fix-dashboard-v3.cjs',
  'index.js.backup': '_archive/index.js.backup',
  'style.js.backup': '_archive/style.js.backup',
  'test.txt': '_archive/test.txt',
  'scripts/site-icons.js': 'web/scripts/site-icons.js',
  'website/vercel.json': 'web/vercel.json',
};
const PREFIX = [ // l'ordre compte : le plus précis d'abord
  ['plugins/data/', 'storage/data/plugins/'],
  ['plugins/', 'src/plugins/'],
  ['lib/', 'src/lib/'],
  ['guard/src/', 'src/guard/'],
  ['guard/', 'src/guard/'],
  ['ludo/', 'src/ludo/'],
  ['assets/', 'src/assets/'],
  ['website/api/', 'web/api/'],
  ['website/', 'web/public/'],
  ['sessions/', 'storage/sessions/'],
  ['data/', 'storage/data/'],
  ['logs/', 'storage/logs/'],
  ['downloads/', 'storage/downloads/'],
  ['vendor/', 'storage/bin/'],
];
function mapPath(p) {
  if (Object.prototype.hasOwnProperty.call(EXACT, p)) return EXACT[p];
  const q = p + '/';
  for (const [from, to] of PREFIX) {
    if (q.startsWith(from)) return (to + q.slice(from.length)).replace(/\/$/, '');
  }
  return p;
}

/* ─────────────── 2. Inventaire des fichiers ─────────────── */
const SKIP_DIRS = new Set(['node_modules', '.git', '.vercel']);
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(path.join(dir, e.name), out);
    } else if (e.isFile()) out.push(posix(path.relative(ROOT, path.join(dir, e.name))));
  }
  return out;
}

const problems = [];
const warnings = [];
const info = [];

if (!fs.existsSync(path.join(ROOT, 'index.js')) || !fs.existsSync(path.join(ROOT, 'handler.js'))) {
  console.error('ERREUR : lance ce script à la racine du projet (index.js et handler.js introuvables).');
  process.exit(1);
}
if (fs.existsSync(path.join(ROOT, 'src', 'handlers'))) {
  console.error('ERREUR : la migration semble déjà faite (src/handlers existe).');
  process.exit(1);
}

// Pré-vol : refuse de migrer si le bot tourne encore (fichiers verrouillés sous Windows)
for (const pidFile of ['logs/bot.pid', 'storage/logs/bot.pid', 'logs/bot.watch.pid', 'storage/logs/bot.watch.pid', 'logs/bot_watch.pid', 'storage/logs/bot_watch.pid']) {
  try {
    const pid = parseInt(fs.readFileSync(path.join(ROOT, pidFile), 'utf8').trim(), 10);
    if (pid) { process.kill(pid, 0); console.error(`ERREUR : le bot semble tourner (PID ${pid}, ${pidFile}). Arrête-le : node scripts/service.js bot stop`); process.exit(1); }
  } catch (e) { if (e.code === 'EPERM') { console.error(`ERREUR : processus actif (${pidFile}). Arrête le bot d'abord.`); process.exit(1); } }
}

const files = walk(ROOT).filter((f) => f !== 'migrate-structure.js');
const plan = files.map((f) => ({ old: f, neu: mapPath(f) }));
const oldToNew = new Map(plan.map((x) => [x.old, x.neu]));
const newToOld = new Map(plan.map((x) => [x.neu, x.old]));
for (const [n, o] of newToOld) {
  const dup = plan.filter((x) => x.neu === n);
  if (dup.length > 1) problems.push(`collision : ${dup.map((d) => d.old).join(' + ')} → ${n}`);
}
// Un fichier de destination déjà présent (hors déplacement) = collision
for (const x of plan) {
  if (x.old !== x.neu && !oldToNew.has(x.neu) && fs.existsSync(path.join(ROOT, x.neu))) {
    problems.push(`destination déjà occupée : ${x.neu}`);
  }
}

/* ─────────────── 3. Contenus (lus depuis l'ancien emplacement) ─────────────── */
const content = new Map(); // nouveau chemin → texte modifié
const readNew = (neu) => (content.has(neu) ? content.get(neu)
  : fs.readFileSync(path.join(ROOT, newToOld.get(neu) || neu), 'utf8'));
const setNew = (neu, txt) => content.set(neu, txt);

const isNodeJs = (f) => /\.(js|cjs|mjs)$/.test(f) && !f.startsWith('web/public/') && !f.startsWith('website/');
let rewrittenSpecs = 0;
const unresolved = [];

for (const { old, neu } of plan) {
  if (!isNodeJs(old)) continue;
  const src = fs.readFileSync(path.join(ROOT, old), 'utf8');
  const out = src.replace(
    /\brequire(\.resolve)?\(\s*(['"])(\.{1,2}(?:\/[^'"\n]*)?)\2\s*\)/g,
    (all, resolveFn, quote, spec) => {
      const targetOld = path.posix.normalize(path.posix.join(path.posix.dirname(old), spec));
      const targetNew = mapPath(targetOld);
      let rel = path.posix.relative(path.posix.dirname(neu), targetNew);
      if (!rel.startsWith('.')) rel = './' + rel;
      if (/\/$/.test(spec) && !rel.endsWith('/')) rel += '/';
      if (rel === spec) return all;
      if (targetOld === '.' || targetOld === '..') { unresolved.push(`${old}: ${spec}`); return all; }
      rewrittenSpecs++;
      return `require${resolveFn || ''}(${quote}${rel}${quote})`;
    },
  );
  if (out !== src) setNew(neu, out);
}

/* ─────────────── 4. Patches ciblés (chemins non couverts par require) ─────────────── */
function patch(neu, rules, { optional = false } = {}) {
  if (!newToOld.has(neu) && !fs.existsSync(path.join(ROOT, neu))) {
    (optional ? warnings : problems).push(`fichier absent pour patch : ${neu}`);
    return;
  }
  let txt = readNew(neu);
  for (const [from, to, label] of rules) {
    const before = txt;
    txt = typeof from === 'string' ? txt.split(from).join(to) : txt.replace(from, to);
    if (txt === before) (optional ? warnings : problems).push(`motif introuvable dans ${neu} : ${label || String(from).slice(0, 60)}`);
  }
  setNew(neu, txt);
}

/* paths.js — source unique des dossiers (nouveau fichier) */
const PATHS_JS = `'use strict';
/**
 * src/config/paths.js — source unique des chemins du projet.
 * ROOT = racine du dépôt (là où se trouvent index.js et package.json).
 */
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'src');
const STORAGE = path.join(ROOT, 'storage');
const DATA = path.join(STORAGE, 'data');

module.exports = {
  ROOT,
  SRC,
  ASSETS: path.join(SRC, 'assets'),
  WEB: path.join(ROOT, 'web'),
  WEB_PUBLIC: path.join(ROOT, 'web', 'public'),
  STORAGE,
  SESSIONS: path.join(STORAGE, 'sessions'),
  DATA,
  PLUGIN_DATA: path.join(DATA, 'plugins'),
  LOGS: path.join(STORAGE, 'logs'),
  DOWNLOADS: path.join(STORAGE, 'downloads'),
  BIN: path.join(STORAGE, 'bin'),
};
`;
setNew('src/config/paths.js', PATHS_JS);
const relTo = (fromNeu, toNeu) => {
  let r = path.posix.relative(path.posix.dirname(fromNeu), toNeu);
  return r.startsWith('.') ? r : './' + r;
};
const pathsReq = (fromNeu) => `require('${relTo(fromNeu, 'src/config/paths')}')`;

// config.js : dossiers par défaut
patch('src/config/config.js', [
  ["process.env.SESSION_DIR || 'sessions/djsession'", "process.env.SESSION_DIR || 'storage/sessions/djsession'", 'sessionDir'],
  ["process.env.DATA_DIR || 'data'", "process.env.DATA_DIR || 'storage/data'", 'dataDir'],
]);

// handler.js : assets, downloads, .env, vendor, racine
const H = 'src/handlers/handler.js';
patch(H, [
  [/(const config = require\('\.\.\/config\/config'\);)/, `$1\nconst P = ${pathsReq(H)};`, 'insertion P'],
  ["path.join(__dirname, 'downloads')", "P.DOWNLOADS", 'DOWNLOAD_DIR'],
  ["path.join(__dirname, 'assets', ", "path.join(P.ASSETS, ", 'assets x4'],
  ["path.join(__dirname, 'assets')", "P.ASSETS", 'assets dir'],
  ["path.resolve(__dirname, config.menuPicturePath)", "path.resolve(P.ROOT, config.menuPicturePath)", 'menuPicturePath'],
  ["path.join(__dirname, '.env')", "path.join(P.ROOT, '.env')", 'ENV_PATH'],
  ["path.resolve(__dirname, config.sessionDir)", "path.resolve(P.ROOT, config.sessionDir)", 'sessionDir'],
  ["path.join(__dirname, 'vendor', ", "path.join(P.BIN, ", 'YTDLP_BIN'],
]);

// lib : racine, site, sessions, téléchargements, chargeur de plugins
patch('src/lib/dataDir.js', [
  ["const ROOT = path.join(__dirname, '..');", `const ROOT = ${pathsReq('src/lib/dataDir.js')}.ROOT;`, 'ROOT'],
]);
patch('src/lib/pairing-api.js', [
  ["const ROOT = path.join(__dirname, '..');", `const ROOT = ${pathsReq('src/lib/pairing-api.js')}.ROOT;`, 'ROOT'],
  ["path.join(ROOT, 'website')", "path.join(ROOT, 'web', 'public')", 'site'],
]);
patch('src/lib/missing.js', [
  ["path.join(process.cwd(), 'sessions', name)", "path.join(process.cwd(), 'storage', 'sessions', name)", 'sessions/name'],
  ["path.join(process.cwd(), 'sessions')", "path.join(process.cwd(), 'storage', 'sessions')", 'sessions'],
  ['SESSION_DIR=sessions/${name}', 'SESSION_DIR=storage/sessions/${name}', 'texte SESSION_DIR'],
]);
patch('src/lib/extras.js', [
  ["path.join(root, 'sessions')", "path.join(root, 'storage', 'sessions')", 'multi'],
  ['SESSION_DIR=sessions/compte2', 'SESSION_DIR=storage/sessions/compte2', 'texte'],
]);
patch('src/lib/plugin-loader.js', [
  ["path.join(process.cwd(), 'plugins', 'core')", "path.join(process.cwd(), 'src', 'plugins', 'core')", 'core'],
  ["path.join(process.cwd(), 'plugins', 'silva')", "path.join(process.cwd(), 'src', 'plugins', 'silva')", 'silva'],
]);
patch('src/lib/ported-auto.js', [
  ["path.join(process.cwd(), 'downloads', 'statuts')", "path.join(process.cwd(), 'storage', 'downloads', 'statuts')", 'statuts'],
]);

// plugins : données persistantes → storage/data/plugins
let pluginDataEdits = 0;
for (const { neu } of plan) {
  if (!neu.startsWith('src/plugins/') || !/\.js$/.test(neu)) continue;
  let txt = readNew(neu);
  const P_ = pathsReq(neu);
  const t0 = txt;
  txt = txt
    .replace(/path\.join\(__dirname,\s*(['"])\.\.\/data\/([^'"]+)\1\)/g, (m, q, sub) => `path.join(${P_}.PLUGIN_DATA, ${q}${sub}${q})`)
    .replace(/path\.join\(__dirname,\s*(['"])\.\.\/data\1\)/g, () => `${P_}.PLUGIN_DATA`)
    .replace(/path\.join\(__dirname,\s*(['"])\.\.\1,\s*(['"])data\2,\s*(['"])([^'"]+)\3\)/g, (m, a, b, q, sub) => `path.join(${P_}.PLUGIN_DATA, ${q}${sub}${q})`)
    .replace(/path\.join\(__dirname,\s*(['"])\.\.\1,\s*(['"])data\2\)/g, () => `${P_}.PLUGIN_DATA`)
    .replace(/require\('path'\)\.join\(__dirname,\s*(['"])\.\.\/data\/([^'"]+)\1\)/g, (m, q, sub) => `require('path').join(${P_}.PLUGIN_DATA, ${q}${sub}${q})`);
  if (txt !== t0) { pluginDataEdits++; setNew(neu, txt); }
}
const leftoverData = [];
for (const { neu } of plan) {
  if (!neu.startsWith('src/plugins/') || !/\.js$/.test(neu)) continue;
  const lines = readNew(neu).split(/\r?\n/);
  lines.forEach((l, i) => { if (/__dirname/.test(l) && /data/.test(l) && !/PLUGIN_DATA/.test(l)) leftoverData.push(`${neu}:${i + 1}: ${l.trim().slice(0, 110)}`); });
}
if (leftoverData.length) warnings.push(`plugins : chemins de données non réécrits (à vérifier) :\n    ${leftoverData.join('\n    ')}`);

// scripts
patch('scripts/service.js', [
  ["path.join(ROOT, 'logs')", "path.join(ROOT, 'storage', 'logs')", 'LOG_DIR'],
]);
patch('scripts/menu-image.js', [
  ["'assets/menu-hacker.jpg'", "'src/assets/menu-hacker.jpg'", 'sortie par défaut'],
  ['sortie assets/menu-hacker.jpg', 'sortie src/assets/menu-hacker.jpg', 'commentaire'],
], { optional: true });
patch('web/scripts/site-icons.js', [
  ["const ROOT = path.join(__dirname, '..');", "const ROOT = path.join(__dirname, '..', '..');", 'ROOT'],
  ["path.join(ROOT, 'website', 'logo.svg')", "path.join(ROOT, 'web', 'public', 'assets', 'logo.svg')", 'svg'],
  ["path.join(ROOT, 'website', 'icons')", "path.join(ROOT, 'web', 'public', 'assets', 'icons')", 'icons'],
]);
patch('scripts/audit.js', [
  ["const ACTIVE_ROOT_FILES = ['index.js', 'handler.js', 'config.js', 'style.js'];", "const ACTIVE_ROOT_FILES = ['index.js'];", 'ACTIVE_ROOT_FILES'],
  ["const ACTIVE_DIRS = ['lib', 'guard', 'plugins', 'ludo'];", "const ACTIVE_DIRS = ['src'];", 'ACTIVE_DIRS'],
  ["r === 'handler.js' || r.startsWith('plugins/') || r.startsWith('lib/')", "r === 'src/handlers/handler.js' || r.startsWith('src/plugins/') || r.startsWith('src/lib/')", 'scanCmd'],
  ["path.join(ROOT, 'guard', 'src', 'commands')", "path.join(ROOT, 'src', 'guard', 'commands')", 'guardDir'],
  ["rel(f) === 'style.js'", "rel(f) === 'src/config/style.js'", 'style.js'],
  ["rel(f).startsWith('plugins/core/')", "rel(f).startsWith('src/plugins/core/')", 'plugins/core'],
  ["path.join(ROOT, 'style.js')", "path.join(ROOT, 'src', 'config', 'style.js')", 'require style'],
  ["path.join(ROOT, 'handler.js')", "path.join(ROOT, 'src', 'handlers', 'handler.js')", 'read handler'],
  ["const { builtinModules } = require('module');", "const { builtinModules, isBuiltin } = require('module');", 'import isBuiltin'],
  ["if (builtinModules.includes(bare) || builtinModules.includes('node:' + bare)) continue;", "if (isBuiltin(spec) || builtinModules.includes(bare)) continue;", 'node:sqlite builtin'],
  ["const SEND_SERVICE = 'lib/wa-send.js';", "const SEND_SERVICE = 'src/lib/wa-send.js';", 'SEND_SERVICE'],
  ["const TIERS = ['plugins/core/', 'lib/plugin-loader.js'];", "const TIERS = ['src/plugins/core/', 'src/lib/plugin-loader.js'];", 'TIERS'],
  ["'guard/src/utils/message.js'", "'src/guard/utils/message.js'", 'PARSERS proprietaire'],
  ["→ guard/src/utils/message.js", "→ src/guard/utils/message.js", 'message parseurs'],
  ["'logs', 'tmp', 'temp', 'downloads', 'data', '.vercel']", "'logs', 'tmp', 'temp', 'downloads', 'data', 'storage', '.vercel', '_archive']", 'walk skip'],
]);
patch('test/handler-options.test.js', [
  ["require('./handler')", "require('./src/handlers/handler')", 'require embarque'],
]);
patch('test/public-mode.test.js', [
  ["path.join(ROOT, 'handler.js')", "path.join(ROOT, 'src', 'handlers', 'handler.js')", 'handler path'],
]);

// tests : chemins de fichiers déplacés
for (const { neu } of plan) {
  if (!neu.startsWith('test/') || !/\.js$/.test(neu)) continue;
  let txt = readNew(neu);
  const t0 = txt;
  txt = txt
    .replace(/path\.resolve\(__dirname,\s*'\.\.\/config\.js'\)/g, "path.resolve(__dirname, '../src/config/config.js')")
    .replace(/path\.join\(__dirname,\s*'\.\.',\s*'config\.js'\)/g, "path.join(__dirname, '..', 'src', 'config', 'config.js')")
    .replace(/path\.join\(process\.cwd\(\),\s*'plugins',\s*'core'\)/g, "path.join(process.cwd(), 'src', 'plugins', 'core')");
  if (txt !== t0) setNew(neu, txt);
}

// package.json
patch('package.json', [
  ['node --check handler.js && node --check config.js', 'node --check src/handlers/handler.js && node --check src/config/config.js', 'script check'],
]);

/* ─────────────── 5. Déploiement ─────────────── */
patch('deployment/Dockerfile', [
  [/VOLUME \["\/app\/sessions", "\/app\/data", "\/app\/logs"\]/, 'VOLUME ["/app/storage/sessions", "/app/storage/data", "/app/storage/logs"]', 'VOLUME'],
]);
patch('deployment/docker-compose.yml', [
  [/^    build: \.(\r?)$/m, '    build:$1\n      context: ..$1\n      dockerfile: deployment/Dockerfile$1', 'build'],
  ['env_file: .env', 'env_file: ../.env', 'env_file'],
  ['./sessions:/app/sessions', '../storage/sessions:/app/storage/sessions', 'vol sessions'],
  ['./data:/app/data', '../storage/data:/app/storage/data', 'vol data'],
  ['./logs:/app/logs', '../storage/logs:/app/storage/logs', 'vol logs'],
  ['./downloads:/app/downloads', '../storage/downloads:/app/storage/downloads', 'vol downloads'],
  ['#   docker compose up -d --build', '#   docker compose -f deployment/docker-compose.yml up -d --build', 'usage'],
  ['La session WhatsApp (./sessions), l\'état du bot (./data) et ses logs', 'La session WhatsApp (storage/sessions), l\'état du bot (storage/data) et ses logs', 'commentaire'],
]);
patch('deployment/render.yaml', [
  [/^(    runtime: docker)(\r?)$/m, '$1$2\n    dockerfilePath: ./deployment/Dockerfile$2\n    dockerContext: .$2', 'dockerfilePath'],
  ['# Render — service « worker »', '# Render — NB : renseigner « Blueprint Path » = deployment/render.yaml (Dashboard).\n# Render — service « worker »', 'note blueprint'],
]);
patch('deployment/fly.toml', [
  ['#   fly deploy\n', '#   fly deploy --config deployment/fly.toml --dockerfile deployment/Dockerfile\n', 'usage deploy'],
], { optional: true });
patch('deployment/vercel.json', [
  ['"outputDirectory": "website"', '"outputDirectory": "web/public"', 'outputDirectory'],
]);
patch('deployment/Dockerfile.dockerignore', [
  [/^(sessions|data|logs|downloads)\/(\r?)$/gm, 'storage/$2', 'etat vivant'],
  [/^website\/(\r?)$/m, 'web/$1', 'website'],
]);
patch('.replit', [
  ['hidden = ["node_modules", "sessions", "data", "logs", "downloads"]', 'hidden = ["node_modules", "storage", ".git"]', 'hidden'],
], { optional: true });

// .gitignore : réécrit
const NL = '\r\n';
setNew('.gitignore', [
  '# Dépendances', 'node_modules/', '',
  '# Secrets (jamais commités)', '.env', '.env.*', '!.env.example', '',
  '# Fichiers générés : session WhatsApp, état du bot, logs, téléchargements, binaires',
  'storage/', 'creds.json', 'lid-mapping-*.json', 'state.json', 'session.old-*/', '',
  '# Divers', 'tmp/', 'temp/', '*.log', '*.backup', '_archive/', '.DS_Store', 'Thumbs.db', '.vercel', '',
].join(NL));

// .env : chemins relatifs anciens → nouveaux (aucune valeur n'est affichée)
if (fs.existsSync(path.join(ROOT, '.env'))) {
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  let changed = 0;
  const out = env
    .replace(/^(SESSION_DIR\s*=\s*["']?)(?:\.\/)?(sessions?)(\/|["']?\s*$)/gm, (m, a, b, c) => { changed++; return `${a}storage/sessions${c}`; })
    .replace(/^(DATA_DIR\s*=\s*["']?)(?:\.\/)?data(\/|["']?\s*$)/gm, (m, a, c) => { changed++; return `${a}storage/data${c}`; })
    .replace(/^(MENU_PICTURE_PATH\s*=\s*["']?)(?:\.\/)?assets\//gm, (m, a) => { changed++; return `${a}src/assets/`; });
  if (changed) { setNew('.env', out); info.push(`.env : ${changed} chemin(s) relatif(s) mis à jour (valeurs non affichées)`); }
}

// README : section « Structure »
patch('README.md', [
  [/\r?\n$/, '', 'fin'],
], { optional: true });
{
  const readme = readNew('README.md');
  const nl = readme.includes('\r\n') ? '\r\n' : '\n';
  const section = [
    '', '', '## Structure du projet', '',
    '```text',
    'DJOUSSE-TECH-MD/',
    '├── index.js            point d\'entrée',
    '├── src/',
    '│   ├── config/         config.js, style.js, paths.js (tous les chemins)',
    '│   ├── handlers/       handler.js (messages & évènements)',
    '│   ├── plugins/        commandes du bot (plugins/core)',
    '│   ├── lib/            utilitaires et services',
    '│   ├── guard/          protections de groupe',
    '│   ├── ludo/           module Ludo',
    '│   └── assets/         images du bot',
    '├── web/                site (public/), API Vercel (api/), scripts (scripts/)',
    '├── deployment/         Dockerfile, compose, Fly, Render, vercel.json',
    '├── storage/            sessions, data, logs, downloads, bin (ignoré par git)',
    '├── scripts/            audit.js, service.js (watchdog), outils',
    '├── test/  docs/',
    '└── .env  package.json  Procfile  app.json  .replit',
    '```', '',
    'Docker : `docker compose -f deployment/docker-compose.yml up -d --build`.',
    'Fly : `fly deploy --config deployment/fly.toml --dockerfile deployment/Dockerfile`.',
    'Voir `deployment/README.md`.', '',
  ].join(nl);
  setNew('README.md', readme.replace(/\s*$/, '') + section);
}
setNew('deployment/README.md', [
  '# Déploiement', '',
  'Ces fichiers ont été regroupés ici. Le contexte de build reste la **racine du dépôt**.', '',
  '| Plateforme | Commande / réglage |',
  '|---|---|',
  '| Docker | `docker build -f deployment/Dockerfile -t djousse-tech-md .` |',
  '| Docker Compose | `docker compose -f deployment/docker-compose.yml up -d --build` |',
  '| Fly.io | `fly deploy --config deployment/fly.toml --dockerfile deployment/Dockerfile` |',
  '| Render | Dashboard → Blueprint Path = `deployment/render.yaml` |',
  '| Vercel (site) | Root Directory = `web` (le fichier `web/vercel.json` est lu à cet endroit) |',
  '| Heroku / Railway | `Procfile` et `app.json` restent à la racine (exigé par la plateforme) |',
  '| Replit | `.replit` reste à la racine (exigé par la plateforme) |', '',
  '`deployment/vercel.json` est l\'ancienne configuration « racine du dépôt » (outputDirectory `web/public`) ;',
  'elle n\'expose pas `web/api`. La configuration utilisée par le site est `web/vercel.json`.', '',
  '`Dockerfile.dockerignore` est lu automatiquement par BuildKit à côté du Dockerfile.', '',
].join('\n'));

/* ─────────────── 6. Rapport ─────────────── */
const moved = plan.filter((x) => x.old !== x.neu);
const byTop = {};
for (const x of moved) { const k = x.neu.split('/').slice(0, 2).join('/'); byTop[k] = (byTop[k] || 0) + 1; }
console.log(`Fichiers analysés : ${plan.length} · à déplacer : ${moved.length}`);
console.log(Object.entries(byTop).sort().map(([k, v]) => `  ${String(v).padStart(4)}  → ${k}`).join('\n'));
console.log(`require() réécrits : ${rewrittenSpecs} · plugins avec chemin de données réécrit : ${pluginDataEdits}`);
for (const i of info) console.log('INFO  ' + i);
if (unresolved.length) warnings.push(`require non résolus :\n    ${unresolved.join('\n    ')}`);
for (const w of warnings) console.log('AVERT ' + w);
for (const p of problems) console.log('ERREUR ' + p);
if (problems.length) { console.log('\nAucune modification écrite : corrige les ERREUR ci-dessus.'); process.exit(1); }
if (!APPLY) { console.log('\nSimulation terminée — rien n\'a été écrit. Relance avec --apply.'); process.exit(0); }

/* ─────────────── 7. Écriture ─────────────── */
// ordre : d'abord tout déplacer, puis écrire les contenus modifiés (annulation si erreur)
const done = [];
try {
  for (const { old, neu } of moved) {
    const dst = path.join(ROOT, neu);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.renameSync(path.join(ROOT, old), dst);
    done.push({ old, neu });
  }
  for (const [neu, txt] of content) {
    const dst = path.join(ROOT, neu);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.writeFileSync(dst, txt, 'utf8');
  }
} catch (e) {
  console.error(`\nERREUR pendant la migration : ${e.message}\nAnnulation des ${done.length} déplacement(s)...`);
  for (const { old, neu } of done.reverse()) {
    try { fs.mkdirSync(path.dirname(path.join(ROOT, old)), { recursive: true }); fs.renameSync(path.join(ROOT, neu), path.join(ROOT, old)); } catch (_) { /* meilleur effort */ }
  }
  console.error('Annulé. Les fichiers réécrits (require, .gitignore...) doivent être restaurés avec : git checkout -- .  (si tu as commité avant)');
  process.exit(1);
}
// dossiers vides laissés derrière (récursif, uniquement les anciens dossiers de premier niveau)
function pruneEmpty(dir) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return;
  for (const e of fs.readdirSync(dir)) pruneEmpty(path.join(dir, e));
  try { if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir); } catch (_) { /* dossier occupé : sans importance */ }
}
for (const d of ['plugins', 'lib', 'guard', 'ludo', 'assets', 'website', 'sessions', 'data', 'logs', 'downloads', 'vendor']) {
  pruneEmpty(path.join(ROOT, d));
}
for (const d of ['storage/sessions', 'storage/data', 'storage/logs', 'storage/downloads', 'storage/bin']) {
  fs.mkdirSync(path.join(ROOT, d), { recursive: true });
}
console.log(`\nMigration terminée : ${moved.length} fichiers déplacés, ${content.size} fichiers réécrits.`);
console.log('Vérifie : npm run check && npm test && npm run audit');
