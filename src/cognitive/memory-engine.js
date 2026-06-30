import { createLogger } from '../core/logger.js';
import { bus, EVENTS } from './event-bus.js';
import { rawGet, rawRun, rawAll } from '../lib/database.js';

const log = createLogger('MEMORY');

const shortTerm = new Map();
const SHORT_TTL = 600_000;
const MAX_SHORT = 500;
const ttlTimers = new Map();

function ttlKey(jid, type) { return `${jid}:${type}`; }

export function storeShortTerm(jid, type, data) {
  const key = ttlKey(jid, type);
  const entry = { data, timestamp: Date.now() };
  if (!shortTerm.has(jid)) shortTerm.set(jid, new Map());
  shortTerm.get(jid).set(type, entry);
  if (shortTerm.size > MAX_SHORT) {
    const oldest = shortTerm.keys().next().value;
    shortTerm.delete(oldest);
  }
  if (ttlTimers.has(key)) clearTimeout(ttlTimers.get(key));
  ttlTimers.set(key, setTimeout(() => {
    const userMap = shortTerm.get(jid);
    if (userMap) { userMap.delete(type); if (userMap.size === 0) shortTerm.delete(jid); }
    ttlTimers.delete(key);
  }, SHORT_TTL));
  return entry;
}

export function getShortTerm(jid, type) {
  const userMap = shortTerm.get(jid);
  if (!userMap) return null;
  const entry = userMap.get(type);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > SHORT_TTL) {
    userMap.delete(type);
    if (userMap.size === 0) shortTerm.delete(jid);
    return null;
  }
  return entry.data;
}

export function getRecentShortTerm(jid) {
  const userMap = shortTerm.get(jid);
  if (!userMap) return [];
  const now = Date.now();
  const results = [];
  for (const [type, entry] of userMap) {
    if (now - entry.timestamp <= SHORT_TTL) results.push({ type, data: entry.data, age: now - entry.timestamp });
  }
  return results.sort((a, b) => a.age - b.age);
}

export async function storeLongTerm(jid, type, content, embedding = null) {
  const now = Date.now();
  const embed = embedding || simpleEmbed(content);
  rawRun('INSERT INTO cognitive_memories (jid, type, content, embedding, created_at, last_accessed) VALUES (?, ?, ?, ?, ?, ?)',
    jid, type, content.slice(0, 2000), JSON.stringify(embed), now, now);
  const id = rawGet('SELECT last_insert_rowid() as id')?.id || 0;
  bus.emit(EVENTS.MEMORY_STORED, { jid, type, content: content.slice(0, 200), id });
  return id;
}

export function recallLongTerm(jid, query, limit = 10) {
  const embed = simpleEmbed(query);
  const all = rawAll('SELECT * FROM cognitive_memories WHERE jid = ? ORDER BY created_at DESC LIMIT 200', jid);
  const scored = all.map(m => {
    try {
      const memEmbed = JSON.parse(m.embedding || '[]');
      const score = cosineSimilarity(embed, memEmbed);
      return { ...m, score };
    } catch { return { ...m, score: 0 }; }
  });
  scored.sort((a, b) => b.score - a.score);
  const results = scored.slice(0, limit);
  for (const r of results) {
    rawRun('UPDATE cognitive_memories SET last_accessed = ? WHERE id = ?', Date.now(), r.id);
  }
  bus.emit(EVENTS.MEMORY_RETRIEVED, { jid, query, count: results.length });
  return results;
}

export function recallRecent(jid, type = null, limit = 20) {
  const sql = type
    ? 'SELECT * FROM cognitive_memories WHERE jid = ? AND type = ? ORDER BY created_at DESC LIMIT ?'
    : 'SELECT * FROM cognitive_memories WHERE jid = ? ORDER BY created_at DESC LIMIT ?';
  const params = type ? [jid, type, limit] : [jid, limit];
  return rawAll(sql, ...params).map(m => ({ ...m, embedding: undefined }));
}

export function recallGlobal(query, limit = 10) {
  const embed = simpleEmbed(query);
  const all = rawAll('SELECT * FROM cognitive_memories ORDER BY created_at DESC LIMIT 500');
  const scored = all.map(m => {
    try { const memEmbed = JSON.parse(m.embedding || '[]'); return { ...m, score: cosineSimilarity(embed, memEmbed) }; }
    catch { return { ...m, score: 0 }; }
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

export function getConversationSummary(jid, limit = 10) {
  return recallRecent(jid, 'conversation', limit);
}

export async function summarizeAndStore(jid, messages) {
  if (!messages || messages.length === 0) return;
  const combined = messages.map(m => `${m.role || 'user'}: ${m.content}`).join('\n').slice(0, 3000);
  const summaryId = await storeLongTerm(jid, 'conversation', `[Convo résumée ${new Date().toISOString()}]\n${combined}`);
  return summaryId;
}

function simpleEmbed(text) {
  if (!text) return [];
  const dim = 64;
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  const vec = new Array(dim).fill(0);
  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) { hash = ((hash << 5) - hash) + word.charCodeAt(i); hash |= 0; }
    const idx = Math.abs(hash) % dim;
    vec[idx] += 1;
  }
  const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  return mag > 0 ? vec.map(v => v / mag) : vec;
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; magA += a[i] * a[i]; magB += b[i] * b[i]; }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

export function clearShortTerm(jid) { shortTerm.delete(jid); }

export function clearLongTerm(jid) {
  rawRun('DELETE FROM cognitive_memories WHERE jid = ?', jid);
}

bus.on(EVENTS.MESSAGE_RECEIVED, async (data) => {
  const { senderJid, text } = data;
  if (senderJid && text) {
    storeShortTerm(senderJid, 'last_message', { text, timestamp: Date.now() });
  }
});
