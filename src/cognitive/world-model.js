import { createLogger } from '../core/logger.js';
import { bus, EVENTS } from './event-bus.js';
import { getPerson, getAllPersons, getRelations, searchPersons } from './identity-engine.js';
import { getNode, getRelated, getStats, searchNodes, NODE_TYPES } from './knowledge-graph.js';
import { recallRecent } from './memory-engine.js';
import { getContext, getActiveContexts } from './context-engine.js';
import { getPendingActions, getOverdueActions, getActionsByJid } from './automation-engine.js';

const log = createLogger('WORLD');

const worldCache = { entities: null, relations: null, cachedAt: 0 };
const CACHE_TTL = 30_000;

export function getWorldSummary(jid = null) {
  const now = Date.now();
  if (worldCache.entities && now - worldCache.cachedAt < CACHE_TTL && !jid) {
    return worldCache;
  }

  const graphStats = getStats();
  const activeContexts = getActiveContexts();
  const pendingActions = getPendingActions();
  const overdueActions = getOverdueActions();

  const world = {
    timestamp: now,
    stats: {
      persons: graphStats.byType?.find(t => t.type === 'person')?.n || 0,
      companies: graphStats.byType?.find(t => t.type === 'company')?.n || 0,
      projects: graphStats.byType?.find(t => t.type === 'project')?.n || 0,
      totalNodes: graphStats.nodes,
      totalEdges: graphStats.edges,
      activeConversations: activeContexts.length,
      pendingActions: pendingActions.length,
      overdueActions: overdueActions.length,
    },
    activeConversations: activeContexts.slice(0, 10),
    pendingActions: pendingActions.slice(0, 10),
    overdueActions: overdueActions.slice(0, 10),
  };

  if (jid) {
    const person = getPerson(jid);
    const context = getContext(jid);
    const related = getRelated(jid);
    const memories = recallRecent(jid, null, 5);
    const actions = getPendingActions(jid);
    world.focus = {
      person: person ? { name: person.name, type: person.type, trustLevel: person.trust_level, frequency: person.frequency } : null,
      context: context ? context.getSummary() : null,
      relatedEntities: related.slice(0, 10).map(r => ({ id: r.node.id, type: r.node.type, relation: r.edge.type })),
      recentMemories: memories.map(m => ({ type: m.type, content: m.content.slice(0, 150), created: m.created_at })),
      pendingActions: actions.map(a => ({ type: a.type, title: a.title, dueAt: a.dueAt })),
    };
  }

  if (!jid) {
    worldCache.entities = world;
    worldCache.cachedAt = now;
  }

  return world;
}

export function getEntityProfile(entityId) {
  const node = getNode(entityId);
  if (!node) return null;

  const related = getRelated(entityId);
  const context = getContext(entityId);
  const memories = recallRecent(entityId, null, 5);
  const actions = getPendingActions(entityId);

  const person = node.type === 'person' ? getPerson(entityId) : null;

  return {
    id: entityId,
    type: node.type,
    properties: node.properties,
    person: person ? { name: person.name, frequency: person.frequency, trustLevel: person.trust_level } : null,
    relations: related.slice(0, 20).map(r => ({
      type: r.edge.type,
      direction: r.edge.source_id === entityId ? 'out' : 'in',
      targetId: r.node.id,
      targetType: r.node.type,
      targetName: r.node.properties?.name || r.node.id,
      weight: r.edge.weight,
    })),
    context: context ? context.getSummary() : null,
    recentMemories: memories.map(m => ({ content: m.content.slice(0, 200), created: m.created_at })),
    pendingActions: actions.map(a => ({ type: a.type, title: a.title, dueAt: a.dueAt, priority: a.priority })),
  };
}

export function searchWorld(query) {
  const nodes = searchNodes(query) || [];
  const persons = searchPersons(query) || [];
  return {
    nodes: nodes.map(n => ({ id: n.id, type: n.type, properties: typeof n.properties === 'string' ? JSON.parse(n.properties) : n.properties })),
    persons: persons.map(p => ({ id: p.jid, name: p.name, type: 'person', frequency: p.frequency })),
  };
}

export function getTimeline(jid = null, limit = 50) {
  const events = [];

  if (jid) {
    const context = getContext(jid);
    if (context) {
      for (const msg of context.messages.slice(-limit)) {
        events.push({ type: 'message', timestamp: msg.timestamp, data: { text: msg.text.slice(0, 100), sender: msg.sender } });
      }
    }
    const memories = recallRecent(jid, null, limit);
    for (const m of memories) {
      events.push({ type: 'memory', timestamp: m.created_at, data: { summary: m.content.slice(0, 100), memoryType: m.type } });
    }
    const actions = getActionsByJid(jid, limit);
    for (const a of actions) {
      events.push({ type: 'action', timestamp: a.created_at, data: { action: a.type, title: a.title, status: a.status } });
    }
  }

  const busHistory = bus.getHistory();
  for (const h of busHistory.slice(-limit)) {
    events.push({ type: 'event', timestamp: h.timestamp, data: { event: h.event } });
  }

  return events.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, limit);
}

export function getWorldInsights() {
  const insights = [];
  const overdue = getOverdueActions();
  if (overdue.length > 0) {
    insights.push({ severity: 'warning', message: `${overdue.length} actions en retard necessitent votre attention`, count: overdue.length });
  }
  const pending = getPendingActions();
  if (pending.length > 10) {
    insights.push({ severity: 'info', message: `${pending.length} actions en attente, dont ${pending.filter(a => a.priority > 5).length} haute priorite`, count: pending.length });
  }
  const activeContexts = getActiveContexts();
  if (activeContexts.length > 0) {
    const urgent = activeContexts.filter(c => c.sentiment === 'negative');
    if (urgent.length > 0) {
      insights.push({ severity: 'info', message: `${urgent.length} conversations ont un sentiment negatif`, count: urgent.length });
    }
  }
  return insights;
}

export function getWorldState() {
  return {
    version: '1.0.0',
    uptime: process.uptime(),
    engines: {
      eventBus: { listeners: bus.listenerCount(EVENTS.MESSAGE_RECEIVED) },
      identity: { cached: true },
      knowledgeGraph: getStats(),
      memory: { active: true },
      context: { activeConversations: getActiveContexts().length },
      decision: { rulesLoaded: true },
      automation: { pendingActions: getPendingActions().length },
    },
    insights: getWorldInsights(),
  };
}
