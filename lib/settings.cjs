const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'database', 'settings.json');
const DEFAULTS = {
  footer: '© DJOUSSE TECH',
  autoai: false,
  autoview: false,
  autolike: false,
  autoreact: false,
  autoread: false,
  autorecording: false,
  autotyping: false,
  autovoice: false,
  autobio: false,
  alwaysonline: false,
  alwaysoffline: false,
  readcmdonly: false,
  autoreplytext: '',
  antiedit: false,
  antidelete: false,
  autoapprove: false,
  autoreject: false,
  antilinkaction: 'delete',
  antibot: false,
  antibad: false,
  anticall: true,
  antimention: false,
  owneronly: true,
  mode: 'public',
  prefix: '.',
  name: 'DJOUSSE-TECH-MD',
  image: 'media/djousse.jpg',
};

let cache = null;

function load() {
  if (cache) return cache;
  try {
    if (fs.existsSync(DB_PATH)) {
      cache = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(DB_PATH, 'utf8')) };
    } else {
      cache = { ...DEFAULTS };
    }
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache;
}

function get(key) {
  return load()[key];
}

function set(key, value) {
  const s = load();
  s[key] = value;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(s, null, 2));
  return value;
}

function toggle(key) {
  const s = load();
  s[key] = !s[key];
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(s, null, 2));
  return s[key];
}

function all() {
  return load();
}

module.exports = { get, set, toggle, all, load };
