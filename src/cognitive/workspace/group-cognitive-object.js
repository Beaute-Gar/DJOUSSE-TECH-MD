import { createLogger } from '../../core/logger.js';
import { bus } from '../event-bus.js';
import { api } from '../cognitive-api.js';
import { semanticMemory } from '../semantic-memory.js';

const log = createLogger('GROUPCO');

export class GroupCognitiveObject {
  constructor(jid, metadata = {}) {
    this.jid = jid;
    this.subject = metadata.subject || 'Unknown Group';
    this.size = metadata.size || 0;
    this.isAdmin = metadata.isAdmin || false;
    this.createdAt = Date.now();
    this.lastActive = Date.now();
    this.members = new Map();
    this.context = {};
    this.decisions = [];
    this.objectives = [];
    this.rules = [];
    this.trust = 0.7;
    this.identity = {
      topics: [],
      tone: 'neutral',
      language: 'fr',
      activityLevel: 'medium',
    };
  }

  async recordMessage(author, text, type) {
    this.lastActive = Date.now();
    const member = this.members.get(author) || { jid: author, messages: 0, firstSeen: Date.now(), lastSeen: Date.now() };
    member.messages++;
    member.lastSeen = Date.now();
    this.members.set(author, member);
    try {
      await api.observe(text, { jid: this.jid, author });
    } catch {}
  }

  async recordDecision(decision, context) {
    this.decisions.push({ decision, context, timestamp: Date.now() });
    if (this.decisions.length > 100) this.decisions.shift();
    try {
      await api.act({ type: 'store_context', key: `group:${this.jid}:decision:${Date.now()}`, value: { decision, context } }, { jid: this.jid });
    } catch {}
  }

  addObjective(objective, priority = 2) {
    this.objectives.push({ objective, priority, created: Date.now(), status: 'active' });
  }

  addRule(rule, effect = 'warn') {
    this.rules.push({ rule, effect, created: Date.now(), enabled: true });
  }

  updateIdentity(topics, tone) {
    if (topics) {
      for (const t of topics) {
        if (!this.identity.topics.includes(t)) this.identity.topics.push(t);
      }
    }
    if (tone) this.identity.tone = tone;
  }

  getSummary() {
    return {
      subject: this.subject,
      size: this.members.size,
      messagesTotal: Array.from(this.members.values()).reduce((s, m) => s + m.messages, 0),
      decisions: this.decisions.length,
      objectives: this.objectives.filter(o => o.status === 'active').length,
      rules: this.rules.filter(r => r.enabled).length,
      trust: this.trust,
      identity: this.identity,
      lastActive: this.lastActive,
    };
  }

  toJSON() {
    return {
      jid: this.jid, subject: this.subject, size: this.size, isAdmin: this.isAdmin,
      createdAt: this.createdAt, lastActive: this.lastActive, trust: this.trust,
      identity: this.identity,
      decisions: this.decisions.slice(-10),
      objectives: this.objectives,
      rules: this.rules,
      members: Array.from(this.members.entries()).map(([k, v]) => ({ jid: k, ...v })),
    };
  }
}

export class GroupObjectStore {
  #groups = new Map();

  getOrCreate(jid, metadata = {}) {
    if (this.#groups.has(jid)) return this.#groups.get(jid);
    const gco = new GroupCognitiveObject(jid, metadata);
    this.#groups.set(jid, gco);
    bus.emit('group:object_created', { jid, subject: metadata.subject });
    log.info(`[GROUPCO] Created: ${metadata.subject || jid}`);
    return gco;
  }

  get(jid) {
    return this.#groups.get(jid);
  }

  remove(jid) {
    this.#groups.delete(jid);
  }

  list() {
    return Array.from(this.#groups.values()).map(g => g.getSummary());
  }

  findByTopic(topic) {
    return Array.from(this.#groups.values()).filter(g =>
      g.identity.topics.some(t => t.toLowerCase().includes(topic.toLowerCase()))
    );
  }

  getStats() {
    const all = this.list();
    return {
      total: all.length,
      totalMembers: all.reduce((s, g) => s + g.size, 0),
      totalMessages: all.reduce((s, g) => s + g.messagesTotal, 0),
      activeToday: all.filter(g => Date.now() - g.lastActive < 86400000).length,
    };
  }
}

export const groupStore = new GroupObjectStore();
export default groupStore;
