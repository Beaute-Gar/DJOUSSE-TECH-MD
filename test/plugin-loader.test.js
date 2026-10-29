'use strict';
/* Vrai test : adapter un plugin silva et EXÉCUTER sa commande pour de vrai. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
process.env.HACKTOOLS_PASSWORD = 'test';
const h = require('../src/handlers/handler');

/* contexte d'exécution façon executeCommand() de handler.js */
function ctx(args, from) {
  const out = [];
  const sock = {
    user: { id: 'bot@s.whatsapp.net' },
    sendMessage: async (jid, content) => { out.push({ jid, content }); return { key: { remoteJid: jid, id: 'X1' } }; },
    groupMetadata: async () => ({ subject: 'Test', participants: [{ id: 'a@s.whatsapp.net', admin: 'admin' }] }),
    groupParticipantsUpdate: async () => {},
    profilePictureUrl: async () => 'https://x/y.jpg',
    sendPresenceUpdate: async () => {},
  };
  const c = {
    ...{ from: from || 'g@g.us', sender: '111@s.whatsapp.net', senderNum: '111', isGroup: true, isOwner: true, isAdmin: true, isBotAdmin: true },
    args, sock, msg: { key: { remoteJid: from || 'g@g.us' }, message: {} },
    reply: async (t) => out.push({ jid: from || 'g@g.us', content: { text: String(t) } }),
    error: async (l) => out.push({ content: { error: l } }),
    success: async (l) => out.push({ content: { ok: l } }),
  };
  return { c, out };
}

/* Les plugins silva envoient via sock.sendMessage → le loader les proxifie
   par lib/wa-send.js. On espionne wa-send pour vérifier les DEUX chemins. */
const waSend = require('../src/lib/wa-send');
const origSend = waSend.send;
let envoyesViaWaSend = [];
function espionner() {
  envoyesViaWaSend = [];
  waSend.send = async (sock, jid, content) => { envoyesViaWaSend.push({ jid, content }); };
}
function restaurer() { waSend.send = origSend; }

async function runCmd(nom, args, from, text) {
  const entry = h.commands.get(nom);
  assert.ok(entry, `commande ${nom} enregistrée`);
  const { c, out } = ctx(args, from);
  if (text) c.msg.message = { conversation: text };
  espionner();
  try {
    await entry.handler(c);
  } catch (e) {
    restaurer();
    /* une commande tierce peut légitimement lever si son API est morte :
       ce n'est pas un plantage du bot, la commande répond son erreur. */
    throw e;
  }
  restaurer();
  return { out, envoyes: envoyesViaWaSend };
}

test('le chargeur a enregistré plus de 1000 commandes silva', () => {
  assert.ok(h.commands.size > 1000, `attendu > 1000, obtenu ${h.commands.size}`);
  console.log('   registre total :', h.commands.size);
});

test('les familles consolidées gardent un nom principal et au plus un alias', () => {
  const removed = [
    'groupstatus', 'adminlist', 'gadmins', 'gage', 'gexport', 'gjoinlog',
    'groupage', 'grpinfo', 'gstatus', 'joinlog', 'groupinfo2', 'gstats',
    'levels', 'rank', 'xp', 'contactsave', 'exportvcf', 'readvcf',
    'savecontacts', 'vcfgroup', 'vcfnumber', 'vcfread', 'vcfview',
    'addnote', 'adminclearnotes', 'admindelnote', 'adminnotes',
    'adminupdatenote', 'allnotes', 'delallnotes', 'delnote', 'getnote',
    'getnotes', 'updatenote', 'addexpense', 'balances', 'clearexpenses',
    'settle',
  ];
  for (const name of removed) assert.equal(h.commands.has(name), false, `${name} doit être retirée`);
  assert.equal(h.commands.get('groupstats')?.cat, 3, 'la statistique de protection reste distincte');
  for (const name of ['groupinfo', 'leaderboard', 'vcfgen', 'note', 'expense']) {
    const entry = h.commands.get(name);
    assert.ok(entry, `${name} doit rester enregistrée`);
    assert.ok((entry.aliases || []).length <= 1, `${name} ne doit pas dépasser un alias`);
  }
  assert.equal(h.commands.get('notes'), h.commands.get('note'));
  assert.equal(h.commands.get('expenses'), h.commands.get('expense'));
  assert.equal(h.commands.get('lb'), h.commands.get('leaderboard'));
});

test('les nouvelles sous-commandes répondent sans rappeler les anciennes commandes', async () => {
  const admins = await runCmd('groupinfo', ['admins'], 'g@g.us', '.groupinfo admins');
  assert.match(JSON.stringify(admins), /Admin/i);

  const stats = await runCmd('groupinfo', ['stats'], 'g@g.us', '.groupinfo stats');
  assert.match(JSON.stringify(stats), /Group Statistics/);

  const profile = await runCmd('leaderboard', ['me'], 'levels@g.us', '.leaderboard me');
  assert.match(JSON.stringify(profile), /Your Level/);

  const vcf = await runCmd('vcfgen', ['read'], 'vcf@g.us', '.vcfgen read');
  assert.match(JSON.stringify(vcf), /VCF Reader/);

  const note = await runCmd('note', ['unknown'], 'notes@g.us', '.note unknown');
  assert.match(JSON.stringify(note), /Usage.*note/i);

  const expense = await runCmd('expense', ['unknown'], 'expense@g.us', '.expense unknown');
  assert.match(JSON.stringify(expense), /𝚎𝚡𝚙𝚎𝚗𝚜𝚎/);

  const split = await runCmd('expense', ['split', '1200', '4', 'Dinner'], 'expense@g.us', '.expense split 1200 4 Dinner');
  assert.match(JSON.stringify(split), /300/);
});

test('REEL - .8ball repond (commande maison conservee, pas ecrasee par silva)', async () => {
  /* silva a aussi un plugin 8ball : le chargeur NE l'a PAS enregistre car
     notre commande existait deja. C'est donc la notre qui repond. */
  const { out } = await runCmd('8ball', ['vais-je', 'etre', 'riche'], 'g@g.us');
  const txt = JSON.stringify(out);
  assert.match(txt, /certain|doubt|definitely|likely|signs point|ask again|cannot predict|concentrate|count on|reply is no|sources say|doubtful|outlook|8ball/i);
});

test('protection anti-ecrasement : notre .8ball reste la notre (usage FR)', async () => {
  const { out } = await runCmd('8ball', [], 'g@g.us');
  assert.match(JSON.stringify(out), /Usage.*r[ée]ussir/i);
});

test('RÉEL — .emojiguess lance un devinette (état du plugin conservé)', async () => {
  const { out, envoyes } = await runCmd('emojiguess', [], 'partie1@g.us');
  assert.match(JSON.stringify([...out, ...envoyes.map((e) => e.content)]), /Guess|emoji|Movie/i);
});

test('RÉEL — .mathquiz pose un calcul (plugin silva avec état)', async () => {
  const { out, envoyes } = await runCmd('mathquiz', [], 'mathpartie@g.us');
  const txt = JSON.stringify([...out, ...envoyes.map((e) => e.content)]);
  assert.match(txt, /Quick Math|[0-9]+\s*[-+×x*]\s*[0-9]+/);
});

test('RÉEL — .flagquiz pose un drapeau à deviner', async () => {
  const { out, envoyes } = await runCmd('flagquiz', [], 'fl@g.us');
  assert.match(JSON.stringify([...out, ...envoyes.map((e) => e.content)]), /Country|Guess/i);
});

test('les commandes interdites (crash/NSFW) ne sont PAS enregistrées', () => {
  for (const n of ['loccrash', 'crashbug', 'amountbug', 'bombug', 'lagbug', 'terminate', 'hentai']) {
    assert.ok(!h.commands.has(n), `${n} ne doit pas exister`);
  }
});

test('aucun plugin silva ne pose de listener (pas de double écoute)', () => {
  const fs = require('fs');
  const { scanCommandFiles } = require('../src/commandes/_partage/scan');
  const fichiers = scanCommandFiles();
  const coupables = [];
  for (const filePath of fichiers) {
    const src = fs.readFileSync(filePath, 'utf8');
    if (/\.ev\s*\.\s*on\s*\(/.test(src)) coupables.push(filePath);
  }
  assert.deepEqual(coupables, [], `plugins avec listener : ${coupables.join(', ')}`);
});

test('les modules séparés résolvent une commande depuis le plugin partagé', () => {
  const { loadCommandPlugins, scanCommandFiles } = require('../src/commandes/_partage/scan');
  const { loadCorePlugins } = require('../src/lib/plugin-loader');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-plugin-test-'));
  const secondSourceDirectory = path.join(root, '01-general');
  const sourceDirectory = path.join(root, '02-groupe');
  const wrapperDirectory = path.join(root, '05-outils');
  fs.mkdirSync(secondSourceDirectory);
  fs.mkdirSync(sourceDirectory);
  fs.mkdirSync(wrapperDirectory);
  const sourceFile = path.join(sourceDirectory, '_legacy-math.js');
  const wrapperFile = path.join(wrapperDirectory, 'add.js');
  const secondSourceFile = path.join(secondSourceDirectory, '_legacy-fun.js');
  const secondWrapperFile = path.join(wrapperDirectory, 'a-first.js');
  fs.writeFileSync(sourceFile, [
    'module.exports = [',
    '  { commands: ["add", "sum"], description: "Add", run: async () => "ok" },',
    '  { commands: ["multiply"], description: "Multiply", run: async () => "mul" },',
    '];',
  ].join('\n'));
  fs.writeFileSync(secondSourceFile, [
    'module.exports = { commands: ["zeta"], description: "Zeta", run: async () => "z" };',
  ].join('\n'));

  const metadata = {
    source: path.relative(path.dirname(wrapperFile), sourceFile),
    sourceFile: path.join('02-groupe', 'math-tools.js'),
    definitionIndex: 0,
    entryOrder: 0,
    names: ['add', 'sum'],
    category: 5,
  };
  const secondMetadata = {
    source: path.relative(path.dirname(secondWrapperFile), secondSourceFile),
    sourceFile: path.join('01-general', 'z-original.js'),
    definitionIndex: 0,
    entryOrder: 1,
    names: ['zeta'],
    category: 5,
  };
  fs.writeFileSync(wrapperFile, [
    `// @legacy-order ${JSON.stringify(metadata)}`,
    'module.exports = { __legacyCommand: ' + JSON.stringify(metadata)
      + ', commands: ["add", "sum"] };',
  ].join('\n'));
  fs.writeFileSync(secondWrapperFile, [
    `// @legacy-order ${JSON.stringify(secondMetadata)}`,
    'module.exports = { __legacyCommand: ' + JSON.stringify(secondMetadata)
      + ', commands: ["zeta"] };',
  ].join('\n'));

  try {
    const files = scanCommandFiles(root);
    assert.deepEqual(files, [wrapperFile, secondWrapperFile]);
    const plugins = loadCommandPlugins(root);
    assert.equal(plugins.length, 2);
    assert.deepEqual(plugins[0].commands, ['add', 'sum']);
    assert.equal(typeof plugins[0].run, 'function');
    assert.equal(plugins[0].description, 'Add');
    assert.deepEqual(plugins[1].commands, ['zeta']);

    const registrations = [];
    const report = loadCorePlugins(
      (names, options, handler) => registrations.push({ names, options, handler }),
      {
        config: { botName: 'Test Bot', prefix: '.' },
        send: async () => {},
        dir: root,
        exists: () => false,
      },
    );
    assert.equal(report.commandes, 3);
    assert.deepEqual(registrations[0].names, ['add', 'sum']);
    assert.equal(registrations[0].options.cat, 5);
    assert.equal(typeof registrations[0].handler, 'function');
    assert.deepEqual(registrations[1].names, ['zeta']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('les catégories silva recouvrent les 11 menus', () => {
  const cats = new Set();
  for (const e of h.commands.values()) cats.add(e.cat);
  const attendues = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  for (const a of attendues) assert.ok(cats.has(a), `catégorie ${a} utilisée`);
});
