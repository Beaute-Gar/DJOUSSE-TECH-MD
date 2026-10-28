'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'djou-command-docs-'));
const dataDir = path.join(tempRoot, 'data');
const sessionDir = path.join(tempRoot, 'sessions');
const nativeSetInterval = global.setInterval;

function md(value) {
  return String(value || '—').replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').replace(/`/g, '\\`');
}

function main() {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(sessionDir, { recursive: true });
  const envFile = path.join(tempRoot, '.env');
  fs.writeFileSync(envFile, '');
  process.env.DATA_DIR = dataDir;
  process.env.SESSION_DIR = sessionDir;
  process.env.ENV_FILE = envFile;
  process.env.OWNER_NUMBER = '237000000001';
  process.env.MODE = 'public';
  process.env.PUBLIC_MODE = '1';

  const paths = require('../src/config/paths');
  Object.assign(paths, {
    STORAGE: tempRoot,
    SESSIONS: sessionDir,
    DATA: dataDir,
    PLUGIN_DATA: path.join(dataDir, 'plugins'),
    LOGS: path.join(tempRoot, 'logs'),
    DOWNLOADS: path.join(tempRoot, 'downloads'),
    ASSETS: path.join(tempRoot, 'assets'),
    BIN: path.join(tempRoot, 'bin'),
  });
  global.setInterval = () => ({ unref() {}, ref() {} });

  const captured = [];
  const originalConsole = {};
  for (const method of ['log', 'info', 'warn', 'error']) {
    originalConsole[method] = console[method];
    console[method] = (...args) => captured.push(args.map(String).join(' '));
  }

  let handler;
  try {
    handler = require('../src/handlers/handler');
  } finally {
    for (const [method, original] of Object.entries(originalConsole)) console[method] = original;
    global.setInterval = nativeSetInterval;
  }
  if (!handler?.commands || !(handler.commands instanceof Map)) {
    throw new Error(`Le handler ne fournit pas de Map commands.\n${captured.join('\n')}`);
  }

  const keysByEntry = new Map();
  for (const [key, entry] of handler.commands) {
    if (!keysByEntry.has(entry)) keysByEntry.set(entry, []);
    keysByEntry.get(entry).push(key);
  }
  const baseline = require('./baseline.json');
  const baselineKeys = new Set(baseline.registryKeys.map((entry) => entry.key));
  const currentKeys = new Set(handler.commands.keys());
  const expectedRemoved = new Set([
    'ask', 'assistant', 'commands', 'do', 'math', 'pollstats',
    'silva', 'textart', 'tovn', 'votes', 'ytv',
  ]);
  const addedKeys = [...currentKeys].filter((key) => !baselineKeys.has(key));
  const unexpectedRemoved = [...baselineKeys].filter((key) => !currentKeys.has(key) && !expectedRemoved.has(key));
  const missingExpected = [...expectedRemoved].filter((key) => baselineKeys.has(key) && currentKeys.has(key));
  if (addedKeys.length || unexpectedRemoved.length || missingExpected.length) {
    throw new Error(
      `Snapshot final différent de la référence : ajoutés=${addedKeys.join(', ') || 'aucun'}; ` +
      `supprimés inattendus=${unexpectedRemoved.join(', ') || 'aucun'}; ` +
      `retraits attendus absents=${missingExpected.join(', ') || 'aucun'}`,
    );
  }
  const byCategory = new Map();
  for (const [entry, keys] of keysByEntry) {
    const name = String(entry.name || keys.sort()[0]);
    const aliases = keys.filter((key) => key !== name).sort();
    if (aliases.length > 1) throw new Error(`La commande ${name} dépasse un alias : ${aliases.join(', ')}`);
    const category = Number(entry.cat) || 1;
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category).push({
      name,
      alias: aliases[0] || '',
      description: String(entry.desc || ''),
    });
  }

  const labels = new Map(handler.CATEGORIES.map((category) => [category.n, category.label]));
  labels.set(99, 'HORS MENUS');
  const categories = [...handler.CATEGORIES.map((category) => category.n), 99];
  const aliasCount = [...byCategory.values()].flat().filter((command) => command.alias).length;
  const lines = [
    '# Catalogue des commandes',
    '',
    `Inventaire généré automatiquement : **${keysByEntry.size} commandes**, **${aliasCount} alias**, **${handler.commands.size} clés de registre**.`,
    '',
    'Chaque ligne décrit une commande principale et, au plus, un alias joignable.',
    '',
  ];

  for (const category of categories) {
    const entries = (byCategory.get(category) || []).sort((a, b) => a.name.localeCompare(b.name));
    lines.push(`## ${String(category).padStart(2, '0')} — ${labels.get(category) || 'AUTRE'} (${entries.length})`);
    lines.push('');
    lines.push('| Commande | Alias | Description |');
    lines.push('|---|---|---|');
    for (const command of entries) {
      lines.push(`| \`${md(command.name)}\` | ${command.alias ? `\`${md(command.alias)}\`` : '—'} | ${md(command.description)} |`);
    }
    lines.push('');
  }
  lines.push('_Pour régénérer ce fichier : `node scripts/generate-commands-docs.js`._');
  lines.push('');

  const docsDirectory = path.join(root, 'docs');
  fs.mkdirSync(docsDirectory, { recursive: true });
  fs.writeFileSync(path.join(docsDirectory, 'COMMANDES.md'), lines.join('\n'), 'utf8');

  require('../src/lib/db').close();
  require('../src/lib/store').closeStore();
  fs.rmSync(tempRoot, { recursive: true, force: true });
  process.stdout.write(
    `Catalogue généré : docs/COMMANDES.md (${keysByEntry.size} commandes, ${aliasCount} alias); ` +
    `snapshot validé (${expectedRemoved.size} clés retirées explicitement).\n`,
  );
}

try {
  main();
} catch (error) {
  global.setInterval = nativeSetInterval;
  try { require('../src/lib/db').close(); } catch {}
  try { require('../src/lib/store').closeStore(); } catch {}
  try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch {}
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
}
