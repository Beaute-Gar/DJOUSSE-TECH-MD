/* Command Test Harness — exécute TOUTES les commandes du registre en dry-run.
   Usage: node scripts/test-commands.cjs [--quick] [--json]
   --quick  : ne teste que la liste représentative GROUPS (rapide)
   (défaut) : boucle sur tout le registre réel (377) avec timeout par commande.
   Écrit data/command-test-results.json pour command-health.cjs.
   Ne se connecte pas à WhatsApp : vérifie reconnaissance + exécution sans crash
   sur la surface du moteur wwebjs. */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { commands } = require(path.join(ROOT, 'command.cjs'));
const { sms } = require(path.join(ROOT, 'lib', 'wwebjs-msg.cjs'));

const QUICK = process.argv.includes('--quick');
const AS_JSON = process.argv.includes('--json');

const { pathToFileURL } = require('url');
const pluginsDir = path.join(ROOT, 'plugins');
const pluginFiles = fs.readdirSync(pluginsDir)
  .filter(f => f.endsWith('.js') || f.endsWith('.cjs') || f.endsWith('.mjs'))
  .sort((a, b) => a.localeCompare(b));
for (const file of pluginFiles.filter(f => !f.endsWith('.mjs'))) {
  try { require(path.join(pluginsDir, file)); } catch (e) { console.log('⚠️ load ' + file + ': ' + e.message); }
}

const CONN_METHODS = [
  'sendMessage', 'sendPresenceUpdate', 'readMessages', 'groupMetadata',
  'groupParticipantsUpdate', 'groupSettingUpdate', 'groupSettingsUpdate',
  'groupUpdateSubject', 'groupUpdateDescription', 'groupLeave',
  'groupFetchAllParticipating', 'profilePictureUrl', 'updateProfilePicture',
  'removeProfilePicture', 'getContacts', 'loadMessages', 'updateBlockStatus',
  'getChat', 'sendContact', 'downloadMediaMessage',
  'getLabels', 'sendMessageToGrid', 'getGroups',
];

function buildConn() {
  const calls = { sends: 0, missing: [] };
  const conn = { user: { id: '237693978044:41@s.whatsapp.net' }, ev: new (require('events').EventEmitter)() };
  for (const name of CONN_METHODS) {
    conn[name] = async (...args) => {
      if (name === 'sendMessage') calls.sends++;
      return name === 'groupMetadata'
        ? {
            id: '120363000000000000@g.us', subject: 'Groupe test', desc: '',
            participants: [
              { id: '237693978044@s.whatsapp.net', admin: 'admin' },
              { id: '237000000000@s.whatsapp.net', admin: undefined },
            ],
            owner: '237693978044@s.whatsapp.net', size: 2, _chat: {},
          }
        : (name === 'loadMessages' ? [] : (name === 'sendMessage' ? { key: { id: 'dry-' + Date.now(), remoteJid: args[0] || 'dry@c.us' } } : {}));
    };
  }
  conn._missing = (name) => { calls.missing.push(name); return {}; };
  return { conn, calls };
}

const withTimeout = (p, ms) => Promise.race([
  p,
  new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT(' + ms + 'ms)')), ms)),
]);

function label(cmd) {
  if (cmd.pattern instanceof RegExp) return String(cmd.pattern).replace(/^\/|\/([a-z]*)$/gi, '');
  return String(cmd.pattern || cmd.name || '?').toLowerCase().split('|')[0].trim();
}

const GROUPS = {
  'Messagerie': ['ping', 'alive', 'ask', 'ai', 'summarize', 'translate', 'dictionary', 'calc'],
  'Groupes': ['group', 'add', 'kick', 'promote', 'demote', 'warn', 'unwarn', 'close', 'open', 'setname', 'setdesc'],
  'Médias': ['vv', 'sticker', 'image', 'vision', 'enhance', 'convert', 'pdf'],
  'Recherche/Téléchargement': ['song', 'yts', 'movie', 'download', 'instagram', 'fb'],
  'Système': ['menu', 'allmenu', 'stats', 'system', 'myaccount', 'prefix', 'mode'],
  'AINORIA / Cognitive OS': ['ainoria', 'mode', 'sondage', 'participation', 'quiz', 'devinette', 'classement'],
};

function targetCommands() {
  if (QUICK) {
    const seen = new Set();
    const out = [];
    for (const [cat, list] of Object.entries(GROUPS)) {
      for (const name of list) {
        if (seen.has(name)) continue;
        seen.add(name);
        const cmd = commands.find(c => {
          if (!c.pattern) return false;
          const p = String(c.pattern).toLowerCase();
          const aliases = Array.isArray(c.alias) ? c.alias.map(a => String(a).toLowerCase()) : [];
          const regexHit = c.pattern instanceof RegExp && name.match(c.pattern);
          return p === name || aliases.includes(name) || regexHit;
        });
        out.push({ category: cat, cmd });
      }
    }
    return out;
  }
  return commands.filter(c => typeof c.function === 'function' && c.pattern)
    .map(c => ({ category: c.category || '—', cmd: c }));
}

(async () => {
  for (const file of pluginFiles.filter(f => f.endsWith('.mjs'))) {
    try { await import(pathToFileURL(path.join(pluginsDir, file)).href); } catch (e) { console.log('⚠️ load ' + file + ': ' + e.message); }
  }
  const { conn, calls } = buildConn();
  const connGlobal = conn;
  global.sock = connGlobal;
  global.__recentBotMessages = new Map();

  const targets = targetCommands();
  const d = [];
  let i = 0;
  for (const { category, cmd } of targets) {
    if (!cmd) { d.push({ category, command: '?', status: 'NOT_FOUND' }); continue; }
    i++;
    const name = label(cmd);
    const raw = {
      key: { remoteJid: '237693978044@s.whatsapp.net', fromMe: false, participant: '237693978044@s.whatsapp.net', id: 'dry-' + i },
      message: { conversation: '.' + name },
      messageTimestamp: Math.trunc(Date.now() / 1000),
      pushName: 'Tester',
      _wwebjs: true,
    };
    const m = sms(connGlobal, raw);
    m.body = '.' + name; m.chat = '237693978044@s.whatsapp.net'; m.isGroup = false;
    const ctx = { q: '', from: m.chat, args: '', reply: m.reply, quoted: null, isOwner: true, client: connGlobal, commands, ctx: { getQuoted: () => null } };
    calls.missing.length = 0;
    const before = calls.sends;
    const T0 = Date.now();
    try {
      await withTimeout(cmd.function(connGlobal, m, commands, ctx), 10000);
      d.push({ category, command: name, file: path.basename(cmd.filename || '?'), status: 'OK', ms: Date.now() - T0, sends: calls.sends - before });
    } catch (e) {
      const tm = e && e.message && e.message.startsWith('TIMEOUT');
      d.push({ category, command: name, file: path.basename(cmd.filename || '?'), status: tm ? 'TIMEOUT' : 'ERROR', error: (e && e.message || String(e)).slice(0, 140), ms: Date.now() - T0 });
    }
    if (i % 50 === 0) console.log(`  … ${i}/${targets.length}`);
  }

  const ok = d.filter(x => x.status === 'OK').length;
  const err = d.filter(x => x.status === 'ERROR').length;
  const tm = d.filter(x => x.status === 'TIMEOUT').length;
  const nf = d.filter(x => x.status === 'NOT_FOUND').length;

  const failing = d.filter(x => x.status !== 'OK');

  if (AS_JSON) {
    const out = {
      mode: QUICK ? 'quick' : 'full',
      tested: d.length,
      ok, errors: err, timeouts: tm, notFound: nf,
      timestamp: new Date().toISOString(),
      failed: failing.map(f => ({ command: f.command, file: f.file, status: f.status, error: f.error || '', category: f.category })),
    };
    fs.writeFileSync(path.join(ROOT, 'data', 'command-test-results.json'), JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out, null, 2));
    process.exit(0);
  }

  console.log('\n╭──── DJOUSSE TECH — COMMAND TEST HARNESS (FULL) ────╮');
  for (const row of d.filter(x => x.status === 'OK').slice(0, 0)) {} // (toutes listées? non, résumé ci-dessous)
  const errorsByFile = {};
  for (const f of failing) if (f.status === 'ERROR' || f.status === 'TIMEOUT') {
    errorsByFile[f.file] = errorsByFile[f.file] || [];
  }
  for (const row of d) {
    if (row.status === 'OK') continue;
    const icon = row.status === 'TIMEOUT' ? '⏳' : row.status === 'NOT_FOUND' ? '❔' : '❌';
    console.log(`│ ${icon} .${row.command.padEnd(22)} ${row.status.padEnd(7)} [${row.category}]${row.error ? ' — ' + row.error : ''}`);
  }
  console.log('├───────────────────────────────────────────────────┤');
  console.log(`│  Testées ${d.length}  ·  Fonctionnelles ${ok}  ·  À corriger ${err}  ·  Timeouts ${tm}  ·  Introuvables ${nf}`);
  console.log('╰───────────────────────────────────────────────────╯');
  process.exit(err > 0 ? 1 : 0);
})();