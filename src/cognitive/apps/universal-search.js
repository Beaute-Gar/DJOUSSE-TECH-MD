import { CognitiveApp } from './cognitive-app.js';
import { api } from '../cognitive-api.js';
import { semanticMemory } from '../semantic-memory.js';
import { getAllPersons } from '../identity-engine.js';
import { planner } from '../planning-engine.js';
import { createLogger } from '../../core/logger.js';

const log = createLogger('SEARCH');

export class UniversalSearch extends CognitiveApp {
  constructor() {
    super({ name: 'universal-search', version: '1.0.0', description: 'Recherche en langage naturel dans tout le Cognitive OS' });
  }

  async query(text, options = {}) {
    const start = Date.now();
    log.info(`[Search] "${text.slice(0, 80)}"`);

    const structured = this._parseQuery(text);
    const results = { query: text, interpreted: structured, sources: [], total: 0, duration: 0 };

    if (structured.type === 'contact') {
      const persons = await getAllPersons() || [];
      const matches = persons.filter(p => (p.name || '').toLowerCase().includes(structured.target.toLowerCase()) || p.jid.includes(structured.target));
      results.sources.push({ type: 'contacts', count: matches.length, items: matches.slice(0, 10).map(p => ({ name: p.name || p.jid, jid: p.jid, trustLevel: p.trust_level })) });
    }

    if (structured.type === 'mission' || !structured.type) {
      const missions = planner.getAllMissions().filter(m =>
        m.title.toLowerCase().includes(structured.target.toLowerCase()) ||
        (m.tags || []).some(t => t.toLowerCase().includes(structured.target.toLowerCase()))
      );
      results.sources.push({ type: 'missions', count: missions.length, items: missions.slice(0, 10).map(m => ({ id: m.id, title: m.title, status: m.status, progress: m.progress })) });
    }

    if (structured.type === 'episode' || !structured.type) {
      const episodes = semanticMemory.episodes.getTimeline(50).filter(e =>
        e.title.toLowerCase().includes(structured.target.toLowerCase()) ||
        e.description.toLowerCase().includes(structured.target.toLowerCase())
      );
      results.sources.push({ type: 'episodes', count: episodes.length, items: episodes.slice(0, 10).map(e => ({ id: e.id, type: e.type, title: e.title })) });
    }

    if (structured.type === 'concept' || !structured.type) {
      try {
        const concepts = semanticMemory.concepts.getAll().filter(c => c.name.toLowerCase().includes(structured.target.toLowerCase()));
        if (concepts.length > 0) results.sources.push({ type: 'concepts', count: concepts.length, items: concepts.slice(0, 10).map(c => ({ name: c.name, strength: c.strength, type: c.type })) });
      } catch {}
    }

    const mesh = semanticMemory.mesh.search(structured.target);
    if (mesh.length > 0) results.sources.push({ type: 'mesh', count: mesh.length, items: mesh.slice(0, 10).map(m => ({ relation: m.relation, source: `${m.sourceType}:${m.sourceId}`, target: `${m.targetType}:${m.targetId}`, score: m.score })) });

    const apiResult = await api.search(text, options);
    if (apiResult.objects?.length > 0) results.sources.push({ type: 'cognitive_objects', count: apiResult.objects.length, items: apiResult.objects.slice(0, 5) });

    results.total = results.sources.reduce((s, src) => s + src.count, 0);
    results.duration = Date.now() - start;
    return results;
  }

  _parseQuery(text) {
    const lower = text.toLowerCase();
    if (/contact|personne|qui|client|utilisateur|membre/.test(lower)) return { type: 'contact', target: text.replace(/contact|personne|qui est|client|utilisateur|membre/g, '').trim() || text };
    if (/mission|projet|tache|goal|objectif/.test(lower)) return { type: 'mission', target: text.replace(/mission|projet|tache|goal|objectif/g, '').trim() || text };
    if (/episode|evenement|conversation|discussion/.test(lower)) return { type: 'episode', target: text.replace(/episode|evenement|conversation|discussion/g, '').trim() || text };
    if (/concept|notion|theme|sujet/.test(lower)) return { type: 'concept', target: text.replace(/concept|notion|theme|sujet/g, '').trim() || text };
    if (/facture|paiement|transaction/.test(lower)) return { type: 'episode', target: text };
    if (/decision|raisonnement|pourquoi/.test(lower)) return { type: 'reasoning', target: text };
    return { type: null, target: text };
  }

  async ask(question) {
    const results = await this.query(question);
    if (results.total === 0) return { answer: "Je n'ai rien trouve correspondant a votre recherche.", results };
    const summary = [];
    for (const src of results.sources) {
      if (src.count > 0) summary.push(`${src.count} ${src.type} trouve(s)`);
    }
    return { answer: `J'ai trouve ${results.total} resultats. ${summary.join(', ')}.`, results };
  }

  render() {
    return { app: 'universal-search', status: this._ready ? 'actif' : 'inactif' };
  }
}

export const universalSearch = new UniversalSearch();
export default universalSearch;
