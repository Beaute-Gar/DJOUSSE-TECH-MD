'use strict';

const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');
const { fileURLToPath } = require('node:url');

const root = path.resolve(__dirname, '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'djou-salut-smoke-'));
const nativeMkdirSync = fs.mkdirSync.bind(fs);
const dataDir = path.join(tempRoot, 'data');
const sessionDir = path.join(tempRoot, 'sessions');
const pluginDataDir = path.join(dataDir, 'plugins');
const paths = require('../src/config/paths');
const nativeSetTimeout = global.setTimeout;
const nativeSetInterval = global.setInterval;
const nativeClearInterval = global.clearInterval;
const network = {
  fetch: global.fetch,
  httpRequest: http.request,
  httpGet: http.get,
  httpsRequest: https.request,
  httpsGet: https.get,
};
const nativeExit = process.exit;
const childProcessMethods = new Map();
const fileMethods = new Map();
const promiseFileMethods = new Map();
const consoleMethods = {};
const results = [];
const excluded = [];
let currentRun = null;
let blockedWrites = 0;
let redirectedWrites = 0;

const OWNER = '237000000001@s.whatsapp.net';
const TARGET = '237000000002@s.whatsapp.net';
const GROUP = '120363000000000000@g.us';
const PREFIX = '.';
const NETWORK_CODE = 'SMOKE_NETWORK_UNAVAILABLE';
const WRITE_CODE = 'SMOKE_WRITE_BLOCKED';
const excludedCommands = new Map([
  ['eval', 'exécution de code arbitraire'],
  ['exec', 'exécution de commandes système'],
  ['run', 'exécution de code arbitraire'],
  ['shell', 'exécution de commandes système'],
  ['sh', 'exécution de commandes système'],
  ['js', 'exécution de code arbitraire'],
  ['$', 'exécution de code arbitraire'],
  ['restart', 'redémarrage du processus'],
  ['restart2', 'redémarrage du processus'],
  ['reboot', 'redémarrage du processus'],
  ['shutdown', 'arrêt du processus'],
  ['logout', 'déconnexion WhatsApp'],
  ['resetdb', 'suppression/réinitialisation de la base'],
  ['resetallsettings', 'réinitialisation de la configuration'],
  ['terminate', 'arrêt ou perturbation du bot'],
  ['setprefix', 'écriture dans la configuration du projet'],
  ['gitclone', 'exécution d’un clonage externe'],
  ['self', 'changement du mode de fonctionnement'],
  ['cmd', 'exécution de commandes système'],
  ['broadcast', 'diffusion de masse'],
  ['bc', 'diffusion de masse'],
  ['broadcast2', 'diffusion de masse'],
  ['massbc', 'diffusion de masse'],
]);
const sampleArgs = new Map([
  ['calc', ['2+2']],
  ['base64', ['smoke']],
  ['binary', ['101']],
  ['encode', ['hello']],
  ['decode', ['aGVsbG8=']],
  ['hash', ['smoke']],
  ['morse', ['hello']],
  ['translate', ['hello', 'fr']],
  ['weather', ['Douala']],
  ['define', ['bot']],
  ['wiki', ['WhatsApp']],
  ['qr', ['smoke']],
  ['8ball', ['Will this smoke test pass?']],
  ['choose', ['tea', 'coffee']],
  ['coin', []],
  ['floodon', []],
  ['hex2dec', ['ff']],
]);
const realWhatsappMethods = /^(?:group|newsletter|updateProfile|profilePicture|sendPresence|presence|updateBlock|onWhatsApp|fetchBlock|readMessages|relayMessage)/i;

function resolveFilePath(filePath) {
  return path.resolve(filePath instanceof URL ? fileURLToPath(filePath) : String(filePath));
}

function isWithinTemp(filePath) {
  let resolved;
  try {
    resolved = resolveFilePath(filePath);
  } catch {
    return false;
  }
  return resolved === tempRoot || resolved.startsWith(`${tempRoot}${path.sep}`);
}

function assertTempWrite(filePath) {
  if (isWithinTemp(filePath)) return;
  blockedWrites += 1;
  const error = new Error('Écriture hors du répertoire temporaire interdite pendant le smoke test.');
  error.code = WRITE_CODE;
  throw error;
}

function isolatedWritePath(filePath) {
  if (isWithinTemp(filePath)) return filePath;
  redirectedWrites += 1;
  const resolved = resolveFilePath(filePath);
  let relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    relative = path.join('_external', path.basename(resolved));
  }
  const mapped = path.join(tempRoot, 'redirected', relative);
  nativeMkdirSync(path.dirname(mapped), { recursive: true });
  return mapped;
}

function opensForWriting(flags) {
  if (typeof flags === 'number') {
    const writeFlags = fs.constants.O_WRONLY | fs.constants.O_RDWR | fs.constants.O_CREAT
      | fs.constants.O_TRUNC | fs.constants.O_APPEND;
    return (flags & writeFlags) !== 0;
  }
  return /[wax+]/.test(String(flags));
}

function protectFsMethod(target, method, pathIndexes = [0], requireTempIndexes = []) {
  if (typeof target[method] !== 'function') return;
  const original = target[method];
  const wrapped = function (...args) {
    for (const index of pathIndexes) {
      if (args[index] === undefined || args[index] === null) continue;
      if (requireTempIndexes.includes(index)) assertTempWrite(args[index]);
      else args[index] = isolatedWritePath(args[index]);
    }
    return original.apply(this, args);
  };
  target[method] = wrapped;
  return () => { target[method] = original; };
}

function installWriteGuard() {
  const onePath = [
    'writeFileSync', 'appendFileSync', 'mkdirSync', 'unlinkSync', 'rmSync',
    'rmdirSync', 'truncateSync', 'createWriteStream', 'writeFile', 'appendFile',
    'mkdir', 'unlink', 'rm', 'rmdir', 'truncate',
  ];
  const renameMethods = ['renameSync', 'rename'];
  const copyMethods = ['copyFileSync', 'cpSync', 'copyFile', 'cp'];
  for (const method of onePath) {
    const restore = protectFsMethod(fs, method);
    if (restore) fileMethods.set(method, restore);
  }
  for (const method of renameMethods) {
    const restore = protectFsMethod(fs, method, [1], [0]);
    if (restore) fileMethods.set(method, restore);
  }
  for (const method of copyMethods) {
    const restore = protectFsMethod(fs, method, [1]);
    if (restore) fileMethods.set(method, restore);
  }
  const originalOpenSync = fs.openSync;
  fs.openSync = function (filePath, flags, ...args) {
    const target = opensForWriting(flags) ? isolatedWritePath(filePath) : filePath;
    return originalOpenSync.call(this, target, flags, ...args);
  };
  fileMethods.set('openSync', () => { fs.openSync = originalOpenSync; });
  const originalOpen = fs.open;
  fs.open = function (filePath, flags, ...args) {
    const target = opensForWriting(flags) ? isolatedWritePath(filePath) : filePath;
    return originalOpen.call(this, target, flags, ...args);
  };
  fileMethods.set('open', () => { fs.open = originalOpen; });

  for (const method of ['writeFile', 'appendFile', 'mkdir', 'copyFile', 'cp', 'rm', 'unlink']) {
    const restore = protectFsMethod(fs.promises, method, method === 'copyFile' || method === 'cp' ? [1] : [0]);
    if (restore) promiseFileMethods.set(method, restore);
  }
  const promiseRename = protectFsMethod(fs.promises, 'rename', [1], [0]);
  if (promiseRename) promiseFileMethods.set('rename', promiseRename);
}

function restoreWriteGuard() {
  for (const restore of fileMethods.values()) restore();
  for (const restore of promiseFileMethods.values()) restore();
}

function blockedNetwork() {
  if (currentRun) currentRun.networkAttempts += 1;
  const error = new Error('Accès réseau désactivé par scripts/smoke.js.');
  error.code = NETWORK_CODE;
  throw error;
}

function installNetworkBlock() {
  global.fetch = async () => blockedNetwork();
  http.request = blockedNetwork;
  http.get = blockedNetwork;
  https.request = blockedNetwork;
  https.get = blockedNetwork;
}

function installProcessGuards() {
  process.exit = function (code) {
    if (currentRun) {
      currentRun.processExitAttempts += 1;
      return undefined;
    }
    return nativeExit.call(process, code);
  };
  for (const method of ['exec', 'execSync', 'execFile', 'execFileSync', 'spawn', 'spawnSync', 'fork']) {
    const original = childProcess[method];
    if (typeof original !== 'function') continue;
    childProcessMethods.set(method, original);
    childProcess[method] = function () {
      if (currentRun) {
        currentRun.processAttempts += 1;
        const error = new Error('Lancement de processus externe bloqué par le smoke test.');
        error.code = 'SMOKE_PROCESS_UNAVAILABLE';
        throw error;
      }
      return original.apply(this, arguments);
    };
  }
}

function restoreProcessGuards() {
  process.exit = nativeExit;
  for (const [method, original] of childProcessMethods) childProcess[method] = original;
}

function restoreNetworkBlock() {
  global.fetch = network.fetch;
  http.request = network.httpRequest;
  http.get = network.httpGet;
  https.request = network.httpsRequest;
  https.get = network.httpsGet;
}

function captureConsole() {
  for (const method of ['log', 'info', 'warn', 'error']) {
    consoleMethods[method] = console[method];
    console[method] = (...args) => {
      if (currentRun) currentRun.logs.push(args.map((value) => String(value)).join(' ').slice(0, 240));
    };
  }
}

function restoreConsole() {
  for (const [method, original] of Object.entries(consoleMethods)) console[method] = original;
}

function createSocket(run) {
  const participants = [
    { id: OWNER, admin: 'admin' },
    { id: TARGET, admin: 'admin' },
  ];
  const metadata = {
    id: GROUP,
    subject: 'Smoke Test Group',
    owner: OWNER,
    participants,
    announce: false,
    restrict: false,
  };
  const response = (method, args) => {
    run.socketCalls.push(method);
    if (method === 'sendMessage') {
      const [jid, content] = args;
      run.messages.push(content || {});
      return Promise.resolve({
        key: { id: `SMOKE-${run.socketCalls.length}`, remoteJid: jid, fromMe: true },
      });
    }
    if (method === 'groupMetadata') return Promise.resolve(metadata);
    if (method === 'groupParticipantsUpdate') {
      const [jid, jids, action] = args;
      return Promise.resolve((Array.isArray(jids) ? jids : [jids]).map((id) => ({ jid: id, status: '200', action })));
    }
    if (method === 'groupInviteCode') return Promise.resolve('SMOKEINVITE');
    if (method === 'groupRevokeInvite') return Promise.resolve('SMOKEINVITENEW');
    if (method === 'profilePictureUrl') return Promise.resolve('https://example.invalid/avatar.jpg');
    if (method === 'onWhatsApp') return Promise.resolve([{ exists: true, jid: args[0] }]);
    if (method === 'getBusinessProfile') return Promise.resolve(null);
    if (method === 'getUSyncDevices') return Promise.resolve([{ user: TARGET, device: 0 }]);
    if (method === 'newsletterCreate') return Promise.resolve({ id: 'smoke@newsletter', name: args[0] });
    if (method === 'groupRequestParticipantsList') return Promise.resolve([]);
    if (method === 'groupFetchAllParticipating') return Promise.resolve({ [GROUP]: metadata });
    if (method === 'fetchBlocklist' || method === 'fetchStatus') return Promise.resolve([]);
    if (method === 'newsletterMetadata') return Promise.resolve({ id: args[0], name: 'Smoke Channel' });
    if (method === 'readMessages') return Promise.resolve(true);
    return Promise.resolve(undefined);
  };

  return new Proxy({ user: { id: OWNER, name: 'Smoke Bot' } }, {
    get(target, property) {
      if (property in target) return target[property];
      if (typeof property === 'symbol') return target[property];
      if (property === 'ev') return { on() {}, off() {}, emit() {} };
      return (...args) => response(String(property), args);
    },
  });
}

function createMessage(name, args, index) {
  const commandText = `${PREFIX}${name}${args.length ? ` ${args.join(' ')}` : ''}`;
  const quotedMessage = {
    key: { remoteJid: GROUP, participant: TARGET, id: `QUOTE-${index}`, fromMe: false },
    message: { conversation: 'Message quoted for smoke testing.' },
  };
  const contextInfo = {
    stanzaId: `QUOTE-${index}`,
    participant: TARGET,
    quotedMessage: quotedMessage.message,
    mentionedJid: [TARGET],
  };
  return {
    key: {
      remoteJid: GROUP,
      participant: OWNER,
      fromMe: true,
      id: `SMOKE-${index}`,
    },
    pushName: 'Smoke Owner',
    messageTimestamp: Math.floor(Date.now() / 1000),
    message: {
      conversation: commandText,
      extendedTextMessage: { text: commandText, contextInfo },
    },
  };
}

function argsFor(entry) {
  if (sampleArgs.has(entry.name)) return sampleArgs.get(entry.name);
  if (entry.requiresInput) return ['smoke'];
  if (entry.name === 'menu' || entry.name === 'help' || entry.name === 'list') return [];
  return entry.usage ? ['smoke'] : [];
}

function commandSkipReason(keys, entry) {
  for (const key of [entry.name, ...keys]) {
    const reason = excludedCommands.get(key);
    if (reason) return reason;
  }
  return null;
}

function textFromMessages(messages) {
  const values = [];
  function visit(value, key = '') {
    if (typeof value === 'string') {
      if (['text', 'caption', 'conversation', 'title', 'body'].includes(key)) values.push(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item, key);
      return;
    }
    if (value && typeof value === 'object') {
      for (const [childKey, child] of Object.entries(value)) visit(child, childKey);
    }
  }
  messages.forEach((message) => visit(message));
  return values.join('\n');
}

function safeError(error) {
  return String(error?.message || error || 'Erreur inconnue')
    .replace(/((?:key|token|appid|password|secret)=)[^&\s]+/gi, '$1[redacted]')
    .slice(0, 220);
}

async function main() {
  const envFile = path.join(tempRoot, '.env');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(sessionDir, { recursive: true });
  fs.mkdirSync(pluginDataDir, { recursive: true });
  fs.writeFileSync(envFile, '');
  process.env.DATA_DIR = dataDir;
  process.env.SESSION_DIR = sessionDir;
  process.env.ENV_FILE = envFile;
  process.env.OWNER_NUMBER = OWNER.split('@')[0];
  process.env.OWNER_NAME = 'Smoke Owner';
  process.env.MODE = 'public';
  process.env.PUBLIC_MODE = '1';

  Object.assign(paths, {
    STORAGE: tempRoot,
    SESSIONS: sessionDir,
    DATA: dataDir,
    PLUGIN_DATA: pluginDataDir,
    LOGS: path.join(tempRoot, 'logs'),
    DOWNLOADS: path.join(tempRoot, 'downloads'),
    ASSETS: path.join(tempRoot, 'assets'),
    BIN: path.join(tempRoot, 'bin'),
  });
  global.setTimeout = (callback, delay, ...args) => {
    const ownerRun = currentRun;
    return nativeSetTimeout(() => {
      const previousRun = currentRun;
      if (ownerRun) currentRun = ownerRun;
      try {
        callback(...args);
      } catch (error) {
        if (ownerRun) ownerRun.logs.push(safeError(error));
      } finally {
        currentRun = previousRun;
      }
    }, Math.min(Number(delay) || 0, 25));
  };
  global.setInterval = () => ({ unref() {}, ref() {} });
  global.clearInterval = () => {};
  installNetworkBlock();
  installProcessGuards();
  installWriteGuard();
  captureConsole();

  let handler;
  try {
    handler = require('../src/handlers/handler');
  } catch (error) {
    throw new Error(`Le handler ne se charge pas dans le harnais isolé : ${safeError(error)}`);
  }

  const keysByEntry = new Map();
  for (const [key, entry] of handler.commands) {
    if (!keysByEntry.has(entry)) keysByEntry.set(entry, []);
    keysByEntry.get(entry).push(key);
  }

  const commands = [...keysByEntry.entries()]
    .map(([entry, keys]) => ({ entry, keys: keys.sort() }))
    .sort((a, b) => a.entry.name.localeCompare(b.entry.name));

  for (let index = 0; index < commands.length; index += 1) {
    const { entry, keys } = commands[index];
    const name = entry.name || keys[0];
    const skipReason = name.startsWith('__')
      ? 'commande interne, non destinée à être appelée par un utilisateur'
      : commandSkipReason(keys, entry);
    if (skipReason) {
      excluded.push({ command: name, keys, reason: skipReason });
      continue;
    }

    const run = {
      networkAttempts: 0,
      processAttempts: 0,
      processExitAttempts: 0,
      socketCalls: [],
      messages: [],
      logs: [],
    };
    currentRun = run;
    const args = argsFor(entry);
    const sock = createSocket(run);
    const msg = createMessage(name, args, index);
    const q = args.join(' ');
    const sendResponse = (content) => sock.sendMessage(GROUP, content, { quoted: msg });
    const ctx = {
      from: GROUP,
      sender: OWNER,
      senderNum: OWNER.split('@')[0],
      isGroup: true,
      isOwner: true,
      isBotSelf: false,
      isAdmin: true,
      isBotAdmin: true,
      content: msg.message,
      msg,
      sock,
      args,
      q,
      command: String(name).toLowerCase(),
      reply: async (text, mentions) => sendResponse(
        typeof text === 'object' && text !== null
          ? text
          : mentions ? { text: String(text), mentions } : { text: String(text) },
      ),
      error: async (lines) => sendResponse({ text: Array.isArray(lines) ? lines.join('\n') : String(lines) }),
      info: async (lines) => sendResponse({ text: Array.isArray(lines) ? lines.join('\n') : String(lines) }),
      success: async (lines) => sendResponse({ text: Array.isArray(lines) ? lines.join('\n') : String(lines) }),
      saisie: async (hint) => sendResponse({ text: String(hint) }),
      react: async (emoji) => sendResponse({ react: { text: emoji, key: msg.key } }),
    };
    let thrown = null;
    let timedOut = false;
    let timeoutTimer;
    const timeout = new Promise((resolve) => {
      timeoutTimer = nativeSetTimeout(() => {
        timedOut = true;
        resolve();
      }, 2000);
      timeoutTimer.unref?.();
    });

    try {
      await Promise.race([entry.handler(ctx), timeout]);
      const settleMs = ['ascii', 'figlet', 'art', 'textart'].includes(name) ? 750 : 30;
      await new Promise((resolve) => nativeSetTimeout(resolve, settleMs));
    } catch (error) {
      thrown = error;
    } finally {
      clearTimeout(timeoutTimer);
    }
    currentRun = null;

    const responseText = textFromMessages(run.messages);
    const errorLog = run.logs.find((line) => line.includes(`[CMD] ${name}:`));
    const undefinedResponse = /undefined|\[object Object\]|\bNaN\b/i.test(responseText);
    let status = 'OK';
    if (timedOut) status = 'TIMEOUT';
    else if (thrown) status = 'PLANTE';
    else if (run.processExitAttempts) status = 'PLANTE';
    else if (undefinedResponse) status = 'UNDEFINED';
    else if (!run.messages.length) status = 'SILENCIEUSE';

    const whatsappMethods = [...new Set(run.socketCalls.filter((method) => realWhatsappMethods.test(method)))];
    results.push({
      command: name,
      keys,
      category: Number(entry.cat) || 1,
      status,
      responses: run.messages.length,
      networkAttempts: run.networkAttempts,
      blockedProcessAttempts: run.processAttempts,
      blockedExitAttempts: run.processExitAttempts,
      whatsappMethods,
      verification: run.networkAttempts
        ? 'non vérifiable sans réseau'
        : whatsappMethods.length
          ? 'non vérifiable sans WhatsApp/groupe réel'
          : 'test local isolé',
      error: thrown ? safeError(thrown) : errorLog ? errorLog.slice(0, 220) : null,
    });
  }

  const counts = Object.fromEntries(['OK', 'SILENCIEUSE', 'PLANTE', 'UNDEFINED', 'TIMEOUT'].map((status) => [
    status,
    results.filter((result) => result.status === status).length,
  ]));
  const verificationCounts = {
    network: results.filter((result) => result.networkAttempts > 0).length,
    whatsapp: results.filter((result) => result.whatsappMethods.length > 0).length,
    isolated: results.filter((result) => result.verification === 'test local isolé').length,
  };
  const report = {
    generatedAt: new Date().toISOString(),
    environment: 'sock Proxy ; aucun appel réseau ; stockage temporaire isolé',
    timeoutMs: 2000,
    totals: {
      commands: commands.length,
      tested: results.length,
      excluded: excluded.length,
      registryKeys: handler.commands.size,
      blockedWrites,
      redirectedWrites,
    },
    counts,
    verificationCounts,
    excluded,
    commands: results,
  };

  restoreConsole();
  restoreNetworkBlock();
  restoreProcessGuards();
  restoreWriteGuard();
  global.setTimeout = nativeSetTimeout;
  global.setInterval = nativeSetInterval;
  global.clearInterval = nativeClearInterval;

  const outputDirectory = path.join(root, 'reports');
  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.writeFileSync(path.join(outputDirectory, 'smoke.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  require('../src/lib/db').close();
  require('../src/lib/store').closeStore();
  const docsDirectory = path.join(root, 'docs');
  fs.mkdirSync(docsDirectory, { recursive: true });
  const networkCommands = results.filter((result) => result.networkAttempts > 0);
  const whatsappCommands = results.filter((result) => result.whatsappMethods.length > 0);
  const statusLines = Object.entries(counts).map(([status, count]) => `| ${status} | ${count} |`);
  const markdown = [
    '# Rapport du smoke test',
    '',
    `Généré automatiquement le ${report.generatedAt} par \`node scripts/smoke.js\`.`,
    '',
    `- Commandes distinctes : ${report.totals.commands}`,
    `- Testées : ${report.totals.tested}`,
    `- Exclues (dangereuses, destructrices ou internes) : ${report.totals.excluded}`,
    `- Clés du registre : ${report.totals.registryKeys}`,
    `- Écritures redirigées vers le temporaire : ${report.totals.redirectedWrites}`,
    '',
    '| Statut | Nombre |',
    '|---|---:|',
    ...statusLines,
    '',
    '## Limites et commandes non vérifiables',
    '',
    'Chaque commande a été appelée avec un faux `sock` Proxy et un contexte fictif. Aucun appel n’a été envoyé à WhatsApp et aucun réseau réel n’a été utilisé. Un statut `OK` valide seulement le comportement local observé avec ces stubs.',
    '',
    `### Réseau requis (${networkCommands.length})`,
    '',
    ...networkCommands.map((result) => `- \`${result.command}\``),
    '',
    `### Méthodes WhatsApp/groupe simulées (${whatsappCommands.length})`,
    '',
    ...whatsappCommands.map((result) => `- \`${result.command}\` — ${result.whatsappMethods.join(', ')}`),
    '',
    `### Exclusions (${excluded.length})`,
    '',
    ...excluded.map((item) => `- \`${item.command}\` (${item.keys.map((key) => `\`${key}\``).join(', ')}) — ${item.reason}`),
    '',
    'Les résultats détaillés, une ligne par commande testée, sont dans [`reports/smoke.json`](../reports/smoke.json).',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(docsDirectory, 'SMOKE.md'), markdown, 'utf8');
  fs.rmSync(tempRoot, { recursive: true, force: true });

  console.log(`Smoke : ${report.totals.tested}/${report.totals.commands} commandes testées ; ${report.totals.excluded} exclues.`);
  console.log(JSON.stringify({ counts, verificationCounts, blockedWrites, redirectedWrites, report: 'reports/smoke.json' }, null, 2));
  if (blockedWrites) console.warn(`Écritures hors du temporaire bloquées : ${blockedWrites}.`);
}

main().catch((error) => {
  restoreConsole();
  restoreNetworkBlock();
  restoreProcessGuards();
  restoreWriteGuard();
  global.setTimeout = nativeSetTimeout;
  global.setInterval = nativeSetInterval;
  global.clearInterval = nativeClearInterval;
  try { require('../src/lib/db').close(); } catch (cleanupError) {
    console.error(`[SMOKE] fermeture SQLite impossible : ${safeError(cleanupError)}`);
  }
  try { require('../src/lib/store').closeStore(); } catch (cleanupError) {
    console.error(`[SMOKE] fermeture du store impossible : ${safeError(cleanupError)}`);
  }
  try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch (cleanupError) {
    console.error(`[SMOKE] nettoyage temporaire impossible : ${safeError(cleanupError)}`);
  }
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
