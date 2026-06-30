import { createLogger } from '../core/logger.js';
import { bus, EVENTS } from './event-bus.js';
import { rawGet, rawRun, rawAll } from '../lib/database.js';

const log = createLogger('KNOWLEDGE');

export const NODE_TYPES = {
  PERSON:    'person',
  COMPANY:   'company',
  PROJECT:   'project',
  DOCUMENT:  'document',
  TASK:      'task',
  EVENT:     'event',
  INVOICE:   'invoice',
  PAYMENT:   'payment',
  PRODUCT:   'product',
  MESSAGE:   'message',
  GROUP:     'group',
  NOTE:      'note',
  IDEA:      'idea',
  GOAL:      'goal',
  LOCATION:  'location',
  ORGANIZATION: 'organization',
  CHANNEL:   'channel',
  COMMUNITY: 'community',
  STATUS:    'status',
};

export const REL_TYPES = {
  WORKS_AT:      'works_at',
  OWNS:          'owns',
  BELONGS_TO:    'belongs_to',
  PARTICIPATES:  'participates',
  SENDS:         'sends',
  RECEIVES:      'receives',
  RELATES_TO:    'relates_to',
  DEPENDS_ON:    'depends_on',
  PRECEDES:      'precedes',
  FOLLOWS:       'follows',
  CREATES:       'creates',
  MENTIONS:      'mentions',
  PAYS:          'pays',
  INVOICES:      'invoices',
  DELIVERS:      'delivers',
  APPROVES:      'approves',
  ASSIGNED_TO:   'assigned_to',
  LOCATED_AT:    'located_at',
  PART_OF:       'part_of',
  RELATED_TO:    'related_to',
  SAME_AS:       'same_as',
  CONTAINS:      'contains',
};

const nodeCache = new Map();
const edgeCache = new Map();
let graphStats = { nodes: 0, edges: 0 };

export async function addNode(id, type, properties = {}) {
  if (!id || !type) throw new Error('id and type required');
  const now = Date.now();
  const existing = rawGet('SELECT * FROM cognitive_nodes WHERE id = ?', id);
  if (existing) {
    const mergedProps = { ...tryParse(existing.properties, {}), ...properties, updated_at: now };
    rawRun('UPDATE cognitive_nodes SET properties = ?, updated_at = ? WHERE id = ?', JSON.stringify(mergedProps), now, id);
    nodeCache.set(id, { id, type, properties: mergedProps, created_at: existing.created_at, updated_at: now });
    bus.emit(EVENTS.KNOWLEDGE_ADDED, { node: { id, type, properties: mergedProps } });
    return nodeCache.get(id);
  }
  rawRun('INSERT INTO cognitive_nodes (id, type, properties, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    id, type, JSON.stringify(properties), now, now);
  const node = { id, type, properties, created_at: now, updated_at: now };
  nodeCache.set(id, node);
  graphStats.nodes++;
  bus.emit(EVENTS.KNOWLEDGE_ADDED, { node });
  return node;
}

export function getNode(id) {
  if (nodeCache.has(id)) return nodeCache.get(id);
  const row = rawGet('SELECT * FROM cognitive_nodes WHERE id = ?', id);
  if (!row) return null;
  row.properties = tryParse(row.properties, {});
  nodeCache.set(id, row);
  return row;
}

export function findNodes(type, query = null) {
  if (query) {
    const like = `%${query}%`;
    return rawAll('SELECT * FROM cognitive_nodes WHERE type = ? AND (id LIKE ? OR properties LIKE ?) LIMIT 50', type, like, like);
  }
  return rawAll('SELECT * FROM cognitive_nodes WHERE type = ? ORDER BY updated_at DESC LIMIT 100', type);
}

export async function addEdge(sourceId, targetId, type, properties = {}) {
  if (!sourceId || !targetId || !type) throw new Error('sourceId, targetId, and type required');
  const edgeId = `${sourceId}:${type}:${targetId}`;
  const now = Date.now();
  const existing = rawGet('SELECT * FROM cognitive_edges WHERE id = ?', edgeId);
  if (existing) {
    const merged = { ...tryParse(existing.properties, {}), ...properties };
    rawRun('UPDATE cognitive_edges SET properties = ?, updated_at = ?, weight = COALESCE(weight, 0) + 1 WHERE id = ?',
      JSON.stringify(merged), now, edgeId);
    edgeCache.set(edgeId, { id: edgeId, source_id: sourceId, target_id: targetId, type, properties: merged, weight: (existing.weight || 0) + 1, updated_at: now });
    return edgeCache.get(edgeId);
  }
  rawRun('INSERT INTO cognitive_edges (id, source_id, target_id, type, properties, weight, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)',
    edgeId, sourceId, targetId, type, JSON.stringify(properties), now, now);
  const edge = { id: edgeId, source_id: sourceId, target_id: targetId, type, properties, weight: 1, created_at: now, updated_at: now };
  edgeCache.set(edgeId, edge);
  graphStats.edges++;
  bus.emit(EVENTS.KNOWLEDGE_RELATED, { source: sourceId, target: targetId, type, properties });
  return edge;
}

export function getRelated(nodeId, type = null, direction = 'both') {
  const params = [nodeId];
  let sql;
  if (direction === 'out') {
    sql = type ? 'SELECT * FROM cognitive_edges WHERE source_id = ? AND type = ? ORDER BY weight DESC' : 'SELECT * FROM cognitive_edges WHERE source_id = ? ORDER BY weight DESC';
    if (type) params.push(type);
  } else if (direction === 'in') {
    sql = type ? 'SELECT * FROM cognitive_edges WHERE target_id = ? AND type = ? ORDER BY weight DESC' : 'SELECT * FROM cognitive_edges WHERE target_id = ? ORDER BY weight DESC';
    if (type) params.push(type);
  } else {
    sql = type ? 'SELECT * FROM cognitive_edges WHERE (source_id = ? OR target_id = ?) AND type = ? ORDER BY weight DESC' : 'SELECT * FROM cognitive_edges WHERE source_id = ? OR target_id = ? ORDER BY weight DESC';
    params.push(nodeId);
    if (type) params.push(type);
  }
  const edges = rawAll(sql, ...params).map(e => ({ ...e, properties: tryParse(e.properties, {}) }));
  const related = [];
  for (const edge of edges) {
    const otherId = edge.source_id === nodeId ? edge.target_id : edge.source_id;
    const other = getNode(otherId);
    if (other) related.push({ edge, node: other });
  }
  return related;
}

export function shortestPath(fromId, toId, maxDepth = 4) {
  if (fromId === toId) return [fromId];
  const visited = new Set([fromId]);
  const queue = [[fromId]];
  while (queue.length > 0) {
    const path = queue.shift();
    const current = path[path.length - 1];
    if (path.length > maxDepth) continue;
    const related = getRelated(current, null, 'out');
    for (const { edge, node } of related) {
      if (visited.has(node.id)) continue;
      visited.add(node.id);
      const newPath = [...path, node.id];
      if (node.id === toId) return newPath;
      queue.push(newPath);
    }
  }
  return null;
}

export function searchNodes(query) {
  const like = `%${query}%`;
  return rawAll('SELECT * FROM cognitive_nodes WHERE id LIKE ? OR properties LIKE ? ORDER BY updated_at DESC LIMIT 30', like, like);
}

export function getStats() {
  return {
    nodes: rawGet('SELECT COUNT(*) as n FROM cognitive_nodes')?.n || 0,
    edges: rawGet('SELECT COUNT(*) as n FROM cognitive_edges')?.n || 0,
    byType: rawAll('SELECT type, COUNT(*) as n FROM cognitive_nodes GROUP BY type ORDER BY n DESC'),
  };
}

function tryParse(str, fallback) {
  if (!str || str === '{}') return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

bus.on(EVENTS.PERSON_IDENTIFIED, async (data) => {
  const p = data.person;
  await addNode(p.jid, NODE_TYPES.PERSON, { name: p.name, number: p.number, trustLevel: p.trust_level, firstSeen: p.first_seen });
});
