const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '..', 'database', 'member-access.json');

function loadDB() {
  try {
    if (!fs.existsSync(DB_FILE)) return { members: {} };
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch { return { members: {} }; }
}

function saveDB(data) {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function normalizeNumber(jid) {
  if (!jid) return '';
  return jid.replace(/[^0-9]/g, '').replace(/^237/, '');
}

function addMember(number, addedBy, name) {
  const db = loadDB();
  const num = normalizeNumber(number);
  if (!num || num.length < 8) return { ok: false, reason: 'Numéro invalide' };
  if (db.members[num]) return { ok: false, reason: 'Déjà membre' };
  db.members[num] = { name: name || '', addedBy: normalizeNumber(addedBy), addedAt: new Date().toISOString() };
  saveDB(db);
  return { ok: true };
}

function removeMember(number) {
  const db = loadDB();
  const num = normalizeNumber(number);
  if (!db.members[num]) return { ok: false, reason: 'Membre non trouvé' };
  delete db.members[num];
  saveDB(db);
  return { ok: true };
}

function listMembers() {
  const db = loadDB();
  return Object.entries(db.members).map(([number, info]) => ({
    number, ...info,
  }));
}

function getMemberInfo(number) {
  const db = loadDB();
  const num = normalizeNumber(number);
  return db.members[num] || null;
}

module.exports = { addMember, removeMember, listMembers, getMemberInfo, normalizeNumber };
