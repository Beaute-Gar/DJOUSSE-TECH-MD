'use strict';
/**
 * migrate-v2.js — exécuteur de l'arborescence cible DJOUSSE-TECH-MD
 * ══════════════════════════════════════════════════════════════════════════
 * Le plan est déclaratif (PLAN ci-dessous), tiré de l'arborescence validée.
 *
 *   node scripts/migrate-v2.js              → état du plan (aucune écriture)
 *   node scripts/migrate-v2.js --json       → état du plan en JSON
 *   node scripts/migrate-v2.js --count-only → compteurs du registre
 *   node scripts/migrate-v2.js --apply      → exécute les opérations SÛRES
 *
 * GARANTIES
 *   · sauvegarde complète de src/commandes avant toute écriture ;
 *   · restauration automatique si le registre ne reste pas à 983/1365 ;
 *   · aucune fusion n'est inventée : les fichiers à fusionner sont listés
 *     comme BLOQUÉS (leurs définitions legacy sont distinctes) ;
 *   · les `_legacy-*.js` ne sont jamais supprimés par ce script : ils sont
 *     requis par les wrappers (737 références sur 185 fichiers).
 * ══════════════════════════════════════════════════════════════════════════
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const COMMANDES = path.join(ROOT, 'src', 'commandes');
const BASELINE = { unique: 984, keys: 1366, aliases: 382 };

const ARGS = new Set(process.argv.slice(2));
const JSON_OUT = ARGS.has('--json');
const COUNT_ONLY = ARGS.has('--count-only');
const APPLY = ARGS.has('--apply');

/* ─────────────── PLAN : renommages 1→1 de l'arborescence cible ─────────────── */

const RENAMES = [
  ['01-general/menu-maison.js', '01-general/menu.js'],
  ['01-general/owner-maison.js', '01-general/owner.js'],
  ['01-general/uptime-maison.js', '01-general/uptime.js'],
  ['02-groupe/groupinfo-maison.js', '02-groupe/groupinfo.js'],
  ['02-groupe/hidetag-maison.js', '02-groupe/hidetag.js'],
  ['02-groupe/promote-maison.js', '02-groupe/promote.js'],
  ['02-groupe/tagall-maison.js', '02-groupe/tagall.js'],
  ['03-protection/antilink2.js', '03-protection/antilink.js'],
  ['04-sticker-media/toaudio-maison.js', '04-sticker-media/toaudio.js'],
  ['04-sticker-media/viewonce-maison.js', '04-sticker-media/viewonce.js'],
  ['05-outils/bio2.js', '05-outils/bio.js'],
  ['05-outils/color2.js', '05-outils/color.js'],
  ['05-outils/emoji2.js', '05-outils/emoji.js'],
  ['05-outils/phone2.js', '05-outils/phone.js'],
  ['05-outils/poll2.js', '05-outils/poll.js'],
  ['05-outils/quote2.js', '05-outils/quote.js'],
  ['05-outils/status2.js', '05-outils/status.js'],
  ['06-ia/ai-maison.js', '06-ia/ai.js'],
  ['06-ia/mode2.js', '06-ia/mode.js'],
  ['06-ia/restart2.js', '06-ia/restart.js'],
  ['06-ia/summarize-maison.js', '06-ia/summarize.js'],
  ['07-fun/8ball-maison.js', '07-fun/8ball.js'],
  ['07-fun/horoscope2.js', '07-fun/horoscope.js'],
  ['07-fun/ship-maison.js', '07-fun/ship.js'],
  ['07-fun/unscramble2.js', '07-fun/unscramble.js'],
  ['09-owner/setbio-maison.js', '09-owner/setbio.js'],
  ['09-owner/vv2.js', '09-owner/vv.js'],
  ['10-divers/password2.js', '10-divers/password.js'],
  ['10-divers/remind2.js', '10-divers/remind.js'],
];

/* Fusions annoncées dans l'arborescence : plusieurs sources → une cible. */
const FUSIONS = [
  { to: '05-outils/ascii.js', from: ['05-outils/ascii2.js', '05-outils/ascii3.js'] },
  { to: '05-outils/countdown.js', from: ['05-outils/countdown2.js', '05-outils/countdown3.js'] },
  { to: '07-fun/joke.js', from: ['07-fun/joke-maison.js', '07-fun/joke2.js'] },
  { to: '07-fun/fortune.js', from: ['07-fun/fortune2.js'] },
  { to: '09-owner/prefix.js', from: ['09-owner/prefix2.js'] },
  { to: '10-divers/encode.js', from: ['10-divers/encode64.js'] },
  { to: '10-divers/tempmail.js', from: ['10-divers/tempmailhelp.js'] },
  { to: '11-telechargement/youtube.js', from: ['11-telechargement/yt-maison.js'] },
  { to: '05-outils/save.js', from: ['05-outils/save2.js'] },
  { to: '03-protection/antibadword.js', from: ['03-protection/antibadwords.js'] },
];

/* Déplacements de dossiers. */
const MOVES = [
  ['12-archives/archives.js', '12-extras/archives.js'],
];

/* ─────────────────────────── registre ─────────────────────────── */

function loadRegistry() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'djou-migrate-'));
  const dataDir = path.join(tempRoot, 'data');
  const sessionDir = path.join(tempRoot, 'sessions');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(sessionDir, { recursive: true });
  fs.writeFileSync(path.join(tempRoot, '.env'), '');

  process.env.DATA_DIR = dataDir;
  process.env.SESSION_DIR = sessionDir;
  process.env.ENV_FILE = path.join(tempRoot, '.env');
  process.env.OWNER_NUMBER = '237000000001';
  process.env.MODE = 'public';
  process.env.PUBLIC_MODE = '1';

  Object.assign(require('../src/config/paths'), {
    STORAGE: tempRoot,
    SESSIONS: sessionDir,
    DATA: dataDir,
    PLUGIN_DATA: path.join(dataDir, 'plugins'),
    LOGS: path.join(tempRoot, 'logs'),
    DOWNLOADS: path.join(tempRoot, 'downloads'),
    ASSETS: path.join(tempRoot, 'assets'),
    BIN: path.join(tempRoot, 'bin'),
  });

  const nativeSetInterval = global.setInterval;
  global.setInterval = () => ({ unref() {}, ref() {} });
  const logs = [];
  const originalConsole = {};
  for (const method of ['log', 'info', 'warn', 'error']) {
    originalConsole[method] = console[method];
    console[method] = (...args) => logs.push(args.map(String).join(' '));
  }

  let handler;
  try {
    handler = require('../src/handlers/handler');
  } finally {
    for (const [method, fn] of Object.entries(originalConsole)) console[method] = fn;
    global.setInterval = nativeSetInterval;
  }

  if (!handler?.commands || !(handler.commands instanceof Map)) {
    throw new Error(`Le handler ne fournit pas de Map commands.\n${logs.join('\n')}`);
  }
  const keys = [...handler.commands.keys()];
  const unique = new Set(handler.commands.values()).size;
  return { keys, unique, aliases: keys.length - unique };
}

/* ─────────────────────── lecture statique ─────────────────────── */

function walkJs(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name === '_partage' || entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJs(full, acc);
    else if (entry.isFile() && entry.name.endsWith('.js')) acc.push(full);
  }
  return acc;
}

function readWrapper(file) {
  const source = fs.readFileSync(file, 'utf8');
  const marker = source.indexOf('__legacyCommand');
  if (marker === -1) return null;
  const start = source.indexOf('{', marker);
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          const meta = JSON.parse(source.slice(start, i + 1));
          const match = /commands\s*:\s*(\[[^\]]*\])/.exec(source);
          const commands = match ? JSON.parse(match[1]) : meta.names || [];
          return { meta, commands };
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function inventory() {
  const files = walkJs(COMMANDES);
  const legacyByCanonical = new Map();
  const legacyFiles = [];
  const wrappers = [];

  for (const file of files) {
    const base = path.basename(file);
    const rel = path.relative(COMMANDES, file).split(path.sep).join('/');
    if (base.startsWith('_legacy-')) {
      legacyFiles.push(rel);
      legacyByCanonical.set(path.resolve(file), []);
      continue;
    }
    if (base.startsWith('_')) continue;
    const wrapper = readWrapper(file);
    if (!wrapper) continue;
    const resolved = wrapper.meta.source ? path.resolve(path.dirname(file), wrapper.meta.source) : null;
    wrappers.push({ rel, ...wrapper, resolved });
  }

  for (const wrapper of wrappers) {
    if (!wrapper.resolved) continue;
    const canonical = path.resolve(wrapper.resolved);
    if (!legacyByCanonical.has(canonical)) legacyByCanonical.set(canonical, []);
    legacyByCanonical.get(canonical).push(wrapper.rel);
  }

  const rows = [...legacyByCanonical.entries()]
    .map(([file, refs]) => ({ legacy: path.relative(ROOT, file).split(path.sep).join('/'), count: refs.length }))
    .sort((a, b) => b.count - a.count || a.legacy.localeCompare(b.legacy));

  return {
    wrappers,
    legacyFiles,
    shared: rows.filter((row) => row.count > 0),
    orphans: rows.filter((row) => row.count === 0).map((row) => row.legacy),
    maxRefs: rows[0] || null,
  };
}

/* ─────────────────── état du plan (aucune écriture) ─────────────────── */

function planState() {
  const renames = RENAMES.map(([from, to]) => {
    const exists = fs.existsSync(path.join(COMMANDES, from));
    const target = fs.existsSync(path.join(COMMANDES, to));
    const status = !exists
      ? (target ? 'déjà migré' : 'source absente')
      : (target ? 'collision' : 'prêt');
    return { from, to, status };
  });

  const fusions = FUSIONS.map(({ from, to }) => ({
    from,
    to,
    status: fs.existsSync(path.join(COMMANDES, to)) ? 'cible existante' : 'fusion requise',
  }));

  const moves = MOVES.map(([from, to]) => {
    const exists = fs.existsSync(path.join(COMMANDES, from));
    const target = fs.existsSync(path.join(COMMANDES, to));
    const status = !exists
      ? (target ? 'déjà migré' : 'source absente')
      : (target ? 'collision' : 'prêt');
    return { from, to, status };
  });

  return { renames, fusions, moves };
}

/* ─────────────────── réécriture des require relatifs ─────────────────── */

function resolveRequire(fromFile, spec) {
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [base, `${base}.js`, path.join(base, 'index.js')];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function sourceFiles() {
  return [
    ...walkJs(path.join(ROOT, 'src')),
    ...walkJs(path.join(ROOT, 'test')),
    ...walkJs(path.join(ROOT, 'scripts')),
    path.join(ROOT, 'index.js'),
  ].filter((file) => fs.existsSync(file) && path.resolve(file) !== path.resolve(__filename));
}

function rewriteRequires(moveMap) {
  let updated = 0;
  for (const file of sourceFiles()) {
    const source = fs.readFileSync(file, 'utf8');
    const next = source.replace(/(require\s*\(\s*['"])(\.[^'"]+)(['"]\s*\))/g, (whole, head, spec, tail) => {
      const resolved = resolveRequire(file, spec);
      if (!resolved) return whole;
      const key = path.resolve(resolved);
      if (!moveMap.has(key)) return whole;
      const target = moveMap.get(key);
      let rel = path.relative(path.dirname(file), target).split(path.sep).join('/');
      if (!rel.startsWith('.')) rel = `./${rel}`;
      rel = rel.replace(/\.js$/, '');
      return `${head}${rel}${tail}`;
    });
    if (next !== source) {
      fs.writeFileSync(file, next);
      updated += 1;
    }
  }
  return updated;
}

/* handler.js enregistre aussi des chemins en dur via chargerCommandes([...]). */
function rewritePathLiterals(pairs) {
  let updated = 0;
  for (const file of sourceFiles()) {
    const source = fs.readFileSync(file, 'utf8');
    let next = source;
    for (const { from, to } of pairs) {
      const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      next = next.replace(new RegExp(`(['"\`])${escaped}\\1`, 'g'), `$1${to}$1`);
    }
    if (next !== source) {
      fs.writeFileSync(file, next);
      updated += 1;
    }
  }
  return updated;
}

/* ─────────────────────────── sauvegarde ─────────────────────────── */

function backup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'djou-backup-'));
  fs.cpSync(path.join(ROOT, 'src'), path.join(dir, 'src'), { recursive: true });
  return dir;
}

function restore(dir) {
  fs.rmSync(path.join(ROOT, 'src'), { recursive: true, force: true });
  fs.cpSync(path.join(dir, 'src'), path.join(ROOT, 'src'), { recursive: true });
}

/* ─────────────────────────── exécution ─────────────────────────── */

function applySafe(state) {
  const backupDir = backup();
  const moveMap = new Map();
  const pairs = [];
  const done = [];

  try {
    for (const op of state.renames.filter((row) => row.status === 'prêt')) {
      const from = path.join(COMMANDES, op.from);
      const to = path.join(COMMANDES, op.to);
      fs.renameSync(from, to);
      moveMap.set(path.resolve(from), path.resolve(to));
      pairs.push({ from: op.from, to: op.to });
      done.push(`renommé   ${op.from} → ${op.to}`);
    }
    for (const op of state.moves.filter((row) => row.status === 'prêt')) {
      const from = path.join(COMMANDES, op.from);
      const to = path.join(COMMANDES, op.to);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.renameSync(from, to);
      moveMap.set(path.resolve(from), path.resolve(to));
      pairs.push({ from: op.from, to: op.to });
      done.push(`déplacé   ${op.from} → ${op.to}`);
    }
    const rewritten = rewriteRequires(moveMap);
    const rewrittenLiterals = rewritePathLiterals(pairs);
    done.push(`require réécrits : ${rewritten} fichier(s) · chemins en dur : ${rewrittenLiterals} fichier(s)`);

    const after = freshCount();
    const ok = after.unique === BASELINE.unique && after.keys === BASELINE.keys;
    done.push(`registre après  : ${after.unique} uniques / ${after.keys} clés → ${ok ? 'OK' : 'ÉCHEC'}`);

    if (!ok) {
      restore(backupDir);
      done.push('ROLLBACK effectué (registre non conforme)');
      return { ok: false, done };
    }
    return { ok: true, done, backup: backupDir };
  } catch (error) {
    restore(backupDir);
    done.push(`ROLLBACK effectué (${error.message})`);
    return { ok: false, done };
  }
}

function freshCount() {
  const run = spawnSync(process.execPath, [__filename, '--count-only'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 120000,
  });
  const lines = String(run.stdout || '').trim().split(/\r?\n/).filter(Boolean);
  try {
    return JSON.parse(lines[lines.length - 1]);
  } catch {
    return { unique: null, keys: null, error: String(run.stderr || run.stdout).slice(0, 200) };
  }
}

/* ─────────────────────────── affichage ─────────────────────────── */

function main() {
  const registry = loadRegistry();
  const inv = inventory();
  const state = planState();

  if (COUNT_ONLY) {
    process.stdout.write(`${JSON.stringify({ unique: registry.unique, keys: registry.keys.length, aliases: registry.aliases })}\n`);
    return;
  }

  const gateOk = registry.unique === BASELINE.unique && registry.keys.length === BASELINE.keys;
  const ready = state.renames.filter((row) => row.status === 'prêt').length
    + state.moves.filter((row) => row.status === 'prêt').length;
  const already = state.renames.filter((row) => row.status === 'déjà migré').length
    + state.moves.filter((row) => row.status === 'déjà migré').length;
  const blocked = state.renames.filter((row) => row.status === 'collision' || row.status === 'source absente').length
    + state.fusions.length
    + state.moves.filter((row) => row.status === 'collision' || row.status === 'source absente').length;

  if (JSON_OUT) {
    process.stdout.write(`${JSON.stringify({
      registre: { unique: registry.unique, keys: registry.keys.length, aliases: registry.aliases, gateOk },
      plan: state,
      legacy: {
        fichiers: inv.legacyFiles.length,
        wrappers: inv.wrappers.length,
        partages: inv.shared.length,
        orphelins: inv.orphans,
        max: inv.maxRefs,
      },
      pretes: ready,
      bloquees: blocked,
    }, null, 2)}\n`);
    return;
  }

  console.log('═'.repeat(72));
  console.log(' MIGRATE V2 — PLAN CIBLE (aucune écriture sans --apply)');
  console.log('═'.repeat(72));
  console.log(`\nRegistre : ${registry.unique} uniques / ${registry.keys.length} clés / ${registry.aliases} alias`);
  console.log(`Gate     : ${gateOk ? 'OK' : 'ÉCHEC'} (attendu ${BASELINE.unique}/${BASELINE.keys}/${BASELINE.aliases})`);

  console.log(`\nRenommages 1→1 (${state.renames.length})`);
  for (const row of state.renames.filter((entry) => entry.status === 'prêt')) {
    console.log(`  prêt        ${row.from} → ${row.to}`);
  }
  for (const row of state.renames.filter((entry) => entry.status !== 'prêt' && entry.status !== 'déjà migré')) {
    console.log(`  ${row.status.padEnd(11)} ${row.from} → ${row.to}`);
  }
  const renamesDone = state.renames.filter((entry) => entry.status === 'déjà migré').length;
  if (renamesDone) console.log(`  déjà migrés : ${renamesDone}`);

  console.log(`\nFusions annoncées (${state.fusions.length})`);
  for (const row of state.fusions) {
    console.log(`  BLOQUÉ      ${row.from.join(' + ')} → ${row.to}`);
  }

  console.log(`\nDéplacements (${state.moves.length})`);
  for (const row of state.moves) {
    console.log(`  ${row.status.padEnd(11)} ${row.from} → ${row.to}`);
  }

  console.log('\nLegacy (non supprimés par ce script)');
  console.log(`  ${inv.legacyFiles.length} fichiers · ${inv.wrappers.length} wrappers · ${inv.shared.length} sources liées`);
  console.log(`  plus gros partage : ${inv.maxRefs?.count || 0} commandes → ${inv.maxRefs?.legacy || '—'}`);

  console.log(`\nBilan : ${ready} prête(s) · ${already} déjà migrée(s) · ${blocked} bloquée(s).`);

  if (APPLY) {
    if (!gateOk) {
      console.error('✗ --apply refusé : le registre ne correspond pas à la baseline.');
      process.exitCode = 1;
      return;
    }
    console.log('\nApplication…');
    const result = applySafe(state);
    for (const line of result.done) console.log(`  ${line}`);
    if (!result.ok) process.exitCode = 1;
  } else {
    console.log('\nDry-run : relancer avec --apply pour exécuter les opérations prêtes.');
  }
}

main();
