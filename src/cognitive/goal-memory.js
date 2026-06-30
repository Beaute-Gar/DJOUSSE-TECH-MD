import { createLogger } from '../core/logger.js';
import { bus, EVENTS } from './event-bus.js';
import { rawGet, rawRun, rawAll } from '../lib/database.js';
import { getContext } from './context-engine.js';

const log = createLogger('GOAL');

export const GOAL_STATUS = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  ABANDONED: 'abandoned',
  BLOCKED: 'blocked',
  PAUSED: 'paused',
  RECURRING: 'recurring',
};

export function createGoal({ jid, title, description, type = 'personal', priority = 3, deadline = null, parentId = null, tags = [], metadata = {} }) {
  const id = `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  rawRun('INSERT INTO cognitive_goals (id, jid, title, description, type, status, priority, deadline, parent_id, tags, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    id, jid, title, description, type, GOAL_STATUS.ACTIVE, priority, deadline || 0, parentId || '', JSON.stringify(tags), JSON.stringify(metadata), now, now);
  const goal = { id, jid, title, description, type, status: GOAL_STATUS.ACTIVE, priority, deadline, parentId, tags, metadata, createdAt: now, updatedAt: now };
  log.info(`[Goal] Cree: ${title} pour ${jid}`);
  bus.emit('goal:created', { goal });
  return goal;
}

export function updateGoal(id, updates) {
  const allowed = ['title', 'description', 'type', 'status', 'priority', 'deadline', 'tags', 'metadata'];
  const now = Date.now();
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      const val = ['tags', 'metadata'].includes(key) ? JSON.stringify(updates[key]) : updates[key];
      rawRun(`UPDATE cognitive_goals SET ${key} = ?, updated_at = ? WHERE id = ?`, val, now, id);
    }
  }
  if (updates.status === GOAL_STATUS.COMPLETED) {
    rawRun('UPDATE cognitive_goals SET completed_at = ?, updated_at = ? WHERE id = ?', now, now, id);
    const goal = getGoal(id);
    if (goal) bus.emit('goal:completed', { goal });
  }
  return getGoal(id);
}

export function getGoal(id) {
  const row = rawGet('SELECT * FROM cognitive_goals WHERE id = ?', id);
  if (!row) return null;
  return _parseRow(row);
}

export function getActiveGoals(jid = null) {
  const sql = jid
    ? 'SELECT * FROM cognitive_goals WHERE jid = ? AND status = ? ORDER BY priority ASC, created_at DESC'
    : 'SELECT * FROM cognitive_goals WHERE status = ? ORDER BY priority ASC, created_at DESC';
  const params = jid ? [jid, GOAL_STATUS.ACTIVE] : [GOAL_STATUS.ACTIVE];
  return rawAll(sql, ...params).map(_parseRow);
}

export function getAllGoals(jid = null, status = null) {
  let sql = 'SELECT * FROM cognitive_goals';
  const params = [];
  const conditions = [];
  if (jid) { conditions.push('jid = ?'); params.push(jid); }
  if (status) { conditions.push('status = ?'); params.push(status); }
  if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY created_at DESC LIMIT 100';
  return rawAll(sql, ...params).map(_parseRow);
}

export function getGoalsByTag(tag) {
  return rawAll("SELECT * FROM cognitive_goals WHERE tags LIKE ? ORDER BY created_at DESC", `%"${tag}"%`).map(_parseRow);
}

export function getGoalStats(jid = null) {
  const jidFilter = jid ? ' WHERE jid = ?' : '';
  const params = jid ? [jid] : [];
  const total = rawGet(`SELECT COUNT(*) as n FROM cognitive_goals${jidFilter}`, ...params)?.n || 0;
  const active = rawGet(`SELECT COUNT(*) as n FROM cognitive_goals${jidFilter} AND status = ?`, ...(jid ? [jid, 'active'] : ['active']))?.n || 0;
  const completed = rawGet(`SELECT COUNT(*) as n FROM cognitive_goals${jidFilter} AND status = ?`, ...(jid ? [jid, 'completed'] : ['completed']))?.n || 0;
  const blocked = rawGet(`SELECT COUNT(*) as n FROM cognitive_goals${jidFilter} AND status = ?`, ...(jid ? [jid, 'blocked'] : ['blocked']))?.n || 0;
  return { total, active, completed, blocked };
}

export function getGoalHierarchy(parentId) {
  return rawAll('SELECT * FROM cognitive_goals WHERE parent_id = ? ORDER BY priority ASC, created_at DESC', parentId).map(_parseRow);
}

export function detectGoalsFromText(text, jid) {
  const patterns = [
    { regex: /(?:je\s+)?(?:veux|voudrais|aimerais|dois|vais)\s+(.+?)(?:\.|$)/gi, type: 'personal', priority: 3 },
    { regex: /(?:nous\s+)?(?:devons|allons|faut|doit)\s+(.+?)(?:\.|$)/gi, type: 'project', priority: 4 },
    { regex: /(?:objectif|but|goal|mission)\s*(?::|est\s+de)?\s*(.+?)(?:\.|$)/gi, type: 'goal', priority: 5 },
    { regex: /(?:prochain\s+)?(?:rendez-vous|rdv|meeting|reunion)\s+(.+?)(?:\.|$)/gi, type: 'event', priority: 4 },
    { regex: /(?:j'aurai|j'aurais)\s+besoin\s+(?:de\s+)?(.+?)(?:\.|$)/gi, type: 'need', priority: 3 },
  ];
  const detected = [];
  for (const { regex, type, priority } of patterns) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const desc = match[1].trim();
      if (desc.length > 8 && desc.length < 200) {
        detected.push({ title: desc.slice(0, 100), type, priority, confidence: 0.6 });
      }
    }
  }
  for (const d of detected) {
    createGoal({ jid, title: d.title, type: d.type, priority: d.priority, metadata: { autoDetected: true, confidence: d.confidence } });
  }
  return detected;
}

function _parseRow(row) {
  return {
    ...row,
    tags: tryParse(row.tags, []),
    metadata: tryParse(row.metadata, {}),
  };
}

function tryParse(str, fallback) {
  if (!str || str === '[]' || str === '{}') return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

bus.on(EVENTS.DECISION_MADE, async (data) => {
  if (data.jid && data.context) {
    createGoal({ jid: data.jid, title: `Suite decision: ${data.context.slice(0, 100)}`, type: 'decision', priority: 3, metadata: { fromDecision: true, context: data.context.slice(0, 500) } });
  }
});

bus.on(EVENTS.MESSAGE_RECEIVED, async (data) => {
  if (data.senderJid && data.text) {
    detectGoalsFromText(data.text, data.senderJid);
  }
});
