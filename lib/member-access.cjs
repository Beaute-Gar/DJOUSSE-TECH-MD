const fs = require('fs');
const path = require('path');

const FILE = path.join(process.cwd(), 'database', 'authorized_members.json');

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return { members: {} }; }
}

function save(d) {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
    return true;
  } catch (err) {
    console.error('❌ member-access: save failed:', err.message);
    return false;
  }
}

function normalizeNumber(num) {
  return String(num || '').replace(/[^0-9]/g, '');
}

function addMember(number, addedBy, name) {
  const d = load();
  const n = normalizeNumber(number);
  if (!n || n.length < 7) return { ok: false, reason: 'Numéro invalide' };
  if (d.members[n]) return { ok: false, reason: 'Déjà autorisé' };
  d.members[n] = {
    name: name || '',
    addedBy: normalizeNumber(addedBy),
    addedAt: Date.now()
  };
  const saved = save(d);
  return saved ? { ok: true } : { ok: false, reason: 'Erreur sauvegarde' };
}

function removeMember(number) {
  const d = load();
  const n = normalizeNumber(number);
  if (!d.members[n]) return { ok: false, reason: 'Membre non trouvé' };
  delete d.members[n];
  const saved = save(d);
  return saved ? { ok: true } : { ok: false, reason: 'Erreur sauvegarde' };
}

function isAuthorized(number) {
  const d = load();
  const n = normalizeNumber(number);
  return !!d.members[n];
}

function listMembers() {
  const d = load();
  return Object.entries(d.members).map(([num, info]) => ({
    number: num,
    name: info.name || '',
    addedBy: info.addedBy || '',
    addedAt: info.addedAt || 0
  }));
}

function getMemberInfo(number) {
  const d = load();
  const n = normalizeNumber(number);
  return d.members[n] || null;
}

module.exports = { addMember, removeMember, isAuthorized, listMembers, getMemberInfo, normalizeNumber };
