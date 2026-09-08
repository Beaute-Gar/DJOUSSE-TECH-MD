/* src/services/status-likes-log.cjs
   Journal persistant des likes de statuts : chaque statut liké est
   enregistré (contact, nom, emoji, date) dans data/status-likes.json.
   Un script dédié (scripts/status-likes-capture.cjs) génère ensuite
   une capture (TXT ou HTML) sur le bureau. */

const fs = require('fs');
const path = require('path');

const JOURNAL = path.join(__dirname, '..', '..', 'data', 'status-likes.json');
const MAX_ENTRIES = 2000;

function load() {
  try {
    if (fs.existsSync(JOURNAL)) return JSON.parse(fs.readFileSync(JOURNAL, 'utf8'));
  } catch (e) {}
  return [];
}

function save(list) {
  try {
    fs.mkdirSync(path.dirname(JOURNAL), { recursive: true });
    fs.writeFileSync(JOURNAL, JSON.stringify(list, null, 2));
  } catch (e) {}
}

function resolveName(phone) {
  try {
    const map = global.__contactNames;
    if (map && phone) return map.get(phone.replace(/\D/g, '')) || '';
  } catch (e) {}
  return '';
}

/* Enregistre un like de statut. `jid` = participant ou remoteJid. */
function recordStatusLike(jid, emoji) {
  try {
    if (!jid) return;
    const phone = String(jid).split('@')[0];
    const list = load();
    list.unshift({
      at: new Date().toISOString(),
      ts: Date.now(),
      phone,
      name: resolveName(phone),
      emoji: emoji || '❤️',
    });
    if (list.length > MAX_ENTRIES) list.length = MAX_ENTRIES;
    save(list);
  } catch (e) {}
}

function getAll() {
  return load();
}

module.exports = { recordStatusLike, getAll, JOURNAL };