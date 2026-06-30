import { createLogger } from '../core/logger.js';
import { bus, EVENTS } from './event-bus.js';
import { rawGet, rawRun, rawAll } from '../lib/database.js';
import { cleanJid, jidToNumber } from '../lib/utils.js';

const log = createLogger('IDENTITY');

const cache = new Map();
const CACHE_TTL = 300_000;
const cacheTimestamps = new Map();

function isCached(jid) {
  const ts = cacheTimestamps.get(jid);
  if (!ts) return false;
  if (Date.now() - ts > CACHE_TTL) { cache.delete(jid); cacheTimestamps.delete(jid); return false; }
  return cache.has(jid);
}

function getCached(jid) { return cache.get(jid) || null; }
function setCached(jid, person) { cache.set(jid, person); cacheTimestamps.set(jid, Date.now()); }

export async function resolvePerson(jid, msg = null) {
  const cleaned = cleanJid(jid);
  if (isCached(cleaned)) return getCached(cleaned);

  let person = rawGet('SELECT * FROM cognitive_persons WHERE jid = ?', cleaned);
  if (!person) {
    const num = jidToNumber(cleaned);
    person = {
      id: cleaned,
      jid: cleaned,
      number: num,
      name: msg?.pushName || num || 'Inconnu',
      type: 'individual',
      frequency: 1,
      first_seen: Date.now(),
      last_seen: Date.now(),
      trust_level: 1,
      metadata: '{}',
    };
    rawRun(`INSERT INTO cognitive_persons (id, jid, number, name, type, frequency, first_seen, last_seen, trust_level, metadata)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, 1, '{}')`, person.id, person.jid, person.number, person.name, person.type, person.first_seen, person.last_seen);
    bus.emit(EVENTS.PERSON_IDENTIFIED, { person, source: msg ? 'message' : 'manual' });
  } else {
    const meta = tryParse(person.metadata, {});
    person = { ...person, metadata: meta };
    const freq = (person.frequency || 0) + 1;
    rawRun("UPDATE cognitive_persons SET frequency = ?, last_seen = ?, name = COALESCE(NULLIF(?, ''), name) WHERE jid = ?",
      freq, Date.now(), msg?.pushName || person.name, cleaned);
    person.frequency = freq;
    person.last_seen = Date.now();
    if (msg?.pushName) person.name = msg.pushName;
  }

  setCached(cleaned, person);
  return person;
}

export async function getPerson(jid) {
  const cleaned = cleanJid(jid);
  if (isCached(cleaned)) return getCached(cleaned);
  const row = rawGet('SELECT * FROM cognitive_persons WHERE jid = ?', cleaned);
  if (!row) return null;
  row.metadata = tryParse(row.metadata, {});
  setCached(cleaned, row);
  return row;
}

export async function updatePerson(jid, updates) {
  const cleaned = cleanJid(jid);
  const allowed = ['name', 'type', 'trust_level', 'metadata'];
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      const val = key === 'metadata' ? JSON.stringify(updates[key]) : updates[key];
      rawRun(`UPDATE cognitive_persons SET ${key} = ? WHERE jid = ?`, val, cleaned);
    }
  }
  cache.delete(cleaned);
  cacheTimestamps.delete(cleaned);
  const person = await getPerson(cleaned);
  bus.emit(EVENTS.PERSON_UPDATED, { person });
  return person;
}

export async function relatePersons(jid1, jid2, relation, properties = {}) {
  const id = [cleanJid(jid1), cleanJid(jid2), relation].sort().join(':');
  rawRun(`INSERT OR REPLACE INTO cognitive_relations (id, source_jid, target_jid, type, properties, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)`,
    id, cleanJid(jid1), cleanJid(jid2), relation, JSON.stringify(properties), Date.now());
  bus.emit(EVENTS.PERSON_RELATED, { source: jid1, target: jid2, relation, properties });
}

export async function getRelations(jid, type = null) {
  const cleaned = cleanJid(jid);
  const sql = type
    ? 'SELECT * FROM cognitive_relations WHERE (source_jid = ? OR target_jid = ?) AND type = ?'
    : 'SELECT * FROM cognitive_relations WHERE source_jid = ? OR target_jid = ?';
  const params = type ? [cleaned, cleaned, type] : [cleaned, cleaned];
  return rawAll(sql, ...params).map(r => ({ ...r, properties: tryParse(r.properties, {}) }));
}

export async function getFrequent(limit = 20) {
  return rawAll('SELECT * FROM cognitive_persons ORDER BY frequency DESC LIMIT ?', limit);
}

export async function searchPersons(query) {
  const like = `%${query}%`;
  return rawAll('SELECT * FROM cognitive_persons WHERE name LIKE ? OR number LIKE ? OR jid LIKE ? LIMIT 20', like, like, like);
}

export async function getAllPersons() {
  return rawAll('SELECT * FROM cognitive_persons ORDER BY last_seen DESC');
}

function tryParse(str, fallback) {
  if (!str || str === '{}') return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

bus.on(EVENTS.MESSAGE_RECEIVED, async (data) => {
  if (data.senderJid) await resolvePerson(data.senderJid, data.msg);
});
