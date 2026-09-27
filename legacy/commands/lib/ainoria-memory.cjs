const fs = require('fs');
const path = require('path');

const MEMORY_DIR = path.join(__dirname, '..', 'data', 'ainoria-memory');

function ensureDir() {
    if (!fs.existsSync(MEMORY_DIR)) fs.mkdirSync(MEMORY_DIR, { recursive: true });
}

function getFilePath(userId) {
    const safe = String(userId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
    return path.join(MEMORY_DIR, `${safe}.json`);
}

function load(userId) {
    ensureDir();
    const fp = getFilePath(userId);
    if (!fs.existsSync(fp)) return { facts: [], created: Date.now() };
    try { return JSON.parse(fs.readFileSync(fp, 'utf-8')); } catch { return { facts: [], created: Date.now() }; }
}

function save(userId, data) {
    ensureDir();
    fs.writeFileSync(getFilePath(userId), JSON.stringify(data, null, 2));
}

function addFact(userId, key, value) {
    const data = load(userId);
    const existing = data.facts.findIndex(f => f.key.toLowerCase() === key.toLowerCase());
    const fact = { key: key.trim(), value: value.trim(), time: Date.now() };
    if (existing >= 0) {
        data.facts[existing] = fact;
    } else {
        data.facts.push(fact);
    }
    data.updated = Date.now();
    save(userId, data);
    return existing >= 0;
}

function removeFact(userId, query) {
    const data = load(userId);
    const q = query.toLowerCase();
    const before = data.facts.length;
    data.facts = data.facts.filter(f => !f.key.toLowerCase().includes(q) && !f.value.toLowerCase().includes(q));
    save(userId, data);
    return before - data.facts.length;
}

function getFacts(userId) {
    return load(userId).facts;
}

function searchFacts(userId, query) {
    const facts = getFacts(userId);
    const q = query.toLowerCase();
    return facts.filter(f =>
        f.key.toLowerCase().includes(q) ||
        f.value.toLowerCase().includes(q)
    );
}

function clearAll(userId) {
    save(userId, { facts: [], created: Date.now() });
}

function getStats(userId) {
    const data = load(userId);
    return { total: data.facts.length, created: data.created, updated: data.updated };
}

module.exports = { addFact, removeFact, getFacts, searchFacts, clearAll, getStats };
