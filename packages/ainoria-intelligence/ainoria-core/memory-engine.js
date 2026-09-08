import { createLogger } from '../../infrastructure/logger.js';
import { rawGet, rawRun, rawAll } from '../../infrastructure/database/database.js';

const log = createLogger('MEMORY-CORE');

const shortTerm = new Map();
const SHORT_TTL = 600_000;
const MAX_SHORT = 500;
const ttlTimers = new Map();

function ttlKey(jid, type) { return `${jid}:${type}`; }

let embedder = null;
let embedderReady = false;

async function initEmbedder() {
  if (embedderReady) return;
  try {
    const { pipeline } = await import('@xenova/transformers');
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    embedderReady = true;
    log.info('Embedder local MiniLM pret (feature-extraction)');
  } catch (err) {
    log.warn(`Embedder non disponible: ${err.message}. Fallback sur similarite simple.`);
    embedderReady = false;
  }
}

async function generateEmbedding(text) {
  if (!embedderReady) await initEmbedder();
  if (!embedder || !text) return simpleEmbed(text || '');
  try {
    const result = await embedder(text.slice(0, 1000), { pooling: 'mean', normalize: true });
    const data = result?.data || result?.[0]?.data || result;
    return Array.from(data);
  } catch (err) {
    log.warn(`Embedding failed: ${err.message}`);
    return simpleEmbed(text);
  }
}

function simpleEmbed(text) {
  const str = (text || '').toLowerCase().replace(/[^a-z0-9\u00C0-\u024F\s]/g, '').trim();
  if (!str) return Array(16).fill(0);
  const words = str.split(/\s+/).slice(0, 100);
  const vec = Array(16).fill(0);
  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) { hash = ((hash << 5) - hash) + word.charCodeAt(i); hash |= 0; }
    const idx = Math.abs(hash) % 16;
    vec[idx] = (vec[idx] || 0) + 1;
  }
  const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map(v => v / mag);
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  const dot = a.reduce((s, v, i) => s + v * (b[i] || 0), 0);
  const magA = Math.sqrt(a.reduce((s, v) => s + v * v, 0)) || 1;
  const magB = Math.sqrt(b.reduce((s, v) => s + v * v, 0)) || 1;
  return dot / (magA * magB);
}

export class MemoryEngine {
  constructor() {
    this.ready = false;
    this.stats = { shortTerm: 0, longTerm: 0, vectorial: 0 };
  }

  async init() {
    await initEmbedder();
    this.ready = true;
    log.info('Memory Engine pret');
  }

  storeShortTerm(jid, type, data) {
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
    this.stats.shortTerm++;
    return entry;
  }

  getShortTerm(jid, type) {
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

  getRecentShortTerm(jid) {
    const userMap = shortTerm.get(jid);
    if (!userMap) return [];
    const now = Date.now();
    const results = [];
    for (const [type, entry] of userMap) {
      if (now - entry.timestamp <= SHORT_TTL) results.push({ type, data: entry.data, age: now - entry.timestamp });
    }
    return results.sort((a, b) => a.age - b.age);
  }

  async storeLongTerm(jid, type, content, embedding = null) {
    const now = Date.now();
    const embed = embedding || await generateEmbedding(content);
    rawRun(
      'INSERT INTO ainoria_memories (jid, type, content, embedding, created_at, last_accessed, access_count) VALUES (?, ?, ?, ?, ?, ?, 1)',
      jid, type, content.slice(0, 5000), JSON.stringify(embed), now, now
    );
    const id = rawGet('SELECT last_insert_rowid() as id')?.id || 0;
    this.stats.longTerm++;
    return id;
  }

  async recallVectorial(jid, query, limit = 10) {
    const queryEmb = await generateEmbedding(query);
    const all = rawAll('SELECT * FROM ainoria_memories WHERE jid = ? ORDER BY created_at DESC LIMIT 200', jid);
    const scored = all.map(m => {
      try {
        const memEmbed = JSON.parse(m.embedding || '[]');
        const score = cosineSimilarity(queryEmb, memEmbed);
        return { ...m, score };
      } catch { return { ...m, score: 0 }; }
    });
    scored.sort((a, b) => b.score - a.score);
    const results = scored.slice(0, limit);
    for (const r of results) {
      rawRun('UPDATE ainoria_memories SET last_accessed = ?, access_count = access_count + 1 WHERE id = ?', Date.now(), r.id);
    }
    this.stats.vectorial += results.length;
    return results;
  }

  recallRecent(jid, type = null, limit = 20) {
    const sql = type
      ? 'SELECT id, jid, type, content, created_at, last_accessed, access_count FROM ainoria_memories WHERE jid = ? AND type = ? ORDER BY created_at DESC LIMIT ?'
      : 'SELECT id, jid, type, content, created_at, last_accessed, access_count FROM ainoria_memories WHERE jid = ? ORDER BY created_at DESC LIMIT ?';
    const params = type ? [jid, type, limit] : [jid, limit];
    return rawAll(sql, ...params);
  }

  recallGlobal(query, limit = 10) {
    const all = rawAll('SELECT * FROM ainoria_memories ORDER BY created_at DESC LIMIT 500');
    const scored = all.map(m => {
      try {
        const memEmbed = JSON.parse(m.embedding || '[]');
        const qEmb = simpleEmbed(query);
        return { ...m, score: cosineSimilarity(qEmb, memEmbed) };
      } catch { return { ...m, score: 0 }; }
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  storeUserPreference(jid, key, value) {
    const existing = rawGet('SELECT id FROM ainoria_user_preferences WHERE jid = ? AND key = ?', jid, key);
    if (existing) {
      rawRun('UPDATE ainoria_user_preferences SET value = ?, updated_at = ? WHERE id = ?', JSON.stringify(value), Date.now(), existing.id);
    } else {
      rawRun('INSERT INTO ainoria_user_preferences (jid, key, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        jid, key, JSON.stringify(value), Date.now(), Date.now());
    }
  }

  getUserPreference(jid, key) {
    const row = rawGet('SELECT value FROM ainoria_user_preferences WHERE jid = ? AND key = ?', jid, key);
    return row ? JSON.parse(row.value) : null;
  }

  storeProjectMemory(jid, projectId, content, type = 'note') {
    rawRun('INSERT INTO ainoria_project_memories (jid, project_id, type, content, created_at) VALUES (?, ?, ?, ?, ?)',
      jid, projectId, type, content.slice(0, 5000), Date.now());
    return rawGet('SELECT last_insert_rowid() as id')?.id || 0;
  }

  recallProjectMemory(jid, projectId, limit = 20) {
    return rawAll(
      'SELECT * FROM ainoria_project_memories WHERE jid = ? AND project_id = ? ORDER BY created_at DESC LIMIT ?',
      jid, projectId, limit
    );
  }

  getStats() {
    return { ...this.stats, totalShort: shortTerm.size };
  }
}

export const memoryEngine = new MemoryEngine();
export default memoryEngine;
