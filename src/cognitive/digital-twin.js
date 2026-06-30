import { createLogger } from '../core/logger.js';
import { bus, EVENTS } from './event-bus.js';
import { getPerson, updatePerson } from './identity-engine.js';
import { getContext } from './context-engine.js';
import { rawGet, rawRun, rawAll } from '../lib/database.js';

const log = createLogger('TWIN');

const twinCache = new Map();

function twinKey(jid) { return `twin:${jid}`; }

export function getOrCreateTwin(jid) {
  if (twinCache.has(jid)) return twinCache.get(jid);

  let row = rawGet('SELECT * FROM cognitive_twins WHERE jid = ?', jid);
  if (!row) {
    const now = Date.now();
    rawRun('INSERT INTO cognitive_twins (jid, profile, habits, scores, predictions, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      jid, '{}', '{}', '{}', '{}', now, now);
    row = rawGet('SELECT * FROM cognitive_twins WHERE jid = ?', jid);
  }

  const twin = {
    jid: row.jid,
    profile: parseField(row.profile, {}),
    habits: parseField(row.habits, {}),
    scores: parseField(row.scores, {}),
    predictions: parseField(row.predictions, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  twinCache.set(jid, twin);
  return twin;
}

export function getTwin(jid) {
  if (twinCache.has(jid)) return twinCache.get(jid);
  const row = rawGet('SELECT * FROM cognitive_twins WHERE jid = ?', jid);
  if (!row) return null;
  const twin = { jid: row.jid, profile: parseField(row.profile, {}), habits: parseField(row.habits, {}), scores: parseField(row.scores, {}), predictions: parseField(row.predictions, {}), createdAt: row.created_at, updatedAt: row.updated_at };
  twinCache.set(jid, twin);
  return twin;
}

function saveTwin(twin) {
  rawRun('UPDATE cognitive_twins SET profile = ?, habits = ?, scores = ?, predictions = ?, updated_at = ? WHERE jid = ?',
    JSON.stringify(twin.profile), JSON.stringify(twin.habits), JSON.stringify(twin.scores), JSON.stringify(twin.predictions), Date.now(), twin.jid);
  twinCache.set(twin.jid, twin);
}

export function updateProfile(jid, updates) {
  const twin = getOrCreateTwin(jid);
  Object.assign(twin.profile, updates);
  saveTwin(twin);
  return twin;
}

export function observeInteraction(jid, type, data) {
  const twin = getOrCreateTwin(jid);
  const now = Date.now();

  if (!twin.habits.activityLog) twin.habits.activityLog = [];
  twin.habits.activityLog.push({ type, timestamp: now, data: data?.slice?.(0, 100) || type });

  if (twin.habits.activityLog.length > 1000) twin.habits.activityLog = twin.habits.activityLog.slice(-500);

  const hour = new Date().getHours();
  if (!twin.habits.activeHours) twin.habits.activeHours = {};
  twin.habits.activeHours[hour] = (twin.habits.activeHours[hour] || 0) + 1;

  if (!twin.habits.dailyCount) twin.habits.dailyCount = {};
  const today = new Date().toISOString().slice(0, 10);
  twin.habits.dailyCount[today] = (twin.habits.dailyCount[today] || 0) + 1;

  _updateScores(twin, type);
  _generatePredictions(twin);
  saveTwin(twin);
  return twin;
}

function _updateScores(twin, type) {
  const s = twin.scores;
  s.activityScore = (s.activityScore || 0) + 1;
  s.interactionCount = (s.interactionCount || 0) + 1;
  s.lastInteraction = Date.now();

  if (type === 'message') s.messageCount = (s.messageCount || 0) + 1;
  if (type === 'command') s.commandCount = (s.commandCount || 0) + 1;
  if (type === 'audio') s.audioCount = (s.audioCount || 0) + 1;
  if (type === 'image') s.imageCount = (s.imageCount || 0) + 1;

  if (s.messageCount > 50) s.influenceScore = Math.min(100, (s.influenceScore || 0) + 0.5);
  if (s.interactionCount > 0) {
    const daysActive = Object.keys(twin.habits.dailyCount || {}).length || 1;
    s.consistencyScore = Math.min(100, Math.round((s.interactionCount / daysActive) * 10));
  }

  const daysSince = twin.habits.activityLog?.length > 1
    ? (Date.now() - (twin.habits.activityLog[twin.habits.activityLog.length - 2]?.timestamp || Date.now())) / 86400000
    : 1;
  s.responseTime = s.responseTime ? Math.round((s.responseTime + daysSince) / 2) : daysSince;

  s.trustScore = Math.min(100, Math.round(
    (s.consistencyScore || 50) * 0.4 +
    (s.influenceScore || 0) * 0.3 +
    Math.max(0, 100 - (s.responseTime || 10) * 5) * 0.3
  ));

  const person = getPerson(twin.jid);
  if (person && person.frequency > 0) {
    s.familiarityScore = Math.min(100, Math.round((person.frequency / 100) * 100));
  }
}

function _generatePredictions(twin) {
  const p = twin.predictions;
  const habits = twin.habits;

  const activityLog = habits.activityLog || [];
  if (activityLog.length > 5) {
    const lastFew = activityLog.slice(-5);
    const intervals = [];
    for (let i = 1; i < lastFew.length; i++) {
      intervals.push(lastFew[i].timestamp - lastFew[i - 1].timestamp);
    }
    const avgInterval = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 86400000;
    p.nextContactProbability = Math.min(95, Math.max(5, Math.round(100 - (avgInterval / 86400000) * 20)));
    p.estimatedNextContact = p.nextContactProbability > 50 ? Date.now() + avgInterval : null;
  }

  if (habits.activeHours) {
    const bestHour = Object.entries(habits.activeHours).sort((a, b) => b[1] - a[1])[0];
    p.bestContactHour = bestHour ? parseInt(bestHour[0]) : 10;
  }

  const s = twin.scores;
  p.needsAttention = s.trustScore < 40 || (s.responseTime || 10) > 5;
  p.engagementLevel = s.activityScore > 100 ? 'high' : (s.activityScore > 30 ? 'medium' : 'low');
}

export function getTwinSummary(jid) {
  const twin = getTwin(jid);
  if (!twin) return null;
  const s = twin.scores;
  const p = twin.predictions;
  return {
    scores: {
      activity: s.activityScore || 0,
      trust: s.trustScore || 50,
      consistency: s.consistencyScore || 0,
      influence: s.influenceScore || 0,
      familiarity: s.familiarityScore || 0,
      engagement: p.engagementLevel || 'unknown',
    },
    habits: {
      bestHour: p.bestContactHour || 12,
      dailyAverage: _dailyAvg(twin),
      totalInteractions: s.interactionCount || 0,
    },
    predictions: {
      nextContactProbability: p.nextContactProbability || 50,
      needsAttention: p.needsAttention || false,
      estimatedResponseDays: s.responseTime || 1,
    },
    profile: twin.profile,
  };
}

export function getAllTwins() {
  const rows = rawAll('SELECT jid, scores, predictions FROM cognitive_twins ORDER BY updated_at DESC');
  return rows.map(r => {
    const scores = parseField(r.scores, {});
    const predictions = parseField(r.predictions, {});
    return { jid: r.jid, activityScore: scores.activityScore || 0, trustScore: scores.trustScore || 50, needsAttention: predictions.needsAttention || false };
  });
}

export function findTwinsByScore(scoreField = 'trustScore', min = 0, max = 100) {
  const all = getAllTwins();
  return all.filter(t => {
    const val = t[scoreField] || 0;
    return val >= min && val <= max;
  });
}

function _dailyAvg(twin) {
  const dailyCount = twin.habits.dailyCount || {};
  const days = Object.keys(dailyCount);
  if (days.length === 0) return 0;
  const total = Object.values(dailyCount).reduce((a, b) => a + b, 0);
  return Math.round(total / days.length);
}

function parseField(str, fallback) {
  if (!str || str === '{}') return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

export function clearTwinCache() { twinCache.clear(); }

bus.on(EVENTS.MESSAGE_RECEIVED, async (data) => {
  if (data.senderJid) {
    observeInteraction(data.senderJid, 'message', data.text);
    updateProfile(data.senderJid, {
      lastMessage: data.text?.slice(0, 200),
      lastSeen: Date.now(),
    });
  }
});

bus.on(EVENTS.PERSON_IDENTIFIED, async (data) => {
  const { person } = data;
  if (person) {
    const twin = getOrCreateTwin(person.jid);
    updateProfile(person.jid, { name: person.name, type: person.type, number: person.number });
    if (person.frequency) twin.scores.familiarityScore = Math.min(100, Math.round((person.frequency / 100) * 100));
    saveTwin(twin);
  }
});
