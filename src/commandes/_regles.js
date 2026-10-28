'use strict';

const SILVA_ALIAS = {
  addfilter: 'blockword',
  addword: 'addban',
  admins: '@admins',
  alive: 'bot',
  anon: 'anonmsg',
  antibadwords: 'noswear',
  antiban: 'safemode',
  antonym: 'ant',
  apk: 'apkdl',
  ascii3: 'arttext',
  auditlog: 'audit',
  autoread: 'readall',
  average: 'avg',
  badwordslist: 'badwords',
  bgm: 'addbgm',
  bible: 'verse',
  bodyfact: 'bodyf',
  border: 'box',
  brain: 'brainsize',
  calories: 'food',
  capitalquiz: 'cq',
  caption: 'what',
  car: 'carinfo',
  carbon: 'codeimg',
  celsius: 'ftoc',
  chatstats: 'whotalks',
  clearcache: 'cleanup',
  compliment: 'comp',
  device: 'wainfo',
  dict: 'meaning',
  discount: 'sale',
  dogbreed: 'dog',
  element: 'chem',
  emojiguess: 'eg',
  eval: 'js',
  facebook: 'fb',
  fahrenheit: 'ctof',
  fakename: 'name',
  flagquiz: 'fq',
  flashcard: 'fc',
  gdrive: 'gdl',
  getcode: 'getpair',
  getjid: 'whois',
  githubstalk: 'gh',
  goal: 'goals',
  greet: 'hi',
  guess: 'guessnum',
  hashtag: 'tags',
  heartrate: 'hr',
  htag: 'stag',
  httpcode: 'http',
  igstalk: 'iginfo',
  iloveyou: 'ily',
  imagine: 'img',
  instagram: 'ig',
  invest: 'investtip',
  json: 'jsonformat',
  leetspeak: '1337',
  linkpreview: 'tldr',
  listfilters: 'filterlist',
  loan: 'loancalc',
  mathquiz: 'mq',
  mediafire: 'mf',
  meditation: 'breathe',
  moviefact: 'movief',
  multiply: 'mul',
  nickname: 'nick',
  numberfact: 'number',
  openphoto: 'vvphoto',
  password2: 'genpass',
  percentage: 'pct',
  phrasebook: 'swahili',
  pickup: 'rizz',
  ping2: 'ms',
  play: 'song',
  poststatus: 'textstatus',
  power: 'pow',
  programming: 'lang',
  proverb: 'wisdom2',
  purge: 'clear',
  quote2: 'dq',
  quotly: 'q2s',
  random: 'rng',
  readreceipt: 'receipt',
  reminders: 'myreminders',
  removefilter: 'unfilter',
  removeword: 'delword',
  scanurl: 'urlscan',
  sh: 'bash',
  silvatech: 'svrepo',
  slang: 'genz',
  slot: 'slots',
  soundcloud: 'sc',
  split: 'billsplit',
  spotify: 'spdl',
  spp: 'getpp',
  steal: 'takesticker',
  step: 'steps',
  stock: 'shares',
  subtract: 'sub',
  tax: 'taxcalc',
  tempmail: 'tmpmail',
  tiktok: 'tt',
  tiktokstalk: 'ttuser',
  timestamp: 'epoch',
  todo: 'task',
  tongue: 'twister',
  tourl: 'geturl',
  transcribe: 'vtt',
  twitter: 'tw',
  typing: 'wpm',
  upper: 'caps',
  vocab: 'wotd',
  wordscramble: 'unscramble',
  workout: 'wod',
  zodiac: 'starsign',
};

const NOMS_SUPPRIMES = ['gi', 'memberlist', 'gcinfo', 'groupdesc'];
const ALIAS_FAMILLES = [
  ['anime', 'animesearch'],
  ['scamcheck', 'checkscam'],
  ['awaymsg', 'setaway'],
  ['djousse', 'agent'],
  ['figlet', 'art'],
  ['help', 'cmds'],
  ['pollresult', 'pollresults'],
  ['theme', 'themes'],
  ['tomp3', 'audio'],
  ['ytmp4', 'ytvideo'],
];
const NOMS_SYNONYMES_SUPPRIMES = [
  'ask', 'assistant', 'do', 'textart', 'commands',
  'pollstats', 'votes', 'tovn', 'ytv',
];

function appliquerTables(commands) {
  for (const key of [...commands.keys()]) {
    if (/silva/i.test(key)) commands.delete(key);
  }

  for (const name of NOMS_SUPPRIMES) commands.delete(name);

  for (const [oldName, survivor] of [['invitelink', 'groupinvite'], ['resetlink', 'newlink']]) {
    const entry = commands.get(survivor);
    if (entry && !commands.has(oldName)) commands.set(oldName, entry);
  }

  for (const [primary, alias] of Object.entries(SILVA_ALIAS)) {
    const entry = commands.get(primary);
    if (!entry) continue;
    for (const key of [...commands.keys()]) {
      if (commands.get(key) === entry && key !== primary && key !== alias) commands.delete(key);
    }
  }

  const statusCommand = commands.get('togstatus');
  if (statusCommand && !commands.has('togglestatus')) {
    const renamed = { ...statusCommand, name: 'togglestatus' };
    commands.set('togstatus', renamed);
    commands.set('togglestatus', renamed);
  }
}

function appliquerFamilles(commands) {
  for (const name of NOMS_SYNONYMES_SUPPRIMES) commands.delete(name);

  const keysByEntry = new Map();
  for (const [key, entry] of commands) {
    if (!keysByEntry.has(entry)) keysByEntry.set(entry, []);
    keysByEntry.get(entry).push(key);
  }

  const aliasPairsByEntry = new Map();
  for (const pair of ALIAS_FAMILLES) {
    const [primary, alias] = pair;
    const entry = commands.get(primary);
    if (!entry || commands.get(alias) !== entry) continue;
    if (!aliasPairsByEntry.has(entry)) aliasPairsByEntry.set(entry, []);
    aliasPairsByEntry.get(entry).push(pair);
  }

  for (const [entry, keys] of keysByEntry) {
    const primary = keys.includes(entry.name) ? entry.name : keys[0];
    if (keys.length <= 2) {
      entry.name = primary;
      entry.aliases = keys.filter((key) => key !== primary);
      continue;
    }

    const pairs = aliasPairsByEntry.get(entry) || [];
    const claimed = new Set();
    for (const [pairPrimary, alias] of pairs) {
      if (!keys.includes(pairPrimary) || !keys.includes(alias)) continue;
      const grouped = { ...entry, name: pairPrimary, aliases: [alias] };
      commands.set(pairPrimary, grouped);
      commands.set(alias, grouped);
      claimed.add(pairPrimary);
      claimed.add(alias);
    }

    for (const key of keys) {
      if (claimed.has(key)) continue;
      commands.set(key, { ...entry, name: key, aliases: [] });
    }
  }

  const aliasesByEntry = new Map();
  for (const [key, entry] of commands) {
    if (!aliasesByEntry.has(entry)) aliasesByEntry.set(entry, []);
    aliasesByEntry.get(entry).push(key);
  }
  for (const [entry, keys] of aliasesByEntry) {
    entry.aliases = keys.filter((key) => key !== entry.name);
  }
}

module.exports = { appliquerTables, appliquerFamilles };
