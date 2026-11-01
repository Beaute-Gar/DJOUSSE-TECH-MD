'use strict';
/**
 * export-site-data.js — source de vérité du site web.
 * ══════════════════════════════════════════════════════════════════════════
 * Regénère, depuis le registre réellement chargé par le bot :
 *   · web/public/data/commands.json  (catalogue complet, alias compris)
 *   · web/public/data/site-data.json (stats + catégories recalculées)
 *
 *   node scripts/export-site-data.js
 *
 * Le site Vercel ne lit que ces deux fichiers : aucune commande morte,
 * aucun chiffre figé, aucune correspondance inventée.
 * ══════════════════════════════════════════════════════════════════════════
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'web', 'public', 'data');
const COMMANDS_FILE = path.join(DATA_DIR, 'commands.json');
const SITE_FILE = path.join(DATA_DIR, 'site-data.json');

function loadRegistry() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'djou-site-'));
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
  return handler;
}

function titleCase(value) {
  return String(value || '')
    .toLocaleLowerCase('fr')
    .replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase('fr'));
}

function accessOf(entry) {
  if (entry.owner || Number(entry.cat) === 9) return 'owner';
  if (entry.admin || entry.botAdmin) return 'admin';
  return 'public';
}

function writeJson(file, payload) {
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

function main() {
  const handler = loadRegistry();

  /* Une seule ligne par commande réelle (les alias partagent l'entrée). */
  const unique = new Map();
  for (const entry of handler.commands.values()) {
    if (!entry || typeof entry.name !== 'string' || !entry.name.trim()) continue;
    if (!unique.has(entry.name)) unique.set(entry.name, entry);
  }

  const all = [...unique.values()];
  const visible = all.filter((entry) => Number(entry.cat) !== 99);
  const aliasCount = visible.reduce((sum, entry) => sum + (entry.aliases || []).length, 0);

  const commands = visible
    .map((entry) => ({
      name: String(entry.name).trim().toLowerCase(),
      aliases: [...new Set((entry.aliases || []).map((alias) => String(alias).trim().toLowerCase()).filter(Boolean))],
      category: Number(entry.cat) || 1,
      description: String(entry.desc || '').trim(),
      usage: String(entry.usage || '').trim(),
      access: accessOf(entry),
    }))
    .sort((a, b) => a.category - b.category || a.name.localeCompare(b.name, 'fr'));

  const labels = new Map(handler.CATEGORIES.map((category) => [Number(category.n), category]));
  const categories = [...labels.values()]
    .map((category) => {
      const n = Number(category.n);
      return {
        n,
        name: category.label ? titleCase(category.label) : `Catégorie ${n}`,
        icon: String(category.emoji || ''),
        count: commands.filter((command) => command.category === n).length,
      };
    })
    .filter((category) => category.count > 0);

  const catalog = {
    partial: false,
    generatedFrom: 'src/handlers/handler.js',
    commands,
    categories,
    totals: { commands: commands.length, aliases: aliasCount },
  };
  writeJson(COMMANDS_FILE, catalog);

  /* site-data.json : on conserve l'identité/les textes, on recalcule les faits. */
  const site = JSON.parse(fs.readFileSync(SITE_FILE, 'utf8'));
  const previous = new Map((site.categories || []).map((category) => [Number(category.n), category]));
  site.stats = {
    categories: categories.length,
    commands_menu: commands.length,
    commands_registry: all.length,
    aliases: aliasCount,
    protections: Array.isArray(site.guard) ? site.guard.length : 0,
  };
  site.categories = categories.map((category) => ({
    n: category.n,
    icon: category.icon,
    name: previous.get(category.n)?.name || category.name,
    count: category.count,
  }));
  writeJson(SITE_FILE, site);

  console.log(`Catalogue : ${commands.length} commandes, ${aliasCount} alias, ${categories.length} catégories`);
  console.log(`Registre  : ${all.length} commandes uniques (hors menus inclus)`);
  console.log(`Écrit     : ${path.relative(ROOT, COMMANDS_FILE)}`);
  console.log(`Écrit     : ${path.relative(ROOT, SITE_FILE)}`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
}
