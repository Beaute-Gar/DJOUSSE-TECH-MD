'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'djou-menu-text-'));
const dataDir = path.join(tempRoot, 'data');
const sessionDir = path.join(tempRoot, 'sessions');
const nativeSetInterval = global.setInterval;

function accessLabel(entry, category) {
  const access = [];
  if (category === 9 || entry.owner) access.push('OWNER / SUDO');
  if (entry.admin) access.push('ADMIN GROUPE');
  if (entry.botAdmin) access.push('BOT ADMIN');
  if (entry.group) access.push('GROUPE');
  return access.length ? access.join(', ') : 'TOUS';
}

function clean(value) {
  return String(value || 'Rôle non renseigné').replace(/\s+/g, ' ').trim();
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

  const { buildFrame, bullet, catBox, frameFooter, numItem, signature, title, toUnicode } =
    require('../src/config/style');
  const config = require('../src/config/config');
  const byEntry = new Map();
  for (const [key, entry] of handler.commands) {
    if (!byEntry.has(entry)) byEntry.set(entry, []);
    byEntry.get(entry).push(key);
  }

  const ownerProfile = { isOwner: true, isAdmin: true };
  const visibleByCategory = new Map();
  for (const category of handler.CATEGORIES) {
    const seen = new Set();
    const entries = [];
    for (const entry of handler.commands.values()) {
      if (entry.cat !== category.n || seen.has(entry.name) || entry.enabled === false) continue;
      if (entry.owner && !ownerProfile.isOwner) continue;
      if (entry.admin && !ownerProfile.isAdmin) continue;
      if (category.n === 9 && !ownerProfile.isOwner) continue;
      seen.add(entry.name);
      entries.push(entry);
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    visibleByCategory.set(category.n, entries);
  }

  const menuCommands = [...visibleByCategory.values()].flat();
  const visibleAliases = menuCommands.reduce((total, entry) => {
    const keys = byEntry.get(entry) || [];
    const aliases = keys.filter((key) => key !== entry.name);
    if (aliases.length > 1) {
      throw new Error(`La commande ${entry.name} dépasse un alias joignable : ${aliases.join(', ')}`);
    }
    return total + aliases.length;
  }, 0);
  const hidden = [...byEntry.keys()].filter((entry) => Number(entry.cat) === 99).length;
  const lines = [
    buildFrame('CATALOGUE COMPLET .MENU', [
      bullet('BOT', config.botName),
      bullet('PREFIX', `〔${config.prefix}〕`),
      bullet('TOTAL', `${toUnicode(String(menuCommands.length))} ${toUnicode('COMMANDES')}`),
      bullet('ALIAS', `${toUnicode(String(visibleAliases))} ${toUnicode('INCLUS')}`),
      title(toUnicode('PROFIL OWNER / SUDO — CATEGORIES VISIBLES DU MENU')),
    ]),
    '',
    `INVENTAIRE DU REGISTRE : ${byEntry.size} commandes distinctes, ${handler.commands.size} clés (noms + alias).`,
    `AFFICHÉES DANS .MENU : ${menuCommands.length} commandes principales, ${visibleAliases} alias (les alias ne sont pas comptés comme commandes supplémentaires).`,
    `HORS MENUS : ${hidden} commandes en catégorie 99, non affichées par .menu.`,
    'Le menu réel est filtré selon le profil : les commandes Owner/Sudo et Admin groupe peuvent être masquées aux autres profils.',
    'Chaque rôle ci-dessous reprend la description de la commande et ses restrictions d’accès.',
    '',
  ];

  for (const category of handler.CATEGORIES) {
    const entries = visibleByCategory.get(category.n) || [];
    lines.push(catBox(category.emoji, category.label, entries.length));
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      const aliases = (byEntry.get(entry) || []).filter((key) => key !== entry.name);
      lines.push(numItem(index + 1, entry.name));
      lines.push(`┊    ✦ RÔLE : ${clean(entry.desc || entry.description)}`);
      if (aliases.length) lines.push(`┊    ✦ ALIAS : ${config.prefix}${aliases[0]}`);
      lines.push(`┊    ✦ ACCÈS : ${accessLabel(entry, category.n)}`);
    }
    lines.push(frameFooter(), '');
  }
  lines.push(signature(), '');

  const output = path.join(root, 'docs', 'COMMANDES_MENU.txt');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, lines.join('\r\n'), 'utf8');

  require('../src/lib/db').close();
  require('../src/lib/store').closeStore();
  fs.rmSync(tempRoot, { recursive: true, force: true });
  process.stdout.write(
    `Catalogue .menu généré : ${menuCommands.length} commandes, ${visibleAliases} alias, ` +
    `${hidden} hors menus — ${path.relative(root, output)}.\n`,
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
