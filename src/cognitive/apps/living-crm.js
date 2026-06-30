import { CognitiveApp } from './cognitive-app.js';
import { getAllPersons, resolvePerson, getRelations } from '../identity-engine.js';
import { getTwin } from '../digital-twin.js';
import { semanticMemory } from '../semantic-memory.js';
import { foresight } from '../foresight-engine.js';
import { planner } from '../planning-engine.js';
import { getPendingActions } from '../automation-engine.js';
import { createLogger } from '../../core/logger.js';

const log = createLogger('CRM');

export class LivingCRM extends CognitiveApp {
  constructor() {
    super({ name: 'living-crm', version: '1.0.0', description: 'CRM vivant : chaque contact est une entite cognitive pilotee par le noyau' });
  }

  async getContact(jid) {
    try {
      const person = await resolvePerson(jid);
      if (!person) return null;
      let twin = null; try { twin = getTwin(jid); } catch {}
      let relations = []; try { relations = await getRelations(jid); } catch {}
      const timeline = semanticMemory.timeline.getBySource('person', jid, 20);
      const context = semanticMemory.context.getAll(jid);
      let relationshipSummary = null; try { relationshipSummary = await semanticMemory.relationships.getSummary(jid); } catch {}
      let behavior = null; try { behavior = await foresight.predictBehavior(jid); } catch {}
      const episodes = semanticMemory.episodes.getByEntity('person', jid, 10);
      const missions = planner.getAllMissions().filter(m => m.owner === jid || m.participants?.includes(jid));
      const pendingActions = getPendingActions().filter(a => a.jid === jid);
      return {
        jid, name: person.name || jid.split('@')[0],
        identity: { lastSeen: person.lastSeen, frequency: person.frequency, trustLevel: person.trust_level, firstSeen: person.createdAt },
        digitalTwin: twin ? { activity: twin.scores?.activity, confidence: twin.scores?.confidence, influence: twin.scores?.influence, coherence: twin.scores?.coherence, interactionCount: twin.interactionCount } : null,
        relationships: relationshipSummary,
        behavior,
        context: context.map(c => ({ key: c.key, value: c.value })),
        timeline: timeline.map(t => ({ title: t.title, date: t.timestamp, tags: t.tags })),
        episodes: episodes.map(e => ({ id: e.id, type: e.type, title: e.title, date: e.createdAt })),
        missions: missions.map(m => ({ id: m.id, title: m.title, status: m.status, progress: m.progress })),
        pendingActions: pendingActions.map(a => ({ id: a.id, title: a.title, priority: a.priority })),
        _meta: { generatedAt: Date.now(), sources: ['identity', 'digital_twin', 'semantic_memory', 'foresight', 'planning', 'automation'] },
      };
    } catch (err) { log.error(`getContact: ${err.message}`); return null; }
  }

  async searchContacts(query) {
    const persons = await getAllPersons() || [];
    if (!query || query === '*') return persons.map(p => ({ jid: p.jid, name: p.name, frequency: p.frequency, lastSeen: p.last_seen }));
    const q = query.toLowerCase();
    return persons.filter(p => (p.name || '').toLowerCase().includes(q) || p.jid.toLowerCase().includes(q))
      .map(p => ({ jid: p.jid, name: p.name, frequency: p.frequency, lastSeen: p.last_seen }));
  }

  async getContactSummary(jid) {
    const contact = await this.getContact(jid);
    if (!contact) return 'Contact introuvable';
    const lines = [];
    lines.push(`FICHE CONTACT: ${contact.name}`);
    lines.push(`  JID: ${contact.jid}`);
    lines.push(`  Confiance: ${contact.identity?.trustLevel || 'N/A'}/5 | Frequence: ${contact.identity?.frequency || 0}`);
    if (contact.digitalTwin) {
      lines.push(`  Jumeau numerique: Activite ${contact.digitalTwin.activity}% | Confiance ${contact.digitalTwin.confidence}%`);
      lines.push(`  Influence: ${contact.digitalTwin.influence} | Coherence: ${contact.digitalTwin.coherence}%`);
    }
    if (contact.behavior) lines.push(`  Meilleur creneau: ${contact.behavior.bestTime?.period || 'N/A'}`);
    if (contact.relationships?.totalRelationships > 0) lines.push(`  Relations: ${contact.relationships.totalRelationships} contacts`);
    if (contact.missions.length > 0) lines.push(`  Missions: ${contact.missions.length} (${contact.missions.filter(m => m.status === 'active').length} actives)`);
    if (contact.pendingActions.length > 0) lines.push(`  Actions en attente: ${contact.pendingActions.length}`);
    if (contact.episodes.length > 0) lines.push(`  Episodes recents: ${contact.episodes.slice(0, 3).map(e => e.title).join(', ')}`);
    return lines.join('\n');
  }

  async analyzeAllContacts() {
    const persons = await getAllPersons() || [];
    const results = [];
    for (const p of persons.slice(0, 50)) {
      try {
        const c = await this.getContact(p.jid);
        if (c) results.push({ jid: p.jid, name: c.name, trustLevel: c.identity?.trustLevel, activity: c.digitalTwin?.activity || 0, missions: c.missions.length, pending: c.pendingActions.length });
      } catch {}
    }
    return results.sort((a, b) => (b.activity || 0) - (a.activity || 0));
  }

  async getTopContacts(limit = 10) {
    const all = await this.analyzeAllContacts();
    return all.slice(0, limit);
  }

  async getAtRiskContacts() {
    const persons = await getAllPersons() || [];
    const atRisk = [];
    for (const p of persons) {
      if (!p.lastSeen) continue;
      const daysSince = (Date.now() - new Date(p.lastSeen).getTime()) / 86400000;
      if (daysSince > 14 && p.frequency > 0) {
        atRisk.push({ jid: p.jid, name: p.name || p.jid.split('@')[0], daysSinceInactive: Math.round(daysSince), reason: 'Inactif depuis plus de 14 jours' });
      }
    }
    return atRisk.sort((a, b) => b.daysSinceInactive - a.daysSinceInactive);
  }

  async getOpportunities() {
    const persons = await getAllPersons() || [];
    const opps = [];
    const highTrust = persons.filter(p => p.trust_level >= 4 && p.frequency > 0);
    for (const p of highTrust) {
      opps.push({ jid: p.jid, name: p.name || p.jid.split('@')[0], trustLevel: p.trust_level, type: 'ambassadeur_potentiel', note: 'Contact de confiance a solliciter' });
    }
    return opps;
  }

  render() {
    return { app: 'living-crm', status: this._ready ? 'actif' : 'inactif', description: 'CRM vivant alimente par le noyau cognitif' };
  }
}

export const crm = new LivingCRM();
export default crm;
