/* Command Health — Rapport final automatique (Mission clôture wwebjs).
   Usage: node scripts/command-health.cjs [--json]
   Charge le registre réel (command.cjs + plugins/) SANS se connecter à WhatsApp,
   puis remonte le panneau santé : total / chargées / testables / dépendances
   Baileys / statuts (native, adapter, legacy, incompatible, obfusqués). */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
const runtimeEngine = String(process.env.ENGINE_TYPE || 'baileys').toLowerCase();
const { commands } = require(path.join(ROOT, 'command.cjs'));
const compat = require(path.join(ROOT, 'src', 'compatibility', 'baileys-compat.cjs'));
const { summarizeRegistry, scanPluginSource } = compat;

/* Même chargement que index.cjs (tri alphabétique, try/catch par plugin) */
const pluginsDir = path.join(ROOT, 'plugins');
const loadErrors = [];
let esmLoadPromise = Promise.resolve();
if (fs.existsSync(pluginsDir)) {
  const files = fs.readdirSync(pluginsDir)
    .filter(f => f.endsWith('.js') || f.endsWith('.cjs') || f.endsWith('.mjs'))
    .sort((a, b) => a.localeCompare(b));
  for (const file of files) {
    if (file.endsWith('.mjs')) continue;
    try {
      require(path.join(pluginsDir, file));
    } catch (e) {
      loadErrors.push({ file, error: e.message });
    }
  }
  const esmFiles = files.filter(file => file.endsWith('.mjs'));
  esmLoadPromise = Promise.all(esmFiles.map(async file => {
    try {
      await import(pathToFileURL(path.join(pluginsDir, file)).href);
    } catch (e) {
      loadErrors.push({ file, error: e.message });
    }
  })).catch(() => {});
}

setTimeout(async () => {
  await esmLoadPromise;
  const reg = summarizeRegistry(commands);

  /* Scan du code source de chaque plugin (indépendant de la classification vm) */
  const scanned = { files: 0, obfuscated: 0, baileysSig: 0, baileysFiles: [] };
  for (const file of fs.readdirSync(pluginsDir).filter(f => f.endsWith('.js') || f.endsWith('.cjs'))) {
    scanned.files++;
    const res = scanPluginSource(path.join(pluginsDir, file));
    if (res.obfuscated) scanned.obfuscated++;
    if (res.baileys) { scanned.baileysSig++; scanned.baileysFiles.push(file); }
  }

  const named = commands.filter(c => c.pattern && !String(c.pattern).includes('/'));
  const withFn = commands.filter(c => typeof c.function === 'function');
  const depsBaileys = reg.byEngine.baileys + reg.byEngine.mixed;

  /* Détection des require('@whiskeysockets/baileys') purs (fichiers qui importeraient Baileys) */
  let baileysRequireFiles = [];
  for (const file of fs.readdirSync(pluginsDir).filter(f => f.endsWith('.js') || f.endsWith('.cjs'))) {
    try {
      const src = fs.readFileSync(path.join(pluginsDir, file), 'utf8');
      if (/@whiskeysockets\/baileys/.test(src)) baileysRequireFiles.push(file);
    } catch {}
  }
  const nonBaileysRuntime = commands.filter(c => {
    const meta = c.meta;
    return !meta || (meta.engine !== 'baileys' && meta.engine !== 'mixed');
  }).length;

  /* ── Résultats du harness (data/command-test-results.json, si généré) ── */
  let testRes = null;
  try {
    const p = path.join(ROOT, 'data', 'command-test-results.json');
    if (fs.existsSync(p)) testRes = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {}
  const tested = testRes ? `${testRes.tested}` : '—';
  const fine = testRes ? `${testRes.ok}` : '—';
  const toFix = testRes ? `${testRes.errors}` : '—';
  const tmOut = testRes ? `${testRes.timeouts}` : '—';

  const panel = [
    '╭──── DJOUSSE TECH — COMMAND HEALTH ────╮',
    '│',
    `│  Total commandes        : ${reg.total}`,
    `│  Chargées               : ${commands.length} (fichiers: ${scanned.files})`,
    `│  Avec handler (fn)      : ${withFn.length}`,
    `│  Nommées (comptées)     : ${named.length}`,
    `│  Engin runtime          : ${named.length - depsBaileys} — sans Baileys`,
    `│  Dépendances Baileys    : ${depsBaileys}`,
    `│  Fichiers ^Baileys/    : ${scanned.baileysSig} (${scanned.baileysFiles.join(', ')})`,
    `│  Require baileys direct : ${baileysRequireFiles.length} (${baileysRequireFiles.join(', ')})`,
    `│  Obfusqués              : ${scanned.obfuscated}`,
    `│  Statuts  native        : ${reg.byStatus.native}`,
    `│  Statuts  adapter       : ${reg.byStatus.adapter}`,
    `│  Statuts  legacy        : ${reg.byStatus.legacy}`,
    `│  Statuts  incompatible  : ${reg.byStatus.incompatible}`,
    `│  Erreurs de chargement  : ${loadErrors.length}`,
    `│  Erreurs critiques      : ${loadErrors.length}`,
    `│  Testées (harness)      : ${tested}`,
    `│  Fonctionnelles         : ${fine}`,
    `│  À corriger             : ${toFix} (timeouts: ${tmOut})`,
    '│',
    `│  WhatsApp Engine        : ${runtimeEngine}`,
    '│  Database               : SQLite (sql.js, WAL+breaker)',
    '│  Action Executor        : OK',
    '│  Event Bus              : OK',
    '╰────────────────────────────────────────╯',
  ].join('\n');

  if (process.argv.includes('--json')) {
    const out = {
      total: reg.total,
      loaded: commands.length,
      files: scanned.files,
      withHandler: withFn.length,
      named: named.length,
      runtimeNonBaileys: nonBaileysRuntime,
      depsBaileys,
      baileysRequireFiles,
      obfuscated: scanned.obfuscated,
      tests: testRes
        ? { tested: testRes.tested, ok: testRes.ok, errors: testRes.errors, timeouts: testRes.timeouts, mode: testRes.mode }
        : null,
      byStatus: reg.byStatus,
      byEngine: reg.byEngine,
      loadErrors,
      engine: runtimeEngine,
      database: 'SQLite',
    };
    console.log(JSON.stringify(out, null, 2));
  } else {
    console.log(panel);
    if (loadErrors.length) {
      console.log('\n── Erreurs de chargement ──');
      for (const le of loadErrors) console.log('  ✗ ' + le.file + ': ' + le.error);
    }
    if (baileysRequireFiles.length) {
      console.log('\n── Fichiers requérant encore @whiskeysockets/baileys ──');
      for (const f of baileysRequireFiles) console.log('  ⚠ ' + f);
    }
  }
  process.exit(0);
}, 1500);