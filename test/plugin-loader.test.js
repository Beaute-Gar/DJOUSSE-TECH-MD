'use strict';
/* Test d'intégration : adapter un module historique et exécuter sa commande. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const style = require('../src/config/style');
process.env.HACKTOOLS_PASSWORD = 'test';
/* On teste le ROUTAGE des plugins, pas le contrôle d'envoi : les jids de
   test ne sont pas consentis et wa-send refuserait les réponses.
   Le limiteur est couvert par test/envoi.test.js. */
process.env.ENVOI_ACTIF = '0';
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

/* Les modules historiques envoient via sock.sendMessage → le loader les proxifie
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

test('le registre a conservé plus de 1000 commandes historiques', () => {
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

test('alive utilise une réponse maison et conserve l’image de statut', async () => {
  const { out } = await runCmd('alive', [], 'status@g.us');
  assert.equal(out.length, 1);
  assert.equal(out[0].content.image.url, 'https://files.catbox.moe/h6zdty.png');
  assert.ok(out[0].content.caption.startsWith('╭┄┄『 '));
  assert.ok(out[0].content.caption.includes(style.toUnicode('DJOUSSE TECH')));
  assert.ok(!/silva/i.test(JSON.stringify(out[0].content)));
});

test('REEL - .8ball repond (commande maison conservee, sans ecrasement)', async () => {
  /* un module historique propose aussi 8ball : le chargeur NE l'a PAS enregistré car
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

test('RÉEL — .mathquiz pose un calcul (état conservé)', async () => {
  const { out, envoyes } = await runCmd('mathquiz', [], 'mathpartie@g.us');
  const txt = JSON.stringify([...out, ...envoyes.map((e) => e.content)]);
  assert.match(txt, /Quick Math|[0-9]+\s*[-+×x*]\s*[0-9]+/);
});

test('RÉEL — .flagquiz pose un drapeau à deviner', async () => {
  const { out, envoyes } = await runCmd('flagquiz', [], 'fl@g.us');
  assert.match(JSON.stringify([...out, ...envoyes.map((e) => e.content)]), /Country|Guess/i);
});

test('dreammeaning est autonome et interprète les symboles connus', async () => {
  const command = require('../src/commandes/05-outils/dreammeaning');
  assert.equal(command.__legacyCommand, undefined);
  const { out } = await runCmd('dreammeaning', ['water'], 'dream@g.us');
  const text = JSON.stringify(out);
  assert.ok(text.includes(style.toUnicode('Dream: Water')));
  assert.ok(text.includes(style.toUnicode('Meaning: Emotions')));
  assert.ok(text.includes('╭┄┄『'));

  const unknown = await runCmd('dream', ['unknown'], 'dream@g.us');
  assert.ok(JSON.stringify(unknown.out).includes(style.toUnicode('Unknown dream symbol')));
});

test('superpower est autonome et répond sans service externe', async () => {
  const command = require('../src/commandes/05-outils/superpower');
  assert.equal(command.__legacyCommand, undefined);
  const { out } = await runCmd('superpower', [], 'power@g.us');
  assert.ok(JSON.stringify(out).includes(style.toUnicode('Your Superpower')));
  assert.ok(JSON.stringify(out).includes('╭┄┄『'));
});

test('nickname, excuse et wouldyou sont autonomes', async () => {
  for (const [file, commandName, output] of [
    ['05-outils/nickname', 'nickname', 'Nickname Generator'],
    ['05-outils/excuse', 'excuse', 'Random Excuse'],
    ['07-fun/wouldyou', 'wouldyou', 'What Would You Do'],
  ]) {
    const command = require(`../src/commandes/${file}`);
    assert.equal(command.__legacyCommand, undefined, `${commandName} ne doit pas déléguer`);
    const { out } = await runCmd(commandName, [], `${commandName}@g.us`);
    const text = JSON.stringify(out);
    assert.ok(text.includes(style.toUnicode(output)));
    assert.ok(text.includes('╭┄┄『'));
  }
});

test('affirmation, lifeadvice et motivate sont autonomes', async () => {
  for (const [file, commandName, output] of [
    ['07-fun/affirmation', 'affirmation', 'Daily Affirmation'],
    ['07-fun/lifeadvice', 'lifeadvice', 'Life Advice'],
    ['05-outils/motivate', 'motivate', 'Motivation'],
  ]) {
    const command = require(`../src/commandes/${file}`);
    assert.equal(command.__legacyCommand, undefined, `${commandName} ne doit pas déléguer`);
    const { out } = await runCmd(commandName, [], `${commandName}@g.us`);
    const text = JSON.stringify(out);
    assert.ok(text.includes(style.toUnicode(output)));
    assert.ok(text.includes('╭┄┄『'));
  }
});

test('les générateurs fictifs et la plaisanterie sont autonomes', async () => {
  const legacyFile = path.resolve(__dirname, '../src/commandes/05-outils/_legacy-random-generators.js');
  assert.equal(fs.existsSync(legacyFile), false, 'le module historique a été supprimé');

  for (const [file, commandName, output] of [
    ['05-outils/fakename', 'fakename', 'Random Name'],
    ['05-outils/fakeaddress', 'fakeaddress', 'Random Address'],
    ['05-outils/fakeemail', 'fakeemail', '@example.com'],
    ['05-outils/fakephone', 'fakephone', '+1 (202) 555-01'],
    ['05-outils/fakeid', 'fakeid', 'Fictional Character'],
    ['07-fun/insult', 'insult', 'Friendly Roast'],
  ]) {
    const command = require(`../src/commandes/${file}`);
    assert.equal(command.__legacyCommand, undefined, `${commandName} ne doit pas déléguer`);
    const { out } = await runCmd(commandName, [], `${commandName}@g.us`);
    const text = JSON.stringify(out);
    assert.ok(text.includes(style.toUnicode(output)), `${commandName} doit appliquer le rendu central`);
    assert.ok(text.includes('╭┄┄『'));
    if (['fakename', 'fakeaddress', 'fakeemail', 'fakeid'].includes(commandName)) {
      assert.ok(text.includes(style.toUnicode('Fictional example')));
    }
    if (commandName === 'fakeid') {
      assert.ok(text.includes(style.toUnicode('not a real identity')));
    }
  }
});

test('time est autonome, stylé et valide le fuseau demandé', async () => {
  const command = require('../src/commandes/02-groupe/time');
  assert.equal(command.__legacyCommand, undefined);
  const legacyFile = path.resolve(__dirname, '../src/commandes/02-groupe/_legacy-time.js');
  assert.equal(fs.existsSync(legacyFile), false);

  const nairobi = await runCmd('time', ['Nairobi'], 'time@g.us');
  assert.ok(JSON.stringify(nairobi.out).includes(style.toUnicode('Time in Nairobi')));
  assert.ok(JSON.stringify(nairobi.out).includes(style.toUnicode('Africa/Nairobi')));

  const alias = await runCmd('clock', ['Asia/Tokyo'], 'time@g.us');
  assert.ok(JSON.stringify(alias.out).includes(style.toUnicode('Time in Asia/Tokyo')));
  assert.ok(JSON.stringify(alias.out).includes(style.toUnicode('Asia/Tokyo')));

  const invalid = await runCmd('time', ['NotARealTimezone'], 'time@g.us');
  assert.ok(JSON.stringify(invalid.out).includes(style.toUnicode('Unknown timezone')));
  assert.ok(JSON.stringify(invalid.out).includes('╭┄┄『'));
});

test('hello et runtime sont autonomes et utilisent le rendu central', async () => {
  for (const [file, commandName, args, expected] of [
    ['01-general/hello', 'hello', ['test'], ['Hello!', 'Arguments received: test']],
    ['01-general/runtime', 'runtime', [], ['DISPONIBILITÉ', 'MÉMOIRE LIBRE']],
  ]) {
    const command = require(`../src/commandes/${file}`);
    assert.equal(command.__legacyCommand, undefined, `${commandName} ne doit pas déléguer`);
    const { out } = await runCmd(commandName, args, `${commandName}@g.us`);
    const text = JSON.stringify(out);
    for (const fragment of expected) {
      assert.ok(text.includes(style.toUnicode(fragment)), `${commandName} doit inclure « ${fragment} »`);
    }
    assert.ok(text.includes('╭┄┄『'), `${commandName} doit appliquer le style central`);
  }
});

test('owner et creator sont un seul alias et protègent le contact absent', async () => {
  const owner = h.commands.get('owner');
  const creator = h.commands.get('creator');
  const config = require('../src/config/config');
  assert.ok(owner, '.owner doit exister');
  assert.strictEqual(creator, owner, '.creator doit être un alias du même handler');

  const registerOwner = require('../src/commandes/01-general/owner');
  const sent = [];
  const replies = [];
  let commandNames;
  let handler;
  registerOwner({
    config,
    send: async (...args) => sent.push(args),
    cmd: (names, options, run) => {
      commandNames = names;
      handler = run;
    },
  });
  assert.deepEqual(commandNames, ['owner', 'creator']);

  const savedOwnerNumber = config.ownerNumber;
  const ctx = {
    sock: {},
    from: 'creator@g.us',
    msg: { key: { remoteJid: 'creator@g.us' } },
    reply: async (text) => replies.push(text),
  };
  try {
    config.ownerNumber = ['237000000001'];
    await handler(ctx);
    const sentContent = JSON.stringify(sent);
    assert.match(sentContent, /BEGIN:VCARD/);
    assert.match(sentContent, /237000000001/);
    assert.equal(replies.length, 0);

    config.ownerNumber = [];
    await handler(ctx);
    assert.ok(JSON.stringify(replies).includes(style.toUnicode('OWNER_NUMBER')));
    assert.equal(sent.length, 1, 'aucune fiche contact invalide ne doit être envoyée');
  } finally {
    config.ownerNumber = savedOwnerNumber;
  }
});

test('dict est autonome et gère succès, absence de résultat et erreur', async () => {
  const command = require('../src/commandes/08-recherche/dict');
  const axios = require('axios');
  assert.equal(command.__legacyCommand, undefined);
  const originalGet = axios.get;
  try {
    axios.get = async () => ({
      data: [{
        word: 'serendipity',
        phonetic: '/ˌser.ənˈdɪp.ə.ti/',
        meanings: [{
          partOfSpeech: 'noun',
          definitions: [{ definition: 'The occurrence of fortunate discoveries by chance.' }],
          synonyms: ['luck'],
        }],
      }],
    });
    const success = await runCmd('dict', ['serendipity'], 'dict@g.us');
    const successText = JSON.stringify(success.out);
    assert.ok(successText.includes(style.toUnicode('Definition: serendipity')));
    assert.ok(successText.includes(style.toUnicode('fortunate discoveries')));

    axios.get = async () => { const error = new Error('not found'); error.response = { status: 404 }; throw error; };
    const missing = await runCmd('meaning', ['unknownword'], 'dict@g.us');
    assert.ok(JSON.stringify(missing.out).includes(style.toUnicode('No definition found')));

    axios.get = async () => { throw new Error('network down'); };
    const failed = await runCmd('dict', ['word'], 'dict@g.us');
    assert.ok(JSON.stringify(failed.out).includes(style.toUnicode('Dictionary lookup failed')));
  } finally {
    axios.get = originalGet;
  }
});

test('climate est autonome, stylé et utilise une clé météo configurée', async () => {
  const command = require('../src/commandes/08-recherche/climate');
  const axios = require('axios');
  const config = require('../src/config/config');
  assert.equal(command.__legacyCommand, undefined);
  const originalGet = axios.get;
  const originalKey = config.weatherApiKey;
  try {
    config.weatherApiKey = '';
    const unconfigured = await runCmd('climate', ['Nairobi'], 'climate@g.us');
    assert.ok(JSON.stringify(unconfigured.out).includes(style.toUnicode('OPENWEATHER_API_KEY')));

    let request;
    config.weatherApiKey = 'test-weather-key';
    axios.get = async (...args) => {
      request = args;
      return {
        data: {
          name: 'Nairobi',
          sys: { country: 'KE' },
          main: { temp: 24, temp_min: 20, temp_max: 27, humidity: 60 },
          wind: { speed: 3 },
          weather: [{ description: 'light rain' }],
        },
      };
    };
    const success = await runCmd('climate', ['Nairobi'], 'climate@g.us');
    const text = JSON.stringify(success.out);
    assert.equal(request[0], 'https://api.openweathermap.org/data/2.5/weather');
    assert.equal(request[1].params.appid, 'test-weather-key');
    assert.ok(text.includes(style.toUnicode('Nairobi')));
    assert.ok(text.includes(style.toUnicode('Weather Report')));
    assert.ok(text.includes(style.toUnicode('24°C')));
    assert.ok(text.includes(style.toUnicode('Humidity: 60%')));

    axios.get = async () => {
      const error = new Error('not found');
      error.response = { status: 404 };
      throw error;
    };
    const missing = await runCmd('mosam', ['NoSuchCity'], 'climate@g.us');
    assert.ok(JSON.stringify(missing.out).includes(style.toUnicode('Ville introuvable')));
  } finally {
    axios.get = originalGet;
    config.weatherApiKey = originalKey;
  }
});

test('news est autonome, valide les catégories et conserve ses sources de secours', async () => {
  const command = require('../src/commandes/08-recherche/news');
  const axios = require('axios');
  const config = require('../src/config/config');
  assert.equal(command.__legacyCommand, undefined);
  const originalGet = axios.get;
  const originalKey = config.gnewsKey;
  const originalWarn = console.warn;
  try {
    const invalid = await runCmd('news', ['unknown'], 'news@g.us');
    assert.ok(JSON.stringify(invalid.out).includes(style.toUnicode('Catégorie invalide')));

    axios.get = async () => ({
      data: { items: [{ title: 'BBC headline', link: 'https://bbc.example/news' }] },
    });
    const headlines = await runCmd('headlines', ['africa'], 'news@g.us');
    assert.ok(JSON.stringify(headlines.out).includes(style.toUnicode('BBC headline')));
    assert.ok(JSON.stringify(headlines.out).includes(style.toUnicode('africa')));

    config.gnewsKey = 'test-news-key';
    axios.get = async (url) => {
      if (url.includes('rss2json')) throw new Error('feed unavailable');
      return {
        data: {
          articles: [{ title: 'Fallback headline', url: 'https://news.example/item' }],
        },
      };
    };
    console.warn = () => {};
    const fallback = await runCmd('news', ['tech'], 'news@g.us');
    assert.ok(JSON.stringify(fallback.out).includes(style.toUnicode('Fallback headline')));

    config.gnewsKey = '';
    axios.get = async () => { throw new Error('network down'); };
    const failed = await runCmd('news', [], 'news@g.us');
    assert.ok(JSON.stringify(failed.out).includes(style.toUnicode('Impossible de récupérer les actualités')));
  } finally {
    axios.get = originalGet;
    config.gnewsKey = originalKey;
    console.warn = originalWarn;
  }
});

test('domain est autonome, valide les entrées et affiche les données RDAP', async () => {
  const command = require('../src/commandes/08-recherche/domain');
  const axios = require('axios');
  assert.equal(command.__legacyCommand, undefined);
  const originalGet = axios.get;
  try {
    let requestedUrl;
    axios.get = async (url) => {
      requestedUrl = url;
      return {
        data: {
          ldhName: 'example.com',
          status: ['active'],
          events: [{ eventAction: 'registration', eventDate: '2000-01-01T00:00:00Z' }],
          nameservers: [{ ldhName: 'ns1.example.com' }],
        },
      };
    };
    const result = await runCmd('domain', ['https://Example.com/path'], 'domain@g.us');
    const text = JSON.stringify(result.out);
    assert.equal(requestedUrl, 'https://rdap.org/domain/example.com');
    assert.ok(text.includes(style.toUnicode('WHOIS: example.com')));
    assert.ok(text.includes(style.toUnicode('Registered: 2000-01-01')));

    const invalid = await runCmd('domaininfo', ['not a domain'], 'domain@g.us');
    assert.ok(JSON.stringify(invalid.out).includes(style.toUnicode('nom de domaine valide')));
  } finally {
    axios.get = originalGet;
  }
});

test('wikipedia est autonome et affiche la page résumée avec le style central', async () => {
  const command = require('../src/commandes/08-recherche/wikipedia');
  const axios = require('axios');
  assert.equal(command.__legacyCommand, undefined);
  const originalGet = axios.get;
  try {
    axios.get = async (url) => {
      if (url.endsWith('/w/api.php')) {
        return { data: { query: { search: [{ title: 'Black hole' }] } } };
      }
      return {
        data: {
          displaytitle: 'Black hole',
          extract: 'A region of spacetime with strong gravity.',
          thumbnail: { source: 'https://upload.wikimedia.org/example.jpg' },
          content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Black_hole' } },
        },
      };
    };
    const result = await runCmd('search', ['black', 'holes'], 'wiki@g.us');
    const sent = JSON.stringify([...result.out, ...result.envoyes.map((entry) => entry.content)]);
    assert.ok(sent.includes(style.toUnicode('Black hole')));
    assert.ok(sent.includes(style.toUnicode('strong gravity')));
    assert.match(sent, /╭┄┄『/);

    axios.get = async () => ({ data: { query: { search: [] } } });
    const missing = await runCmd('search', ['unknown'], 'wiki@g.us');
    assert.ok(JSON.stringify(missing.out).includes(style.toUnicode('Aucun résultat trouvé')));
  } finally {
    axios.get = originalGet;
  }
});

test('githubstalk est autonome, stylé et tolère les API secondaires indisponibles', async () => {
  const command = require('../src/commandes/08-recherche/githubstalk');
  const axios = require('axios');
  assert.equal(command.__legacyCommand, undefined);
  const originalGet = axios.get;
  try {
    axios.get = async (url) => {
      if (url.endsWith('/repos')) return { data: [{ name: 'project', language: 'JavaScript', stargazers_count: 12 }] };
      if (url.endsWith('/orgs')) throw new Error('optional endpoint unavailable');
      return {
        data: {
          login: 'octocat',
          name: 'The Octocat',
          type: 'User',
          followers: 1200,
          following: 10,
          public_repos: 8,
          public_gists: 2,
          created_at: '2011-01-25T18:44:36Z',
          avatar_url: 'https://avatars.githubusercontent.com/u/583231?v=4',
        },
      };
    };
    const result = await runCmd('githubstalk', ['@octocat'], 'github@g.us');
    const sent = JSON.stringify([...result.out, ...result.envoyes.map((entry) => entry.content)]);
    for (const fragment of ['GitHub Profile Report', 'octocat', 'The Octocat', 'project']) {
      assert.ok(sent.includes(style.toUnicode(fragment)), `sortie stylée doit inclure ${fragment}`);
    }
    assert.match(sent, /╭┄┄『/);

    const invalid = await runCmd('gh', ['bad user'], 'github@g.us');
    assert.ok(JSON.stringify(invalid.out).includes(style.toUnicode('nom GitHub valide')));
  } finally {
    axios.get = originalGet;
  }
});

test('sha1 est autonome et produit le digest attendu', async () => {
  const command = require('../src/commandes/10-divers/sha1');
  const crypto = require('node:crypto');
  assert.equal(command.__legacyCommand, undefined);
  const result = await runCmd('sha1', ['hello', 'world'], 'sha1@g.us');
  const output = JSON.stringify(result.out);
  const digest = crypto.createHash('sha1').update('hello world').digest('hex');
  assert.ok(output.includes(style.toUnicode(digest)));

  const missing = await runCmd('sha1', [], 'sha1@g.us');
  assert.ok(JSON.stringify(missing.out).includes(style.toUnicode('Indique le texte à hacher')));
});

test('currency est autonome et valide les devises avant la conversion', async () => {
  const command = require('../src/commandes/10-divers/currency');
  const axios = require('axios');
  assert.equal(command.__legacyCommand, undefined);
  const originalGet = axios.get;
  try {
    let request;
    axios.get = async (...args) => {
      request = args;
      return { data: { date: '2026-01-02', rates: { KES: 129.5 } } };
    };
    const converted = await runCmd('currency', ['100', 'usd', 'kes'], 'currency@g.us');
    assert.equal(request[0], 'https://api.frankfurter.app/latest');
    assert.deepEqual(request[1].params, { amount: 100, from: 'USD', to: 'KES' });
    assert.ok(JSON.stringify(converted.out).includes(style.toUnicode(`${(129.5).toLocaleString()} KES`)));

    const invalid = await runCmd('currency', ['-5', 'USD', 'KES'], 'currency@g.us');
    assert.ok(JSON.stringify(invalid.out).includes(style.toUnicode('Usage')));
  } finally {
    axios.get = originalGet;
  }
});

test('outils de recherche lexicale et phrasebook utilisent le rendu central', async () => {
  for (const [commandName, args, expected] of [
    ['rhyme', ['cat'], ['Rhymes for', 'bat']],
    ['synonym', ['happy'], ['Synonyms for', 'joyful']],
    ['antonym', ['happy'], ['Antonym of', 'sad']],
    ['phrasebook', [], ['Swahili Phrasebook', 'Habari yako']],
  ]) {
    const result = await runCmd(commandName, args, `${commandName}@g.us`);
    const content = JSON.stringify(result.out);
    for (const fragment of expected) {
      assert.ok(content.includes(style.toUnicode(fragment)), `${commandName} doit inclure ${fragment}: ${content}`);
    }
    assert.match(content, /╭┄┄『/);
  }
});

test('les commandes interdites (crash/NSFW) ne sont PAS enregistrées', () => {
  for (const n of ['loccrash', 'crashbug', 'amountbug', 'bombug', 'lagbug', 'terminate', 'hentai']) {
    assert.ok(!h.commands.has(n), `${n} ne doit pas exister`);
  }
});

test('aucun module de commande ne pose de listener (pas de double écoute)', () => {
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

test('les catégories recouvrent les 11 menus', () => {
  const cats = new Set();
  for (const e of h.commands.values()) cats.add(e.cat);
  const attendues = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  for (const a of attendues) assert.ok(cats.has(a), `catégorie ${a} utilisée`);
});

test('les anciennes variantes de commandes pointent vers un handler unique', () => {
  for (const [alias, canonical] of [
    ['groupname', 'setname'],
    ['setdescription', 'setdesc'],
    ['members', 'listmembers'],
  ]) {
    assert.strictEqual(h.commands.get(alias), h.commands.get(canonical), `${alias} doit partager ${canonical}`);
  }
});

test('aucun nom de commande plugin n’est déclaré dans plusieurs fichiers', () => {
  const { scanCommandFiles } = require('../src/commandes/_partage/scan');
  const { resolveLegacyDefinition } = require('../src/commandes/_partage/legacy-plugin');
  const root = path.resolve(__dirname, '..', 'src', 'commandes');
  const filesByName = new Map();
  for (const filePath of scanCommandFiles(root)) {
    let loaded;
    try { loaded = resolveLegacyDefinition(require(filePath), filePath); } catch { continue; }
    if (loaded?.maison) continue;
    for (const plugin of Array.isArray(loaded) ? loaded : [loaded]) {
      if (!plugin || !Array.isArray(plugin.commands)) continue;
      for (const name of [...plugin.commands, ...(plugin.aliases || plugin.alias || [])]) {
        const key = String(name).trim().toLowerCase();
        const files = filesByName.get(key) || [];
        files.push(path.relative(root, filePath));
        filesByName.set(key, files);
      }
    }
  }
  const duplicates = [...filesByName].filter(([, files]) => files.length > 1);
  assert.deepEqual(duplicates, [], `noms dupliqués: ${JSON.stringify(duplicates)}`);
});

test('les effets de texte sont autonomes, stylés et gardent leur accès groupe', async () => {
  const effects = require('../src/commandes/05-outils/_text-effects');
  const noms = [
    'advancedglow', 'americanflag', 'blackpinklogo', 'blackpinkstyle',
    'cartoonstyle', 'deletingtext', 'effectclouds', 'galaxy', 'galaxystyle',
    'glitchtext', 'glossysilver', 'glowingtext', 'gradienttext', 'lighteffect',
    'logo1917', 'logomaker', 'luxurygold', 'makingneon', 'neonglitch',
    'nigerianflag', 'papercut', 'pixelglitch', 'sandsummer', 'summerbeach',
    'texteffect', 'typographytext', 'underwater', 'writetext',
  ];

  const legacyFile = path.resolve(__dirname, '../src/commandes/05-outils/_legacy-logo2.js');
  assert.equal(fs.existsSync(legacyFile), false, 'la source historique est supprimée');

  for (const nom of noms) {
    const source = fs.readFileSync(
      path.resolve(__dirname, `../src/commandes/05-outils/${nom}.js`),
      'utf8',
    );
    assert.equal(source.includes('__legacyCommand'), false, `${nom} ne délègue plus`);
    if (nom === 'typographytext') {
      assert.equal(h.commands.has(nom), false, '.typographytext reste désactivée');
      continue;
    }
    const entry = h.commands.get(nom);
    assert.ok(entry, `.${nom} doit rester enregistrée`);
    assert.equal(entry.group, true, `.${nom} reste réservée au groupe`);
    assert.equal(entry.permission, 'GROUP');
  }

  assert.ok(h.commands.has('logolist'), '.logolist reste fournie par le catalogue de logos');

  const { out } = await runCmd('advancedglow', ['DJOUSSE', 'TECH'], 'effets@g.us');
  assert.equal(out.length, 1);
  const texte = out[0].content.text;
  assert.ok(texte.startsWith('╭┄┄『 '), 'rendu central attendu');
  assert.ok(texte.includes(effects.effect('advancedglow', 'DJOUSSE TECH').text));
  assert.ok(texte.includes(style.toUnicode('Text: DJOUSSE TECH')));

  const vide = await runCmd('galaxy', [], 'effets@g.us');
  const erreur = vide.out[0].content.text;
  assert.ok(erreur.startsWith('╭┄┄『 '), 'l’usage manquant est rendu par style.js');
  assert.ok(erreur.includes(style.toUnicode('Usage: .galaxy <your text>')));
  assert.ok(erreur.includes(style.toUnicode('Use .logolist to see all styles')));

  assert.equal(effects.transform('Ab', 'bold'), '𝐀𝐛');
  assert.equal(effects.getStyle('inconnu').style, 'logo');
});
