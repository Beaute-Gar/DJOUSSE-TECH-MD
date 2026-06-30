import { createLogger } from '../core/logger.js';
import { bus, EVENTS } from './event-bus.js';
import { rawGet, rawRun, rawAll } from '../lib/database.js';

const log = createLogger('AUTOMATION');

const pendingActions = [];
const timers = new Map();
const MAX_ACTIONS = 500;

export const ACTION_TYPES = {
  TASK:       'task',
  REMINDER:   'reminder',
  SCHEDULED:  'scheduled',
  FOLLOWUP:   'followup',
  PAYMENT:    'payment',
  INVOICE:    'invoice',
  CALL:       'call',
  MESSAGE:    'message',
  ALERT:      'alert',
  REPORT:     'report',
};

export function createAction({ type, jid, title, description, dueAt, priority = 0, relatedTo = null, metadata = {} }) {
  if (pendingActions.length >= MAX_ACTIONS) pendingActions.shift();
  const action = {
    id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type, jid, title, description: description || title,
    dueAt: dueAt || Date.now() + 86400000,
    priority, relatedTo, metadata,
    status: 'pending',
    createdAt: Date.now(),
    completedAt: null,
  };
  pendingActions.push(action);
  pendingActions.sort((a, b) => a.priority - b.priority);

  rawRun('INSERT OR REPLACE INTO cognitive_actions (id, jid, type, title, description, due_at, priority, related_to, metadata, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    action.id, action.jid, action.type, action.title, action.description, action.dueAt, action.priority,
    relatedTo ? JSON.stringify(relatedTo) : null, JSON.stringify(metadata), 'pending', action.createdAt);

  const eventType = type === 'task' ? EVENTS.TASK_CREATED : type === 'payment' ? EVENTS.PAYMENT_DETECTED : null;
  if (eventType) bus.emit(eventType, { action });

  _scheduleReminder(action);
  log.info(`[Auto] Action creee: ${type} pour ${jid}: ${title}`);
  return action;
}

export function completeAction(id) {
  const action = pendingActions.find(a => a.id === id);
  if (action) { action.status = 'completed'; action.completedAt = Date.now(); }
  rawRun('UPDATE cognitive_actions SET status = ?, completed_at = ? WHERE id = ?', 'completed', Date.now(), id);
  if (action?.type === 'task') bus.emit(EVENTS.TASK_COMPLETED, { action });
  _clearTimer(id);
  return action;
}

export function cancelAction(id) {
  const action = pendingActions.find(a => a.id === id);
  if (action) { action.status = 'cancelled'; }
  rawRun('UPDATE cognitive_actions SET status = ? WHERE id = ?', 'cancelled', id);
  _clearTimer(id);
  return action;
}

export function getPendingActions(jid = null, type = null) {
  let items = pendingActions.filter(a => a.status === 'pending');
  if (jid) items = items.filter(a => a.jid === jid);
  if (type) items = items.filter(a => a.type === type);
  return items.sort((a, b) => a.priority - b.priority);
}

export function getActionsByJid(jid, limit = 20) {
  return rawAll('SELECT * FROM cognitive_actions WHERE jid = ? ORDER BY created_at DESC LIMIT ?', jid, limit);
}

export function detectTasksFromText(text, jid, senderJid) {
  const patterns = [
    { regex: /(?:nous\s+)?(?:devons|allons|faut|doit|doivent)\s+(.+?)(?:\.|$)/gi, type: 'task' },
    { regex: /(?:n'oublie|rappelle|rappel|rappelle-moi|souviens)\s+(?:de\s+)?(.+?)(?:\.|$)/gi, type: 'reminder' },
    { regex: /(?:je\s+)?(?:dois|vais|faut\s+que\s+je)\s+(.+?)(?:\.|$)/gi, type: 'task' },
    { regex: /(?:relance|suivi|follow.?up)\s+(.+?)(?:\.|$)/gi, type: 'followup' },
    { regex: /(?:payer|facture|virement)\s+(.+?)(?:\.|$)/gi, type: 'payment' },
  ];
  const detected = [];
  for (const { regex, type } of patterns) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const desc = match[1].trim();
      if (desc.length > 5 && desc.length < 200) {
        detected.push({ type, description: desc, confidence: type === 'task' ? 0.7 : 0.6 });
      }
    }
  }
  for (const d of detected) {
    createAction({
      type: d.type, jid, title: d.description.slice(0, 100),
      description: d.description, dueAt: Date.now() + 86400000,
      priority: d.type === 'payment' ? 8 : (d.type === 'followup' ? 6 : 4),
      metadata: { autoDetected: true, confidence: d.confidence, detectedFrom: senderJid },
    });
  }
  return detected;
}

export function getOverdueActions() {
  const now = Date.now();
  return pendingActions.filter(a => a.status === 'pending' && a.dueAt < now);
}

function _scheduleReminder(action) {
  const delay = action.dueAt - Date.now();
  if (delay > 0 && delay < 86400000 * 30) {
    const timer = setTimeout(() => {
      log.info(`[Auto] Rappel: ${action.type} pour ${action.jid}: ${action.title}`);
      bus.emit('action:due', { action });
      if (action.type === 'reminder') {
        bus.emit(EVENTS.MESSAGE_SENT, { to: action.jid, text: `⏰ *Rappel*: ${action.title}` });
      }
      _clearTimer(action.id);
    }, delay);
    timers.set(action.id, timer);
  }
}

function _clearTimer(id) {
  if (timers.has(id)) { clearTimeout(timers.get(id)); timers.delete(id); }
}

export function loadPersistedActions() {
  const rows = rawAll('SELECT * FROM cognitive_actions WHERE status = ? ORDER BY created_at DESC LIMIT 200', 'pending');
  for (const row of rows) {
    const action = {
      id: row.id, type: row.type, jid: row.jid, title: row.title, description: row.description,
      dueAt: row.due_at, priority: row.priority,
      relatedTo: row.related_to ? tryParse(row.related_to, null) : null,
      metadata: row.metadata ? tryParse(row.metadata, {}) : {},
      status: 'pending', createdAt: row.created_at, completedAt: null,
    };
    pendingActions.push(action);
    _scheduleReminder(action);
  }
  log.info(`[Auto] ${rows.length} actions persistees chargees`);
  return rows.length;
}

function tryParse(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

bus.on(EVENTS.MESSAGE_RECEIVED, async (data) => {
  if (data.text) {
    const detected = detectTasksFromText(data.text, data.senderJid, data.senderJid);
    if (detected.length > 0) log.info(`[Auto] ${detected.length} taches detectees depuis ${data.senderJid}`);
  }
});
