import { createLogger } from '../core/logger.js';
import { bus, EVENTS } from './event-bus.js';
import { rawGet, rawRun, rawAll } from '../lib/database.js';
import { addNode, getNode, findNodes, addEdge, getRelated, NODE_TYPES, REL_TYPES, searchNodes, getStats as kgStats } from './knowledge-graph.js';
import { resolvePerson, getAllPersons } from './identity-engine.js';
import { storeLongTerm, recallGlobal, recallRecent } from './memory-engine.js';
import { getAllGoals, getGoalStats } from './goal-memory.js';
import { planner } from './planning-engine.js';
import { foresight } from './foresight-engine.js';

const log = createLogger('SME');

/* ════════════════════════════════════════════════════════════
   KNOWLEDGE MESH — le tissu global de connaissances
════════════════════════════════════════════════════════════ */

class KnowledgeMesh {
  constructor() {
    this._links = new Map();
    this._loaded = false;
    this._entityCache = new Map();
  }

  _ensureLoaded() {
    if (!this._loaded) { this._loadAll(); this._loaded = true; }
  }

  link(sourceType, sourceId, targetType, targetId, relation, weight = 1, context = null) {
    this._ensureLoaded();
    const id = `${sourceType}:${sourceId}->${targetType}:${targetId}:${relation}`;
    const data = {
      id, sourceType, sourceId, targetType, targetId,
      relation, weight, context, createdAt: Date.now(),
    };
    this._links.set(id, data);
    rawRun(`INSERT OR REPLACE INTO cognitive_knowledge_mesh
      (id, source_type, source_id, target_type, target_id, relation, weight, context, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, sourceType, sourceId, targetType, targetId, relation, weight,
      context ? JSON.stringify(context) : null, Date.now());
    this._cacheEntity(sourceType, sourceId);
    this._cacheEntity(targetType, targetId);
    return data;
  }

  unlink(sourceType, sourceId, targetType, targetId, relation) {
    const id = `${sourceType}:${sourceId}->${targetType}:${targetId}:${relation}`;
    this._links.delete(id);
    rawRun('DELETE FROM cognitive_knowledge_mesh WHERE id = ?', id);
  }

  getLinked(entityType, entityId, relation = null) {
    this._ensureLoaded();
    const results = [];
    for (const link of this._links.values()) {
      if (link.sourceType === entityType && link.sourceId === entityId) {
        if (!relation || link.relation === relation) results.push({ ...link, direction: 'out' });
      }
      if (link.targetType === entityType && link.targetId === entityId) {
        if (!relation || link.relation === relation) results.push({ ...link, direction: 'in' });
      }
    }
    return results;
  }

  findPath(fromType, fromId, toType, toId, maxDepth = 4) {
    this._ensureLoaded();
    const queue = [[{ type: fromType, id: fromId, path: [] }]];
    const visited = new Set();
    const key = (t, i) => `${t}:${i}`;
    visited.add(key(fromType, fromId));
    while (queue.length > 0) {
      const level = queue.shift();
      const nextLevel = [];
      for (const node of level) {
        for (const link of this._links.values()) {
          let neighbor = null;
          if (link.sourceType === node.type && link.sourceId === node.id) neighbor = { type: link.targetType, id: link.targetId, via: link.relation };
          if (link.targetType === node.type && link.targetId === node.id) neighbor = { type: link.sourceType, id: link.sourceId, via: link.relation };
          if (!neighbor) continue;
          if (neighbor.type === toType && neighbor.id === toId) {
            return [...node.path, { from: node, to: neighbor, via: neighbor.via }];
          }
          const k = key(neighbor.type, neighbor.id);
          if (!visited.has(k)) {
            visited.add(k);
            nextLevel.push({ type: neighbor.type, id: neighbor.id, d: (node.d || 1) + 1, path: [...node.path, { from: node, to: neighbor, via: neighbor.via }] });
          }
        }
      }
      if (nextLevel.length > 0 && nextLevel[0].d <= maxDepth) queue.push(nextLevel);
    }
    return null;
  }

  search(query) {
    this._ensureLoaded();
    const q = query.toLowerCase();
    const results = [];
    for (const [id, link] of this._links) {
      const score =
        (link.sourceId.toLowerCase().includes(q) ? 2 : 0) +
        (link.targetId.toLowerCase().includes(q) ? 2 : 0) +
        (link.relation.toLowerCase().includes(q) ? 3 : 0) +
        (link.context && JSON.stringify(link.context).toLowerCase().includes(q) ? 1 : 0);
      if (score > 0) results.push({ ...link, score, id });
    }
    return results.sort((a, b) => b.score - a.score);
  }

  getStats() {
    this._ensureLoaded();
    const relCounts = {};
    for (const link of this._links.values()) {
      relCounts[link.relation] = (relCounts[link.relation] || 0) + 1;
    }
    return {
      totalLinks: this._links.size,
      relationTypes: Object.keys(relCounts).length,
      topRelations: Object.entries(relCounts).sort((a, b) => b[1] - a[1]).slice(0, 10),
      cachedEntities: this._entityCache.size,
    };
  }

  getSubgraph(entityType, entityId, depth = 2) {
    this._ensureLoaded();
    const seen = new Set();
    const nodes = [];
    const edges = [];
    const self = this;
    function walk(type, id, d) {
      const k = `${type}:${id}`;
      if (seen.has(k) || d > depth) return;
      seen.add(k);
      nodes.push({ type, id });
      for (const link of self._links.values()) {
        if (link.sourceType === type && link.sourceId === id) {
          edges.push({ from: k, to: `${link.targetType}:${link.targetId}`, relation: link.relation, weight: link.weight });
          walk(link.targetType, link.targetId, d + 1);
        }
        if (link.targetType === type && link.targetId === id) {
          edges.push({ from: `${link.sourceType}:${link.sourceId}`, to: k, relation: link.relation, weight: link.weight });
          walk(link.sourceType, link.sourceId, d + 1);
        }
      }
    }
    walk(entityType, entityId, 1);
    return { nodes, edges };
  }

  _cacheEntity(type, id) {
    const k = `${type}:${id}`;
    if (!this._entityCache.has(k)) {
      this._entityCache.set(k, { type, id, firstSeen: Date.now(), accessCount: 1 });
    } else {
      this._entityCache.get(k).accessCount++;
    }
  }

  _loadAll() {
    const rows = rawAll('SELECT * FROM cognitive_knowledge_mesh');
    for (const row of rows) {
      this._links.set(row.id, {
        id: row.id, sourceType: row.source_type, sourceId: row.source_id,
        targetType: row.target_type, targetId: row.target_id,
        relation: row.relation, weight: row.weight,
        context: row.context ? tryParse(row.context, null) : null,
        createdAt: row.created_at,
      });
    }
  }
}

/* ════════════════════════════════════════════════════════════
   1. EPISODE MEMORY
════════════════════════════════════════════════════════════ */

class EpisodeMemory {
  constructor(mesh) { this.mesh = mesh; }

  record(type, title, description, source, entities = [], metadata = {}) {
    try {
      const id = `ep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const episode = { id, type: String(type), title: String(title), description: String(description), source: String(source || ''), entities: entities || [], metadata: metadata || {}, startAt: Date.now(), endAt: null, createdAt: Date.now() };
      rawRun(`INSERT INTO cognitive_episodes (id, type, title, description, source, entities, metadata, start_at, end_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        episode.id, episode.type, episode.title, episode.description, episode.source,
        JSON.stringify(episode.entities), JSON.stringify(episode.metadata),
        episode.startAt, episode.endAt, episode.createdAt);
      return episode;
    } catch { return { id: 'error' }; }
    for (const entity of entities) {
      this.mesh.link('episode', id, entity.type || 'entity', entity.id, `episode_contains_${type}`, 1, { title });
    }
    return episode;
  }

  closeEpisode(id) {
    rawRun('UPDATE cognitive_episodes SET end_at = ? WHERE id = ?', Date.now(), id);
  }

  get(id) {
    const row = rawGet('SELECT * FROM cognitive_episodes WHERE id = ?', id);
    return row ? this._row(row) : null;
  }

  getByEntity(entityType, entityId, limit = 20) {
    const rows = rawAll('SELECT * FROM cognitive_episodes WHERE entities LIKE ? ORDER BY created_at DESC LIMIT ?', `%${entityId}%`, limit);
    return rows.map(r => this._row(r));
  }

  getByType(type, limit = 20) {
    const rows = rawAll('SELECT * FROM cognitive_episodes WHERE type = ? ORDER BY created_at DESC LIMIT ?', type, limit);
    return rows.map(r => this._row(r));
  }

  getBySource(source, limit = 20) {
    const rows = rawAll('SELECT * FROM cognitive_episodes WHERE source = ? ORDER BY created_at DESC LIMIT ?', source, limit);
    return rows.map(r => this._row(r));
  }

  replay(id) {
    const episode = this.get(id);
    if (!episode) return 'Episode introuvable';
    const entities = episode.entities.map(e => e.name || e.id).filter(Boolean);
    return `[${new Date(episode.createdAt).toLocaleDateString()}] ${episode.title}\n${episode.description}\nSource: ${episode.source}\nEntites: ${entities.join(', ')}`;
  }

  getTimeline(limit = 50) {
    const rows = rawAll('SELECT * FROM cognitive_episodes ORDER BY created_at DESC LIMIT ?', limit);
    return rows.map(r => this._row(r));
  }

  _row(r) {
    return { ...r, entities: tryParse(r.entities, []), metadata: tryParse(r.metadata, {}) };
  }
}

/* ════════════════════════════════════════════════════════════
   2. CONCEPT MEMORY
════════════════════════════════════════════════════════════ */

class ConceptMemory {
  constructor(mesh) { this.mesh = mesh; }

  create(name, type, aliases = [], metadata = {}) {
    const id = `concept_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const concept = { id, name, type, aliases, strength: 1, metadata, createdAt: Date.now(), updatedAt: Date.now() };
    rawRun(`INSERT OR REPLACE INTO cognitive_concepts (id, name, type, aliases, strength, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      id, name, type, JSON.stringify(aliases), concept.strength, JSON.stringify(metadata), concept.createdAt, concept.updatedAt);
    this.mesh.link('concept', id, 'concept_type', type, 'is_a', 1);
    return concept;
  }

  strengthen(name, amount = 1) {
    const concept = this.get(name);
    if (!concept) return this.create(name, 'auto');
    const newStrength = concept.strength + amount;
    rawRun('UPDATE cognitive_concepts SET strength = ?, updated_at = ? WHERE id = ?', newStrength, Date.now(), concept.id);
    return { ...concept, strength: newStrength };
  }

  weaken(name, amount = 1) {
    const concept = this.get(name);
    if (!concept) return null;
    const newStrength = Math.max(0, concept.strength - amount);
    rawRun('UPDATE cognitive_concepts SET strength = ?, updated_at = ? WHERE id = ?', newStrength, Date.now(), concept.id);
    if (newStrength === 0) { rawRun('DELETE FROM cognitive_concepts WHERE id = ?', concept.id); return null; }
    return { ...concept, strength: newStrength };
  }

  get(name) {
    const id = `concept_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const row = rawGet('SELECT * FROM cognitive_concepts WHERE id = ? OR name = ?', id, name);
    if (row) return this._row(row);
    const alias = rawGet("SELECT * FROM cognitive_concepts WHERE aliases LIKE ?", `%"${name}"%`);
    return alias ? this._row(alias) : null;
  }

  getByType(type) {
    const rows = rawAll('SELECT * FROM cognitive_concepts WHERE type = ? ORDER BY strength DESC', type);
    return rows.map(r => this._row(r));
  }

  getStrongest(limit = 20) {
    const rows = rawAll('SELECT * FROM cognitive_concepts ORDER BY strength DESC LIMIT ?', limit);
    return rows.map(r => this._row(r));
  }

  getAll() {
    const rows = rawAll('SELECT * FROM cognitive_concepts ORDER BY strength DESC');
    return rows.map(r => this._row(r));
  }

  evolve(name, delta) {
    return this.strengthen(name, delta);
  }

  _row(r) {
    return { ...r, aliases: tryParse(r.aliases, []), metadata: tryParse(r.metadata, {}) };
  }
}

/* ════════════════════════════════════════════════════════════
   3. RELATIONSHIP MEMORY
════════════════════════════════════════════════════════════ */

class RelationshipMemory {
  constructor(mesh) { this.mesh = mesh; }

  record(sourceJid, targetJid, type, strength = 1, context = null) {
    const id = `${sourceJid}-${targetJid}-${type}`;
    rawRun(`INSERT INTO cognitive_relationship_history (id, source_jid, target_jid, type, strength, context, recorded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      id, sourceJid, targetJid, type, strength, context ? JSON.stringify(context) : null, Date.now());
    this.mesh.link('person', sourceJid, 'person', targetJid, `relation_${type}`, strength, context);
    return { id, sourceJid, targetJid, type, strength, recordedAt: Date.now() };
  }

  getHistory(sourceJid, targetJid, limit = 50) {
    const rows = rawAll(`SELECT * FROM cognitive_relationship_history
      WHERE (source_jid = ? AND target_jid = ?) OR (source_jid = ? AND target_jid = ?)
      ORDER BY recorded_at DESC LIMIT ?`, sourceJid, targetJid, targetJid, sourceJid, limit);
    return rows.map(r => ({ ...r, context: tryParse(r.context, null) }));
  }

  getEvolution(sourceJid, targetJid) {
    const history = this.getHistory(sourceJid, targetJid);
    if (history.length === 0) return null;
    const first = history[history.length - 1];
    const last = history[0];
    return {
      sourceJid, targetJid,
      firstEncounter: first.recorded_at,
      lastEncounter: last.recorded_at,
      totalInteractions: history.length,
      strengthTrend: last.strength - first.strength,
      avgStrength: Math.round(history.reduce((s, r) => s + r.strength, 0) / history.length),
    };
  }

  getSummary(jid) {
    const rows = rawAll(`SELECT * FROM cognitive_relationship_history
      WHERE source_jid = ? OR target_jid = ? ORDER BY recorded_at DESC LIMIT 100`, jid, jid);
    if (rows.length === 0) return { jid, totalRelationships: 0 };
    const byType = {};
    for (const r of rows) {
      const other = r.source_jid === jid ? r.target_jid : r.source_jid;
      if (!byType[other]) byType[other] = { count: 0, types: new Set(), totalStrength: 0 };
      byType[other].count++;
      byType[other].types.add(r.type);
      byType[other].totalStrength += r.strength;
    }
    const relationships = Object.entries(byType).map(([other, data]) => ({
      jid: other,
      interactions: data.count,
      types: Array.from(data.types),
      avgStrength: Math.round(data.totalStrength / data.count),
    })).sort((a, b) => b.interactions - a.interactions);
    return { jid, totalRelationships: relationships.length, relationships };
  }
}

/* ════════════════════════════════════════════════════════════
   4. REASONING MEMORY
════════════════════════════════════════════════════════════ */

class ReasoningMemory {
  constructor(mesh) { this.mesh = mesh; }

  record(context, rulesUsed, trace, outcome = null, accuracy = null) {
    const id = `reason_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    rawRun(`INSERT INTO cognitive_reasoning_memory (id, context, rules_used, trace, outcome, accuracy, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      id, JSON.stringify(context), JSON.stringify(rulesUsed), JSON.stringify(trace),
      outcome ? JSON.stringify(outcome) : null, accuracy, Date.now());
    if (context.jid) this.mesh.link('person', context.jid, 'reasoning', id, 'initiated', 1);
    return id;
  }

  get(id) {
    const row = rawGet('SELECT * FROM cognitive_reasoning_memory WHERE id = ?', id);
    if (!row) return null;
    return {
      ...row,
      context: tryParse(row.context, {}),
      rules_used: tryParse(row.rules_used, []),
      trace: tryParse(row.trace, {}),
      outcome: tryParse(row.outcome, null),
    };
  }

  getRulePerformance() {
    const rows = rawAll("SELECT json_each.value as rule FROM cognitive_reasoning_memory, json_each(rules_used) WHERE accuracy IS NOT NULL");
    const stats = {};
    const byRule = {};
    const allRows = rawAll('SELECT * FROM cognitive_reasoning_memory WHERE accuracy IS NOT NULL');
    for (const row of allRows) {
      const rules = tryParse(row.rules_used, []);
      for (const rule of rules) {
        if (!byRule[rule]) byRule[rule] = { total: 0, correct: 0 };
        byRule[rule].total++;
        if (row.accuracy === 1) byRule[rule].correct++;
      }
    }
    return Object.entries(byRule).map(([rule, data]) => ({
      rule,
      accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
      total: data.total,
      correct: data.correct,
    })).sort((a, b) => b.total - a.total);
  }

  getRecent(limit = 20) {
    const rows = rawAll('SELECT * FROM cognitive_reasoning_memory ORDER BY created_at DESC LIMIT ?', limit);
    return rows.map(r => ({ ...r, context: tryParse(r.context, {}), rules_used: tryParse(r.rules_used, []), trace: tryParse(r.trace, {}), outcome: tryParse(r.outcome, null) }));
  }

  getStats() {
    const total = rawGet('SELECT COUNT(*) as count FROM cognitive_reasoning_memory');
    const withOutcome = rawGet('SELECT COUNT(*) as count FROM cognitive_reasoning_memory WHERE accuracy IS NOT NULL');
    const avgAcc = rawGet('SELECT AVG(accuracy) as avg FROM cognitive_reasoning_memory WHERE accuracy IS NOT NULL');
    return { total: total?.count || 0, withOutcome: withOutcome?.count || 0, avgAccuracy: avgAcc?.avg ? Math.round(avgAcc.avg * 100) : null };
  }
}

/* ════════════════════════════════════════════════════════════
   5. MISSION MEMORY
════════════════════════════════════════════════════════════ */

class MissionMemory {
  constructor(mesh) { this.mesh = mesh; }

  linkMissions(sourceId, targetId, linkType, metadata = {}) {
    const id = `${sourceId}-${targetId}-${linkType}`;
    rawRun(`INSERT OR REPLACE INTO cognitive_mission_memory (id, source_mission_id, target_mission_id, link_type, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`, id, sourceId, targetId, linkType, JSON.stringify(metadata), Date.now());
    this.mesh.link('mission', sourceId, 'mission', targetId, `mission_${linkType}`, 1, metadata);
    return id;
  }

  getDependencies(missionId) {
    const dependsOn = rawAll('SELECT * FROM cognitive_mission_memory WHERE source_mission_id = ? AND link_type = ?', missionId, 'depends_on');
    const dependedBy = rawAll('SELECT * FROM cognitive_mission_memory WHERE target_mission_id = ? AND link_type = ?', missionId, 'depends_on');
    return { dependsOn: dependsOn.map(r => ({ id: r.target_mission_id, type: r.link_type })), dependedBy: dependedBy.map(r => ({ id: r.source_mission_id, type: r.link_type })) };
  }

  getChain(missionId) {
    const chain = [];
    const visited = new Set();
    function walk(id, direction) {
      if (visited.has(id)) return;
      visited.add(id);
      const mission = planner.getMission(id);
      if (mission) chain.push({ id, title: mission.title, direction });
      const deps = rawAll(`SELECT * FROM cognitive_mission_memory WHERE source_mission_id = ? AND link_type = 'depends_on'`, id);
      for (const d of deps) walk(d.target_mission_id, 'upstream');
      const rev = rawAll(`SELECT * FROM cognitive_mission_memory WHERE target_mission_id = ? AND link_type = 'depends_on'`, id);
      for (const r of rev) walk(r.source_mission_id, 'downstream');
    }
    walk(missionId, 'self');
    return chain;
  }
}

/* ════════════════════════════════════════════════════════════
   6. TIMELINE MEMORY
════════════════════════════════════════════════════════════ */

class TimelineMemory {
  record(sourceType, sourceId, title, description, timestamp = Date.now(), tags = [], metadata = {}) {
    try {
      const id = `tl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      rawRun(`INSERT INTO cognitive_timeline (id, source_type, source_id, title, description, timestamp, tags, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id, String(sourceType), String(sourceId), String(title), String(description), Number(timestamp),
        JSON.stringify(Array.isArray(tags) ? tags : []), JSON.stringify(metadata || {}), Date.now());
      return id;
    } catch {}
  }

  getRange(from, to, limit = 100) {
    const rows = rawAll('SELECT * FROM cognitive_timeline WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC LIMIT ?', from, to, limit);
    return rows.map(r => ({ ...r, tags: tryParse(r.tags, []), metadata: tryParse(r.metadata, {}) }));
  }

  getBySource(sourceType, sourceId, limit = 20) {
    const rows = rawAll('SELECT * FROM cognitive_timeline WHERE source_type = ? AND source_id = ? ORDER BY timestamp DESC LIMIT ?', sourceType, sourceId, limit);
    return rows.map(r => ({ ...r, tags: tryParse(r.tags, []), metadata: tryParse(r.metadata, {}) }));
  }

  getByTag(tag, limit = 20) {
    const rows = rawAll("SELECT * FROM cognitive_timeline WHERE tags LIKE ? ORDER BY timestamp DESC LIMIT ?", `%${tag}%`, limit);
    return rows.map(r => ({ ...r, tags: tryParse(r.tags, []), metadata: tryParse(r.metadata, {}) }));
  }

  search(query, limit = 20) {
    const rows = rawAll("SELECT * FROM cognitive_timeline WHERE title LIKE ? OR description LIKE ? ORDER BY timestamp DESC LIMIT ?", `%${query}%`, `%${query}%`, limit);
    return rows.map(r => ({ ...r, tags: tryParse(r.tags, []), metadata: tryParse(r.metadata, {}) }));
  }

  getCompact(from, to) {
    const events = this.getRange(from, to, 200);
    return events.map(e => {
      const d = new Date(e.timestamp);
      return `[${d.toLocaleDateString()} ${d.toLocaleTimeString()}] ${e.title}${e.description ? ': ' + e.description.slice(0, 80) : ''}`;
    });
  }
}

/* ════════════════════════════════════════════════════════════
   7. EMBEDDING MEMORY
════════════════════════════════════════════════════════════ */

class EmbeddingMemory {
  async store(entityType, entityId, text) {
    const { storeLongTerm } = await import('./memory-engine.js');
    const memId = await storeLongTerm(entityId || 'system', text, { entityType, entityId, source: 'semantic_memory' });
    return memId;
  }

  async search(entityType, query, limit = 10) {
    const { recallGlobal } = await import('./memory-engine.js');
    const results = await recallGlobal(query, limit * 2);
    if (!entityType) return results.slice(0, limit);
    return results.filter(r => r.metadata?.entityType === entityType).slice(0, limit);
  }
}

/* ════════════════════════════════════════════════════════════
   8. CONTEXT MEMORY
════════════════════════════════════════════════════════════ */

class ContextMemory {
  constructor(mesh) { this.mesh = mesh; }

  set(jid, key, value, context = {}) {
    const existing = rawGet('SELECT * FROM cognitive_context_store WHERE jid = ? AND key = ?', jid, key);
    if (existing) {
      rawRun('UPDATE cognitive_context_store SET value = ?, context = ?, updated_at = ? WHERE jid = ? AND key = ?',
        JSON.stringify(value), JSON.stringify(context), Date.now(), jid, key);
    } else {
      rawRun('INSERT INTO cognitive_context_store (jid, key, value, context, updated_at) VALUES (?, ?, ?, ?, ?)',
        jid, key, JSON.stringify(value), JSON.stringify(context), Date.now());
    }
    this.mesh.link('person', jid, 'context', key, `has_context_${key}`, 1, context);
  }

  get(jid, key) {
    const row = rawGet('SELECT * FROM cognitive_context_store WHERE jid = ? AND key = ?', jid, key);
    if (!row) return null;
    return { jid: row.jid, key: row.key, value: tryParse(row.value, null), context: tryParse(row.context, {}), updatedAt: row.updated_at };
  }

  getAll(jid) {
    const rows = rawAll('SELECT * FROM cognitive_context_store WHERE jid = ? ORDER BY updated_at DESC', jid);
    return rows.map(r => ({ jid: r.jid, key: r.key, value: tryParse(r.value, null), context: tryParse(r.context, {}), updatedAt: r.updated_at }));
  }

  delete(jid, key) {
    rawRun('DELETE FROM cognitive_context_store WHERE jid = ? AND key = ?', jid, key);
  }

  search(valueQuery) {
    const q = `%${valueQuery}%`;
    const rows = rawAll("SELECT * FROM cognitive_context_store WHERE value LIKE ? OR context LIKE ?", q, q);
    return rows.map(r => ({ jid: r.jid, key: r.key, value: tryParse(r.value, null), context: tryParse(r.context, {}), updatedAt: r.updated_at }));
  }
}

/* ════════════════════════════════════════════════════════════
   SEMANTIC MEMORY ENGINE
════════════════════════════════════════════════════════════ */

export class SemanticMemoryEngine {
  constructor() {
    this.mesh = new KnowledgeMesh();
    this.episodes = new EpisodeMemory(this.mesh);
    this.concepts = new ConceptMemory(this.mesh);
    this.relationships = new RelationshipMemory(this.mesh);
    this.reasoning = new ReasoningMemory(this.mesh);
    this.missions = new MissionMemory(this.mesh);
    this.timeline = new TimelineMemory();
    this.embeddings = new EmbeddingMemory();
    this.context = new ContextMemory(this.mesh);
    this._indexed = false;
  }

  async indexAll() {
    if (this._indexed) return;
    log.info('[SME] Indexation globale du Cognitive OS...');
    const start = Date.now();
    let count = 0;

    try {
      const persons = await getAllPersons() || [];
      for (const p of persons) {
        this.mesh.link('person', p.jid, 'identity', p.jid, 'is_person', 1, { name: p.name });
        count++;
      }
    } catch {}

    try {
      const kg = kgStats();
      if (kg.nodes) {
        this.mesh.link('system', 'knowledge_graph', 'stats', 'nodes', 'has_nodes', kg.nodes, { count: kg.nodes });
        count++;
      }
    } catch {}

    try {
      const goals = getAllGoals();
      if (Array.isArray(goals)) {
        for (const g of goals) {
          this.mesh.link('goal', g.id, 'person', g.owner || 'system', 'owns_goal', 1, { title: g.title });
          count++;
        }
      }
    } catch {}

    try {
      const missions = planner.getAllMissions();
      for (const m of missions) {
        this.mesh.link('mission', m.id, 'person', m.owner || 'system', 'owns_mission', 1, { title: m.title });
        if (m.tags) {
          for (const tag of m.tags) {
            this.mesh.link('mission', m.id, 'tag', tag, 'tagged_as', 1);
            count++;
          }
        }
      }
    } catch {}

    this._indexed = true;
    const elapsed = Date.now() - start;
    log.info(`[SME] Indexation terminee: ${count} liens en ${elapsed}ms`);
    return { count, elapsed };
  }

  async query(prompt, options = {}) {
    log.info(`[SME] Query: "${prompt.slice(0, 80)}"`);
    const result = { prompt, answer: '', sources: [], confidence: 0 };

    const tlHits = this.timeline.search(prompt, 5);
    if (tlHits.length > 0) result.sources.push(...tlHits.map(h => ({ type: 'timeline', id: h.id, title: h.title })));

    const meshHits = this.mesh.search(prompt);
    if (meshHits.length > 0) {
      result.sources.push(...meshHits.slice(0, 5).map(h => ({ type: 'mesh', relation: h.relation, source: `${h.sourceType}:${h.sourceId}`, target: `${h.targetType}:${h.targetId}`, score: h.score })));
    }

    try {
      const semantic = await this.embeddings.search(null, prompt, 3);
      if (semantic.length > 0) {
        result.sources.push(...semantic.map(s => ({ type: 'semantic', id: s.id, content: s.content?.slice(0, 80), score: s.similarity })));
      }
    } catch {}

    result.confidence = Math.min(0.9, 0.3 + result.sources.length * 0.1);
    result.answer = `${result.sources.length} sources trouvees`;
    return result;
  }

  async learn(type, data) {
    switch (type) {
      case 'episode': return this.episodes.record(data.type, data.title, data.description, data.source, data.entities, data.metadata);
      case 'concept': return this.concepts.create(data.name, data.type, data.aliases, data.metadata);
      case 'relationship': return this.relationships.record(data.sourceJid, data.targetJid, data.type, data.strength, data.context);
      case 'reasoning': return this.reasoning.record(data.context, data.rulesUsed, data.trace, data.outcome, data.accuracy);
      case 'timeline': return this.timeline.record(data.sourceType, data.sourceId, data.title, data.description, data.timestamp, data.tags, data.metadata);
      case 'context': return this.context.set(data.jid, data.key, data.value, data.context);
      default: throw new Error(`Type d'apprentissage inconnu: ${type}`);
    }
  }

  async connect(type, sourceId, targetType, targetId, relation, weight = 1) {
    return this.mesh.link(type, sourceId, targetType, targetId, relation, weight);
  }

  rememberConversation(jid, messages) {
    try {
      const id = this.episodes.record('conversation', `Conversation avec ${jid}`, `${messages.length} messages`, 'whatsapp', [{ type: 'person', id: jid }]);
      this.context.set(jid, 'last_conversation', { episodeId: id, messageCount: messages.length, timestamp: Date.now() });
      for (const msg of messages.slice(-3)) {
        const text = typeof msg === 'string' ? msg : (msg?.content || msg?.text || String(msg || ''));
        this.timeline.record('message', id, text.substring(0, 100), text.substring(0, 200), Date.now(), ['conversation', jid]);
      }
      return id;
    } catch {}
  }

  getStats() {
    const epCount = rawGet('SELECT COUNT(*) as c FROM cognitive_episodes');
    const concCount = rawGet('SELECT COUNT(*) as c FROM cognitive_concepts');
    const reasonStats = this.reasoning.getStats();
    return {
      mesh: this.mesh.getStats(),
      episodes: epCount?.c || 0,
      concepts: concCount?.c || 0,
      reasoning: reasonStats,
      indexed: this._indexed,
    };
  }
}

function tryParse(str, fallback) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

export const semanticMemory = new SemanticMemoryEngine();
export { KnowledgeMesh, EpisodeMemory, ConceptMemory, RelationshipMemory, ReasoningMemory, MissionMemory, TimelineMemory, EmbeddingMemory, ContextMemory };
export default semanticMemory;

/* ── Auto-subscribe ──────────────────────────────────────── */
bus.on(EVENTS.MESSAGE_RECEIVED, async (data) => {
  if (data.senderJid && data.msg) {
    semanticMemory.timeline.record('message', data.senderJid, typeof data.msg === 'string' ? data.msg.slice(0, 100) : 'Message recu', 'Message WhatsApp', Date.now(), ['message', data.senderJid]);
  }
});

bus.on(EVENTS.DECISION_MADE, async (data) => {
  if (data.jid && data.context) {
    semanticMemory.episodes.record('decision', `Decision: ${data.context.slice(0, 100)}`, data.context, 'decision_engine', [{ type: 'person', id: data.jid }]);
  }
});
