import { createLogger } from '../core/logger.js';
import { bus, EVENTS } from './event-bus.js';
import { getPerson, getRelations } from './identity-engine.js';
import { getNode, getRelated, getStats } from './knowledge-graph.js';
import { recallLongTerm, recallRecent } from './memory-engine.js';
import { getContext } from './context-engine.js';
import { getWorldSummary, getEntityProfile } from './world-model.js';
import { getTwin, getTwinSummary } from './digital-twin.js';
import { getPendingActions, getOverdueActions } from './automation-engine.js';

const log = createLogger('REASON');

/* ════════════════════════════════════════════════════════════
   REASONING TRACE
════════════════════════════════════════════════════════════ */

let traceIdCounter = 0;

export class ReasoningTrace {
  constructor({ goal, facts = [], context = {} } = {}) {
    this.id = `trace_${Date.now()}_${++traceIdCounter}`;
    this.timestamp = Date.now();
    this.goal = goal || 'analyser';
    this.facts = facts;
    this.context = context;
    this.hypotheses = [];
    this.inferences = [];
    this.confidence = 0.5;
    this.risks = [];
    this.conflicts = [];
    this.alternatives = [];
    this.chosenAction = null;
    this.explanation = '';
    this.simulation = null;
    this.metadata = {};
  }

  addFact(fact, confidence = 1.0, source = 'direct') {
    this.facts.push({ fact, confidence, source, timestamp: Date.now() });
  }

  addInference(inference, confidence, premises) {
    this.inferences.push({ inference, confidence, premises, timestamp: Date.now() });
    this._recalcConfidence();
  }

  addHypothesis(hypothesis, probability, evidence = []) {
    this.hypotheses.push({ hypothesis, probability, evidence, timestamp: Date.now() });
    this.hypotheses.sort((a, b) => b.probability - a.probability);
  }

  addRisk(description, severity, probability, impact) {
    this.risks.push({ description, severity, probability, impact, score: Math.round(severity * probability * 100) / 100 });
    this.risks.sort((a, b) => b.score - a.score);
  }

  addConflict(statement1, statement2, description) {
    this.conflicts.push({ statement1, statement2, description, timestamp: Date.now() });
  }

  setAction(action, alternatives = []) {
    this.chosenAction = action;
    this.alternatives = alternatives;
  }

  setExplanation(explanation) { this.explanation = explanation; }

  setSimulation(sim) { this.simulation = sim; }

  _recalcConfidence() {
    if (this.inferences.length === 0) return;
    const avg = this.inferences.reduce((s, i) => s + i.confidence, 0) / this.inferences.length;
    const factConf = this.facts.reduce((s, f) => s + f.confidence, 0) / Math.max(this.facts.length, 1);
    this.confidence = Math.round((avg * 0.6 + factConf * 0.4) * 100) / 100;
  }

  toJSON() {
    return {
      id: this.id, timestamp: this.timestamp, goal: this.goal,
      facts: this.facts.slice(0, 20), hypotheses: this.hypotheses.slice(0, 5),
      inferences: this.inferences.slice(0, 10), confidence: this.confidence,
      risks: this.risks.slice(0, 5), conflicts: this.conflicts.slice(0, 5),
      chosenAction: this.chosenAction, alternatives: this.alternatives.slice(0, 3),
      explanation: this.explanation, simulation: this.simulation,
    };
  }
}

/* ════════════════════════════════════════════════════════════
   REASONING ENGINE
════════════════════════════════════════════════════════════ */

export class ReasoningEngine {
  constructor() {
    this.traceHistory = [];
    this.maxTraceHistory = 200;
    this.inferenceRules = this._defaultInferenceRules();
  }

  /* ── Entry point ──────────────────────────────────────── */
  async reason(goal, context = {}) {
    const trace = new ReasoningTrace({ goal, context });
    try {
      await this._gatherFacts(trace, context);
      this._runInferenceEngine(trace);
      this._runHypothesisEngine(trace);
      this._runConflictResolver(trace);
      this._runRiskEngine(trace);
      this._runConfidenceEngine(trace);
      await this._runSimulationEngine(trace);
      this._runExplanationEngine(trace);
      this._selectAction(trace);

      this.traceHistory.push(trace);
      if (this.traceHistory.length > this.maxTraceHistory) this.traceHistory.shift();

      bus.emit('reasoning:complete', { trace: trace.toJSON() });
      return trace;
    } catch (err) {
      log.error(`[Reason] ${goal}: ${err.message}`);
      trace.setExplanation(`Erreur de raisonnement: ${err.message}`);
      return trace;
    }
  }

  /* ── 0. Gather facts ──────────────────────────────────── */
  async _gatherFacts(trace, ctx) {
    const jid = ctx.jid || ctx.senderJid;
    if (!jid) return;

    const person = await getPerson(jid);
    if (person) {
      trace.addFact(`Personne identifiee: ${person.name}`, 0.95, 'identity');
      trace.addFact(`Frequence: ${person.frequency} interactions`, 0.9, 'identity');
      trace.addFact(`Niveau confiance: ${person.trust_level}`, 0.8, 'identity');
    }

    const context = getContext(jid);
    if (context) {
      const s = context.getSummary();
      trace.addFact(`Sentiment: ${s.sentiment} (score: ${s.sentimentScore})`, 0.7, 'context');
      trace.addFact(`Sujet conversation: ${s.topic || 'divers'}`, 0.6, 'context');
      trace.addFact(`Messages echanges: ${s.messageCount}`, 0.9, 'context');
    }

    const profile = getEntityProfile(jid);
    if (profile && profile.relations) {
      trace.addFact(`${profile.relations.length} relations connues`, 0.85, 'world');
      for (const rel of profile.relations.slice(0, 3)) {
        trace.addFact(`Relation: ${rel.targetName} (${rel.type})`, 0.75, 'world');
      }
    }

    const twin = getTwinSummary(jid);
    if (twin) {
      trace.addFact(`Score confiance: ${twin.scores.trust}/100`, 0.8, 'twin');
      trace.addFact(`Engagement: ${twin.scores.engagement}`, 0.75, 'twin');
      if (twin.predictions.needsAttention) {
        trace.addFact('Necessite attention', 0.7, 'twin');
      }
    }

    const actions = getPendingActions(jid);
    if (actions.length > 0) {
      trace.addFact(`${actions.length} actions en attente`, 0.9, 'automation');
    }

    if (ctx.text) {
      trace.addFact(`Message: "${ctx.text.slice(0, 200)}"`, 0.95, 'direct');
    }

    if (ctx.isGroup) {
      trace.addFact('Conversation de groupe', 0.95, 'direct');
    }
  }

  /* ── 1. Inference Engine ──────────────────────────────── */
  _runInferenceEngine(trace) {
    for (const rule of this.inferenceRules) {
      try {
        const result = rule.evaluate(trace.facts);
        if (result) {
          trace.addInference(result.inference, result.confidence || 0.7, result.premises || []);
        }
      } catch (err) {
        log.error(`[Inference] ${rule.name}: ${err.message}`);
      }
    }
  }

  _defaultInferenceRules() {
    return [
      {
        name: 'relation_implication',
        evaluate: (facts) => {
          const personFacts = facts.filter(f => f.fact.startsWith('Relation:'));
          if (personFacts.length >= 2) {
            return {
              inference: 'Plusieurs relations suggerent un reseau social actif',
              confidence: 0.65,
              premises: personFacts.map(f => f.fact),
            };
          }
          return null;
        },
      },
      {
        name: 'sentiment_negative_implication',
        evaluate: (facts) => {
          const sent = facts.find(f => f.fact.includes('Sentiment: negative'));
          if (sent) {
            return {
              inference: 'Sentiment negatif peut indiquer un probleme necessitant attention',
              confidence: 0.7,
              premises: [sent.fact],
            };
          }
          return null;
        },
      },
      {
        name: 'frequency_implication',
        evaluate: (facts) => {
          const freq = facts.find(f => f.fact.startsWith('Frequence:'));
          if (freq) {
            const match = freq.fact.match(/(\d+)/);
            if (match) {
              const count = parseInt(match[1]);
              if (count > 50) {
                return { inference: 'Contact haute frequence - relation etroite', confidence: 0.8, premises: [freq.fact] };
              }
              if (count < 5) {
                return { inference: 'Contact recent ou occasionnel', confidence: 0.75, premises: [freq.fact] };
              }
            }
          }
          return null;
        },
      },
      {
        name: 'silence_implication',
        evaluate: (facts) => {
          const lastMsg = facts.find(f => f.fact.startsWith('Messages echanges:'));
          const msgMatch = lastMsg?.fact.match(/(\d+)/);
          const needsAttn = facts.find(f => f.fact === 'Necessite attention');
          if (msgMatch && parseInt(msgMatch[1]) < 3 && needsAttn) {
            return {
              inference: 'Silence prolonge + besoin d\'attention = follow-up recommande',
              confidence: 0.72,
              premises: [lastMsg.fact, needsAttn.fact],
            };
          }
          return null;
        },
      },
      {
        name: 'high_trust_implication',
        evaluate: (facts) => {
          const trust = facts.find(f => f.fact.includes('Score confiance:'));
          if (trust) {
            const match = trust.fact.match(/(\d+)/);
            if (match) {
              const score = parseInt(match[1]);
              if (score > 70) {
                return { inference: 'Haute confiance - reponses prioritaires', confidence: 0.85, premises: [trust.fact] };
              }
              if (score < 30) {
                return { inference: 'Confiance faible - verification recommandee', confidence: 0.8, premises: [trust.fact] };
              }
            }
          }
          return null;
        },
      },
    ];
  }

  /* ── 2. Hypothesis Engine ─────────────────────────────── */
  _runHypothesisEngine(trace) {
    const sent = trace.facts.find(f => f.fact.includes('Sentiment:'));
    const freq = trace.facts.find(f => f.fact.startsWith('Frequence:'));
    const trust = trace.facts.find(f => f.fact.includes('confiance:'));

    if (sent && sent.fact.includes('negative')) {
      trace.addHypothesis('Insatisfaction ou probleme non exprime', 0.6, ['Sentiment negatif']);
      trace.addHypothesis('Evenement exterieur impactant l\'humeur', 0.4, ['Pas de correlation avec le sujet']);
    }

    if (freq) {
      const match = freq.fact.match(/(\d+)/);
      if (match) {
        const c = parseInt(match[1]);
        if (c < 5) {
          trace.addHypothesis('Nouveau contact en phase de decouverte', 0.7, ['Faible frequence']);
          trace.addHypothesis('Contact ponctuel sans interet recurrent', 0.3, ['Faible frequence']);
        }
      }
    }

    if (trust) {
      const match = trust.fact.match(/(\d+)/);
      if (match) {
        const s = parseInt(match[1]);
        if (s > 70) {
          trace.addHypothesis('Relation solide et fiable', 0.85, ['Score confiance eleve']);
          trace.addHypothesis('Connaissance mutuelle etablie', 0.75, ['Score confiance eleve']);
        } else if (s < 30) {
          trace.addHypothesis('Relation recente a construire', 0.65, ['Score confiance faible']);
          trace.addHypothesis('Experience negative passee possible', 0.35, ['Score confiance faible']);
        }
      }
    }

    const actions = trace.facts.filter(f => f.fact.includes('actions en attente'));
    if (actions.length > 0 && sent?.fact.includes('negative')) {
      trace.addHypothesis('Cumul de taches genere de la frustration', 0.55, ['Actions en attente', 'Sentiment negatif']);
    }
  }

  /* ── 3. Conflict Resolver ─────────────────────────────── */
  _runConflictResolver(trace) {
    const sentFacts = trace.facts.filter(f => f.fact.includes('Sentiment:'));
    const trustFacts = trace.facts.filter(f => f.fact.includes('Score confiance:'));

    if (sentFacts.length > 0 && trustFacts.length > 0) {
      const sentIsNeg = sentFacts.some(f => f.fact.includes('negative'));
      const trustIsHigh = trustFacts.some(f => {
        const m = f.fact.match(/(\d+)/);
        return m && parseInt(m[1]) > 70;
      });
      if (sentIsNeg && trustIsHigh) {
        trace.addConflict(
          'Sentiment negatif detecte',
          'Confiance elevee',
          'Sentiment negatif avec une relation de confiance elevee peut indiquer un probleme ponctuel'
        );
      }
    }

    const hypotheses = trace.hypotheses;
    if (hypotheses.length >= 2) {
      const probDiff = hypotheses[0].probability - hypotheses[hypotheses.length - 1].probability;
      if (probDiff < 0.15) {
        trace.addConflict(
          `Hypothese: ${hypotheses[0].hypothesis}`,
          `Hypothese: ${hypotheses[hypotheses.length - 1].hypothesis}`,
          'Probabilites proches - incertitude elevee'
        );
      }
    }
  }

  /* ── 4. Risk Engine ───────────────────────────────────── */
  _runRiskEngine(trace) {
    const actions = trace.facts.filter(f => f.fact.includes('actions en attente'));
    if (actions.length > 0) {
      const match = actions[0].fact.match(/(\d+)/);
      if (match) {
        const count = parseInt(match[1]);
        if (count > 5) {
          trace.addRisk('Surcharge de taches peut entrainer des oublis', 7, 0.6, count);
        }
      }
    }

    const sent = trace.facts.find(f => f.fact.includes('Sentiment: negative'));
    if (sent) {
      trace.addRisk('Insatisfaction non resolue peut entrainer une perte de contact', 8, 0.5, 'eleve');
    }

    const freq = trace.facts.find(f => f.fact.startsWith('Frequence:'));
    if (freq) {
      const match = freq.fact.match(/(\d+)/);
      if (match && parseInt(match[1]) < 3) {
        trace.addRisk('Contact recent - informations limitees, risque d\'erreur', 5, 0.4, 'moyen');
      }
    }

    const trust = trace.facts.find(f => f.fact.includes('Score confiance:'));
    if (trust) {
      const match = trust.fact.match(/(\d+)/);
      if (match && parseInt(match[1]) < 30) {
        trace.addRisk('Confiance faible - action inappropriee possible', 6, 0.5, 'moyen');
      }
    }
  }

  /* ── 5. Confidence Engine ─────────────────────────────── */
  _runConfidenceEngine(trace) {
    for (const fact of trace.facts) {
      if (fact.source === 'direct') fact.confidence = Math.max(fact.confidence, 0.95);
      else if (fact.source === 'identity') fact.confidence = Math.min(fact.confidence, 0.9);
      else if (fact.source === 'context') fact.confidence = Math.min(fact.confidence, 0.75);
      else if (fact.source === 'twin') fact.confidence = Math.min(fact.confidence, 0.8);
      else if (fact.source === 'automation') fact.confidence = Math.max(fact.confidence, 0.85);
    }

    if (trace.conflicts.length > 0) {
      trace.confidence = Math.max(0.3, trace.confidence - 0.15 * trace.conflicts.length);
    }

    if (trace.risks.length > 2) {
      trace.confidence = Math.max(0.2, trace.confidence - 0.1);
    }

    trace.confidence = Math.round(trace.confidence * 100) / 100;
  }

  /* ── 6. Simulation Engine ─────────────────────────────── */
  async _runSimulationEngine(trace) {
    const bestHypothesis = trace.hypotheses[0];
    if (!bestHypothesis) return;

    const sim = {
      scenario: bestHypothesis.hypothesis,
      probability: bestHypothesis.probability,
      outcomes: [],
      recommendation: null,
    };

    if (bestHypothesis.hypothesis.includes('attention') || bestHypothesis.hypothesis.includes('suivi')) {
      sim.outcomes.push({ action: 'Envoyer un message de suivi', successProb: 0.7, risk: 'faible', description: 'Relance amicale' });
      sim.outcomes.push({ action: 'Ne pas intervenir', successProb: 0.3, risk: 'moyen', description: 'Risque de perte de contact' });
      sim.recommendation = sim.outcomes[0].action;
    }

    if (bestHypothesis.hypothesis.includes('insatisfaction')) {
      sim.outcomes.push({ action: 'Proposer une aide proactive', successProb: 0.6, risk: 'faible', description: 'Approche resolutive' });
      sim.outcomes.push({ action: 'Attendre que le contact s\'exprime', successProb: 0.4, risk: 'moyen', description: 'Approche passive' });
      sim.recommendation = sim.outcomes[0].action;
    }

    if (bestHypothesis.hypothesis.includes('fiable') || bestHypothesis.hypothesis.includes('solide')) {
      sim.outcomes.push({ action: 'Conferer des responsabilites ou taches', successProb: 0.85, risk: 'faible', description: 'Relation de confiance' });
      sim.recommendation = sim.outcomes[0].action;
    }

    if (sim.outcomes.length > 0) trace.setSimulation(sim);
  }

  /* ── 7. Explanation Engine ────────────────────────────── */
  _runExplanationEngine(trace) {
    const parts = [];
    parts.push(`Analyse pour: ${trace.goal}`);

    if (trace.facts.length > 0) {
      parts.push(`Facts: ${trace.facts.slice(0, 5).map(f => f.fact).join(', ')}`);
    }

    if (trace.inferences.length > 0) {
      parts.push(`Inferences: ${trace.inferences.slice(0, 3).map(i => i.inference).join(', ')}`);
    }

    if (trace.hypotheses.length > 0) {
      const h = trace.hypotheses[0];
      parts.push(`Hypothese principale: ${h.hypothesis} (${Math.round(h.probability * 100)}%)`);
      if (trace.hypotheses.length > 1) {
        parts.push(`Alternatives: ${trace.hypotheses.slice(1, 3).map(h => `${h.hypothesis}(${Math.round(h.probability * 100)}%)`).join(', ')}`);
      }
    }

    if (trace.risks.length > 0) {
      const topRisk = trace.risks[0];
      parts.push(`Risque principal: ${topRisk.description} (score: ${topRisk.score})`);
    }

    if (trace.conflicts.length > 0) {
      parts.push(`Conflit: ${trace.conflicts[0].description}`);
    }

    if (trace.simulation) {
      parts.push(`Simulation: ${trace.simulation.recommendation || 'aucune recommendation'} (confiance: ${Math.round(trace.simulation.probability * 100)}%)`);
    }

    parts.push(`Confiance globale: ${Math.round(trace.confidence * 100)}%`);
    trace.setExplanation(parts.join('\n'));
  }

  /* ── 8. Action selection ──────────────────────────────── */
  _selectAction(trace) {
    if (trace.simulation?.recommendation) {
      trace.setAction(trace.simulation.recommendation, trace.simulation.outcomes?.map(o => o.action).filter(a => a !== trace.simulation.recommendation) || []);
      return;
    }

    const bestHypothesis = trace.hypotheses[0];
    if (!bestHypothesis) {
      trace.setAction('Aucune action requise', []);
      return;
    }

    if (bestHypothesis.probability > 0.6) {
      if (bestHypothesis.hypothesis.includes('attention')) {
        trace.setAction('Creer un suivi', ['Surveiller', 'Attendre']);
      } else if (bestHypothesis.hypothesis.includes('insatisfaction')) {
        trace.setAction('Contacter proactivement', ['Attendre', 'Escalader']);
      } else if (bestHypothesis.hypothesis.includes('fiable')) {
        trace.setAction('Maintenir la relation', ['Conferer une tache', 'Remercier']);
      } else {
        trace.setAction('Aucune action specifique', []);
      }
    } else {
      trace.setAction('Surveiller et re-evaluer', ['Recueillir plus d\'informations']);
    }
  }

  /* ── Utilities ────────────────────────────────────────── */
  getTraceHistory(limit = 10) {
    return this.traceHistory.slice(-limit).map(t => t.toJSON());
  }

  getLastTrace() {
    return this.traceHistory.length > 0 ? this.traceHistory[this.traceHistory.length - 1].toJSON() : null;
  }

  addInferenceRule(rule) {
    this.inferenceRules.push(rule);
  }

  reset() {
    this.traceHistory = [];
  }
}

export const reasoner = new ReasoningEngine();
export default reasoner;
