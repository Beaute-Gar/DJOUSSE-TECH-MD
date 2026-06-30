import { createLogger } from '../core/logger.js';
import { bus, EVENTS } from './event-bus.js';
import { rawGet, rawRun, rawAll } from '../lib/database.js';
import { getAllPersons, resolvePerson } from './identity-engine.js';
import { getOrCreateTwin, getTwin } from './digital-twin.js';
import { getWorldSummary } from './world-model.js';
import { reasoner } from './reasoning-engine.js';
import { planner } from './planning-engine.js';
import { getPendingActions } from './automation-engine.js';

const log = createLogger('CFE');

/* ════════════════════════════════════════════════════════════
   Future Graph — arbre des futurs possibles
════════════════════════════════════════════════════════════ */

class FutureNode {
  constructor(data) {
    this.id = data.id || `future_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.label = data.label || 'Future possible';
    this.parentId = data.parentId || null;
    this.probability = data.probability || 0.5;
    this.hypotheses = data.hypotheses || [];
    this.risks = data.risks || [];
    this.resources = data.resources || {};
    this.triggerEvents = data.triggerEvents || [];
    this.signals = data.signals || [];
    this.metadata = data.metadata || {};
    this.createdAt = data.createdAt || Date.now();
  }

  toJSON() {
    return { id: this.id, label: this.label, parentId: this.parentId, probability: this.probability, hypotheses: this.hypotheses.length, risks: this.risks.length, triggerEvents: this.triggerEvents.length, createdAt: this.createdAt };
  }
}

class FutureGraph {
  constructor() {
    this.nodes = new Map();
    this._loaded = false;
  }

  _ensureLoaded() {
    if (!this._loaded) { this._loadAll(); this._loaded = true; }
  }

  addNode(data) {
    this._ensureLoaded();
    const node = new FutureNode(data);
    this.nodes.set(node.id, node);
    this._persist(node);
    return node;
  }

  getNode(id) {
    this._ensureLoaded();
    if (this.nodes.has(id)) return this.nodes.get(id);
    const row = rawGet('SELECT * FROM cognitive_futures WHERE id = ?', id);
    if (!row) return null;
    const n = this._rowToNode(row);
    this.nodes.set(n.id, n);
    return n;
  }

  getChildren(parentId) {
    this._ensureLoaded();
    return Array.from(this.nodes.values()).filter(n => n.parentId === parentId);
  }

  getPathToRoot(nodeId) {
    this._ensureLoaded();
    const path = [];
    let current = this.getNode(nodeId);
    while (current) {
      path.unshift(current);
      current = current.parentId ? this.getNode(current.parentId) : null;
    }
    return path;
  }

  getTree(nodeId = null) {
    this._ensureLoaded();
    const root = nodeId ? this.getNode(nodeId) : null;
    const build = (parent) => ({
      node: parent ? parent.toJSON() : null,
      children: Array.from(this.nodes.values())
        .filter(n => parent ? n.parentId === parent.id : !n.parentId)
        .map(c => build(c)),
    });
    return build(root);
  }

  prune(olderThan) {
    this._ensureLoaded();
    for (const [id, node] of this.nodes) {
      if (node.createdAt < olderThan) {
        this.nodes.delete(id);
        rawRun('DELETE FROM cognitive_futures WHERE id = ?', id);
      }
    }
  }

  _persist(node) {
    rawRun(`INSERT OR REPLACE INTO cognitive_futures
      (id, label, parent_id, probability, hypotheses, risks, resources, trigger_events, signals, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      node.id, node.label, node.parentId, node.probability,
      JSON.stringify(node.hypotheses), JSON.stringify(node.risks),
      JSON.stringify(node.resources), JSON.stringify(node.triggerEvents),
      JSON.stringify(node.signals), JSON.stringify(node.metadata), node.createdAt);
  }

  _loadAll() {
    const rows = rawAll('SELECT * FROM cognitive_futures ORDER BY created_at ASC');
    for (const row of rows) {
      const n = this._rowToNode(row);
      this.nodes.set(n.id, n);
    }
  }

  _rowToNode(row) {
    const parse = (s) => { try { return JSON.parse(s); } catch { return []; } };
    return new FutureNode({
      id: row.id, label: row.label, parentId: row.parent_id, probability: row.probability,
      hypotheses: parse(row.hypotheses), risks: parse(row.risks), resources: parse(row.resources),
      triggerEvents: parse(row.trigger_events), signals: parse(row.signals),
      metadata: parse(row.metadata), createdAt: row.created_at,
    });
  }
}

/* ════════════════════════════════════════════════════════════
   Decision Replay
════════════════════════════════════════════════════════════ */

class DecisionReplay {
  constructor() {
    this._cache = new Map();
  }

  record(decision) {
    const record = {
      id: decision.id || `decision_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      context: decision.context || '',
      scenarios: decision.scenarios || [],
      chosenId: decision.chosenId || null,
      reasons: decision.reasons || [],
      predictedOutcome: decision.predictedOutcome || null,
      actualOutcome: null,
      outcomeCollectedAt: null,
      accuracy: null,
      metadata: decision.metadata || {},
      createdAt: Date.now(),
    };
    rawRun(`INSERT INTO cognitive_decisions
      (id, context, scenarios, chosen_id, reasons, predicted_outcome, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      record.id, record.context, JSON.stringify(record.scenarios), record.chosenId,
      JSON.stringify(record.reasons), JSON.stringify(record.predictedOutcome),
      JSON.stringify(record.metadata), record.createdAt);
    this._cache.set(record.id, record);
    log.info(`[CFE] Decision enregistree: ${record.context.slice(0, 60)}`);
    return record;
  }

  collectOutcome(id, outcome) {
    const record = this.get(id);
    if (!record) return null;
    record.actualOutcome = outcome;
    record.outcomeCollectedAt = Date.now();
    if (record.predictedOutcome && outcome && record.predictedOutcome.status) {
      record.accuracy = outcome.status === record.predictedOutcome.status ? 1 : 0;
    }
    rawRun('UPDATE cognitive_decisions SET actual_outcome = ?, outcome_collected_at = ?, accuracy = ? WHERE id = ?',
      JSON.stringify(outcome), record.outcomeCollectedAt, record.accuracy, id);
    return record;
  }

  get(id) {
    if (this._cache.has(id)) return this._cache.get(id);
    const row = rawGet('SELECT * FROM cognitive_decisions WHERE id = ?', id);
    if (!row) return null;
    return this._rowToRecord(row);
  }

  getAll(limit = 20) {
    const rows = rawAll('SELECT * FROM cognitive_decisions ORDER BY created_at DESC LIMIT ?', limit);
    return rows.map(r => this._rowToRecord(r));
  }

  getStats() {
    const rows = rawAll('SELECT accuracy FROM cognitive_decisions WHERE accuracy IS NOT NULL');
    if (rows.length === 0) return { total: 0, avgAccuracy: null, count: 0 };
    const avg = rows.reduce((s, r) => s + r.accuracy, 0) / rows.length;
    return { total: rows.length, avgAccuracy: Math.round(avg * 100), correct: rows.filter(r => r.accuracy === 1).length };
  }

  getComparison(id) {
    const record = this.get(id);
    if (!record) return null;
    return {
      predicted: record.predictedOutcome,
      actual: record.actualOutcome,
      accuracy: record.accuracy,
      delta: record.accuracy === 1 ? 'Conforme aux previsions' : record.accuracy === 0 ? 'Ecarte des previsions' : 'En attente',
      scenarios: record.scenarios,
      chosen: record.scenarios.find(s => s.id === record.chosenId) || null,
      reasons: record.reasons,
    };
  }

  _rowToRecord(row) {
    const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };
    const r = {
      id: row.id, context: row.context, scenarios: parse(row.scenarios) || [],
      chosenId: row.chosen_id, reasons: parse(row.reasons) || [],
      predictedOutcome: parse(row.predicted_outcome),
      actualOutcome: parse(row.actual_outcome),
      outcomeCollectedAt: row.outcome_collected_at,
      accuracy: row.accuracy,
      metadata: parse(row.metadata) || {},
      createdAt: row.created_at,
    };
    this._cache.set(r.id, r);
    return r;
  }
}

/* ════════════════════════════════════════════════════════════
   COGNITIVE FORESIGHT ENGINE
════════════════════════════════════════════════════════════ */

export class CognitiveForesightEngine {
  constructor() {
    this.futureGraph = new FutureGraph();
    this.decisionReplay = new DecisionReplay();
    this._insightCache = [];
  }

  /* ── 1. Trend Analyzer ─────────────────────────────────── */
  async analyzeTrends(context = {}) {
    log.info('[CFE] Analyse des tendances...');
    const trends = [];
    const persons = await getAllPersons();
    const recent = (persons || []).filter(p => p.frequency > 0).sort((a, b) => b.frequency - a.frequency);
    const avgFreq = recent.length > 0 ? recent.reduce((s, p) => s + p.frequency, 0) / recent.length : 0;
    if (avgFreq > 0) {
      trends.push({
        type: 'activity',
        label: recent.length > 20 ? 'Activite elevee' : 'Activite moderee',
        value: avgFreq,
        direction: avgFreq > 0.5 ? 'stable' : 'decroissante',
        confidence: 0.7,
        details: `${recent.length} personnes actives, frequence moyenne ${avgFreq.toFixed(2)}`,
      });
    }
    const missions = planner.getAllMissions();
    const activeMissions = missions.filter(m => m.status === 'active');
    const overdueMissions = missions.filter(m => m.isOverdue);
    if (activeMissions.length > 0) {
      const avgProgress = activeMissions.reduce((s, m) => s + m.progress, 0) / activeMissions.length;
      trends.push({
        type: 'workload',
        label: activeMissions.length > 5 ? 'Charge projet elevee' : 'Charge projet normale',
        value: activeMissions.length,
        direction: overdueMissions.length > 0 ? 'en retard' : 'dans les temps',
        confidence: 0.75,
        details: `${activeMissions.length} missions actives, progression moyenne ${Math.round(avgProgress)}%, ${overdueMissions.length} en retard`,
      });
    }
    const pending = getPendingActions();
    trends.push({
      type: 'tasks_pending',
      label: pending.length > 10 ? 'Accumulation de taches' : 'Taches gerables',
      value: pending.length,
      direction: pending.length > 10 ? 'critique' : 'normal',
      confidence: 0.8,
      details: `${pending.length} actions en attente`,
    });
    this._storeInsight('trend', trends);
    return trends;
  }

  /* ── 2. Behavior Predictor ─────────────────────────────── */
  async predictBehavior(jid) {
    log.info(`[CFE] Prediction comportement: ${jid}`);
    try {
      const twin = await getOrCreateTwin(jid);
      if (!twin) return { jid, confidence: 0, prediction: 'donnees_insuffisantes' };
      const person = resolvePerson(jid);
      const prediction = {
        jid,
        responseProbability: twin.scores?.confidence ? twin.scores.confidence / 100 : 0.5,
        engagement: twin.scores?.activity || 50,
        bestTime: this._guessBestTime(person),
        consistency: twin.scores?.coherence ? twin.scores.coherence / 100 : 0.5,
        influence: twin.scores?.influence || 30,
        confidence: Math.min(0.9, 0.3 + (twin.interactionCount || 0) * 0.02),
        factors: [
          twin.interactionCount > 20 ? 'Historique riche' : 'Historique limite',
          twin.scores?.activity > 50 ? 'Personne active' : 'Personne moderee',
        ],
        limitations: twin.interactionCount < 5 ? ['Peu de donnees pour une prediction fiable'] : [],
      };
      this._storeInsight('behavior', { jid, prediction });
      return prediction;
    } catch {
      return { jid, confidence: 0, prediction: 'erreur_analyse', factors: ['Erreur lors de la prediction'] };
    }
  }

  _guessBestTime(person) {
    if (!person || !person.lastSeen) return { hour: 14, day: 'weekday' };
    const h = new Date(person.lastSeen).getHours();
    const periods = [[6, 12, 'matin'], [12, 18, 'apres-midi'], [18, 22, 'soir'], [22, 6, 'nuit']];
    for (const [start, end, label] of periods) {
      if (h >= start && h < end) return { hour: h, period: label, day: 'weekday' };
    }
    return { hour: 14, period: 'apres-midi', day: 'weekday' };
  }

  /* ── 3. Mission Predictor ──────────────────────────────── */
  async predictMission(missionId) {
    log.info(`[CFE] Prediction mission: ${missionId}`);
    const mission = planner.getMission(missionId);
    if (!mission) return null;
    const tasks = mission.tasks || [];
    const done = tasks.filter(t => t.status === 'completed').length;
    const blocked = tasks.filter(t => t.status === 'blocked').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const timeSpent = Date.now() - mission.createdAt;
    const dayMs = 86400000;
    const daysElapsed = timeSpent / dayMs;
    const completionRate = tasks.length > 0 ? done / tasks.length : 0;
    const dailyProgress = daysElapsed > 0 ? completionRate / daysElapsed : 0;
    const estDaysRemaining = dailyProgress > 0 ? ((1 - completionRate) / dailyProgress) : 30;
    const success = Math.max(0, Math.min(100, Math.round(
      (completionRate * 40) +
      (blocked === 0 ? 20 : Math.max(0, 20 - blocked * 5)) +
      (mission.isOverdue ? 0 : 20) +
      (mission.priority <= 2 ? 20 : 10)
    )));
    const prediction = {
      missionId: mission.title,
      successProbability: success,
      estimatedDaysRemaining: Math.round(estDaysRemaining),
      completedTasks: done,
      totalTasks: tasks.length,
      blockedTasks: blocked,
      inProgressTasks: inProgress,
      bottlenecks: blocked > 2 ? [`${blocked} taches bloquees`] : [],
      confidence: Math.min(0.85, 0.3 + (tasks.length > 5 ? 0.3 : 0) + (daysElapsed > 3 ? 0.15 : 0)),
      factors: [
        `${done}/${tasks.length} taches completes`,
        blocked > 0 ? `${blocked} blocages` : 'Aucun blocage',
        mission.isOverdue ? 'Echeance depassee' : 'Dans les temps',
      ],
    };
    this._storeInsight('mission_prediction', prediction);
    return prediction;
  }

  /* ── 4. Risk Predictor ─────────────────────────────────── */
  async predictRisks(missionId = null) {
    log.info('[CFE] Analyse des risques...');
    const risks = [];
    if (missionId) {
      const mission = planner.getMission(missionId);
      if (mission) {
        const blocked = mission.tasks.filter(t => t.status === 'blocked');
        if (blocked.length > 0) risks.push({ type: 'blockage', label: 'Taches bloquees', severity: blocked.length > 3 ? 'critical' : 'warning', items: blocked.map(t => t.title), confidence: 0.85 });
        const overdue = mission.tasks.filter(t => t.deadline && Date.now() > t.deadline && t.status !== 'completed');
        if (overdue.length > 0) risks.push({ type: 'overdue', label: 'Echeances depassees', severity: overdue.length > 3 ? 'critical' : 'warning', items: overdue.map(t => t.title), confidence: 0.8 });
        if (mission.timeline.deadline && Date.now() > mission.timeline.deadline - 3 * 86400000 && mission.progress < 80) {
          risks.push({ type: 'deadline', label: 'Echeance imminente non tenable', severity: 'critical', confidence: 0.75 });
        }
      }
    }
    const allMissions = planner.getAllMissions();
    const active = allMissions.filter(m => m.status === 'active');
    if (active.length > 5) risks.push({ type: 'overload', label: `Surcharge: ${active.length} missions simultanees`, severity: 'warning', confidence: 0.7 });
    const blockedMissions = allMissions.filter(m => m.status === 'blocked');
    if (blockedMissions.length > 0) risks.push({ type: 'blocked_mission', label: `${blockedMissions.length} mission(s) bloquee(s)`, severity: 'warning', confidence: 0.8 });
    const overdueMissions = allMissions.filter(m => m.isOverdue);
    if (overdueMissions.length > 0) risks.push({ type: 'overdue_mission', label: `${overdueMissions.length} mission(s) en retard`, severity: 'warning', confidence: 0.8 });
    const pending = getPendingActions();
    if (pending.length > 20) risks.push({ type: 'task_backlog', label: `${pending.length} actions en attente`, severity: 'warning', confidence: 0.75 });
    this._storeInsight('risks', risks);
    return risks;
  }

  /* ── 5. Resource Predictor ─────────────────────────────── */
  async predictResources(context = {}) {
    log.info('[CFE] Prevision des ressources...');
    const predictions = [];
    const missions = planner.getAllMissions();
    const active = missions.filter(m => m.status === 'active');
    const totalTasks = active.reduce((s, m) => s + m.tasks.length, 0);
    const incompleteTasks = active.reduce((s, m) => s + m.tasks.filter(t => t.status !== 'completed').length, 0);
    predictions.push({ resource: 'time', label: 'Temps necessaire', estimate: `${Math.round(incompleteTasks * 2.5)} jours` });
    const pending = getPendingActions();
    if (pending.length > 10) predictions.push({ resource: 'attention', label: 'Charge mentale', estimate: `${pending.length} actions necessitant une decision`, alert: 'Elevee' });
    if (active.length > 3) predictions.push({ resource: 'coordination', label: 'Coordination', estimate: `${active.length} missions a coordonner`, alert: active.length > 5 ? 'Elevee' : 'Moderee' });
    this._storeInsight('resources', predictions);
    return predictions;
  }

  /* ── 6. Scenario Generator ─────────────────────────────── */
  async generateScenarios(goal, options = {}) {
    log.info(`[CFE] Generation scenarios: "${goal.slice(0, 80)}"`);
    const count = options.count || 3;
    const scenarios = [];
    const strategies = [
      { name: 'Maximum quality', multiplier: 1.5, risk: 'Faible', speed: 'Lente', success: 0.95, label: 'Qualite maximale' },
      { name: 'Balanced', multiplier: 1.0, risk: 'Modere', speed: 'Normale', success: 0.88, label: 'Equilibre' },
      { name: 'Rapid delivery', multiplier: 0.6, risk: 'Eleve', speed: 'Rapide', success: 0.7, label: 'Livraison rapide' },
      { name: 'Conservative', multiplier: 2.0, risk: 'Tres faible', speed: 'Tres lente', success: 0.99, label: 'Conservative' },
      { name: 'Aggressive', multiplier: 0.4, risk: 'Tres eleve', speed: 'Tres rapide', success: 0.5, label: 'Agressive' },
    ];
    const selected = strategies.slice(0, Math.min(count, strategies.length));
    const baseDuration = options.baseDays || 30;
    const baseCost = options.baseBudget || 1000;
    for (const s of selected) {
      const duration = Math.round(baseDuration * s.multiplier);
      const cost = Math.round(baseCost * s.multiplier * 0.8);
      const scenario = {
        id: `scenario_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        label: s.label,
        strategy: s.name,
        successProbability: Math.round(s.success * 100),
        estimatedDuration: duration,
        estimatedCost: cost,
        risk: s.risk,
        speed: s.speed,
        hypotheses: [s.label, `Duree estimee: ${duration} jours`, `Budget: ${cost}`],
      };
      scenarios.push(scenario);
      const fgNode = this.futureGraph.addNode({
        label: s.label,
        probability: s.success,
        hypotheses: scenario.hypotheses,
        risks: [{ type: 'generic', label: s.risk, severity: s.risk === 'Eleve' ? 'critical' : s.risk === 'Modere' ? 'warning' : 'low' }],
        metadata: { goal, duration, cost, success: s.success },
      });
      scenario.futureNodeId = fgNode.id;
    }
    for (let i = 1; i < scenarios.length; i++) {
      scenarios[i].parentId = scenarios[0].id;
    }
    this._storeInsight('scenarios', { goal, scenarios: scenarios.map(s => ({ id: s.id, label: s.label, probability: s.successProbability })) });
    return scenarios;
  }

  /* ── 7. Impact Simulator ───────────────────────────────── */
  async simulate(action, context = {}) {
    log.info(`[CFE] Simulation impact: ${action.type || 'inconnue'}`);
    const simulation = {
      action: action.type || action.label || 'Action',
      immediateEffects: [],
      cascadeEffects: [],
      risks: [],
      opportunities: [],
      confidence: 0.7,
    };
    if (action.type === 'delete_group' || action.type?.includes('suppression')) {
      simulation.immediateEffects.push('Perte de l\'historique du groupe');
      simulation.cascadeEffects.push('Arret des echanges pour les membres');
      simulation.cascadeEffects.push('Suppression des automatisations liees');
      simulation.risks.push({ label: 'Perte de donnees definitive', severity: 'critical' });
      simulation.opportunities.push({ label: 'Reduction du bruit informationnel' });
      simulation.confidence = 0.9;
    }
    if (action.type === 'add_admin' || action.type?.includes('admin')) {
      simulation.immediateEffects.push('Nouvel administrateur avec droits eleves');
      simulation.cascadeEffects.push('Possibilite de modifier les parametres du groupe');
      simulation.risks.push({ label: 'Risque d\'abus de pouvoir', severity: 'warning' });
      simulation.opportunities.push({ label: 'Delegation de la moderation' });
    }
    if (action.type === 'change_automation' || action.type?.includes('automation')) {
      simulation.immediateEffects.push('Modification du comportement automatique');
      simulation.cascadeEffects.push('Impact sur les utilisateurs concernes');
      simulation.risks.push({ label: 'Regression non prevue', severity: 'warning' });
    }
    if (action.type === 'postpone_deadline' || action.type?.includes('report')) {
      simulation.immediateEffects.push('Report de l\'echeance');
      simulation.cascadeEffects.push('Decalage des taches dependantes');
      simulation.opportunities.push({ label: 'Marge pour ameliorer la qualite' });
      simulation.risks.push({ label: 'Perte de motivation', severity: 'low' });
    }
    if (simulation.immediateEffects.length === 0) {
      simulation.immediateEffects.push('Effet direct non simule (type inconnu)');
      simulation.confidence = 0.3;
    }
    this._storeInsight('simulation', { action: action.type, effects: simulation.immediateEffects.concat(simulation.cascadeEffects) });
    return simulation;
  }

  /* ── 8. Opportunity Finder ─────────────────────────────── */
  async findOpportunities() {
    log.info('[CFE] Recherche d\'opportunites...');
    const opportunities = [];
    const missions = planner.getAllMissions();
    const active = missions.filter(m => m.status === 'active');
    if (active.length > 3) {
      const synergy = active.filter(m => m.tags?.length > 0);
      const tagMap = {};
      for (const m of synergy) {
        for (const t of m.tags) {
          if (!tagMap[t]) tagMap[t] = [];
          tagMap[t].push(m.title);
        }
      }
      for (const [tag, tagged] of Object.entries(tagMap)) {
        if (tagged.length >= 2) {
          opportunities.push({ type: 'synergy', label: `Synergie detectee: ${tag}`, value: `${tagged.length} missions concernees`, gain: 'Mutualisation des ressources', confidence: 0.7 });
        }
      }
    }
    const pending = getPendingActions();
    const recurring = pending.filter(a => a.title && pending.filter(o => o.title === a.title).length > 1);
    if (recurring.length > 0) {
      opportunities.push({ type: 'automation', label: 'Tache repetee detectee', value: recurring[0].title, gain: 'Automatiser cette action', confidence: 0.8 });
    }
    const persons = await getAllPersons() || [];
    const highValue = persons.filter(p => p.frequency > 0 && p.trust_level >= 4);
    if (highValue.length > 0) {
      opportunities.push({ type: 'engagement', label: 'Ambassadeurs potentiels', value: `${highValue.length} contacts de confiance`, gain: 'Solliciter pour du bouche-a-oreille', confidence: 0.6 });
    }
    this._storeInsight('opportunities', opportunities);
    return opportunities;
  }

  /* ── 9. Anomaly Detector ───────────────────────────────── */
  async detectAnomalies() {
    log.info('[CFE] Detection d\'anomalies...');
    const anomalies = [];
    const persons = await getAllPersons() || [];
    for (const p of persons) {
      if (!p.lastSeen) continue;
      const daysSinceLast = (Date.now() - new Date(p.lastSeen).getTime()) / 86400000;
      if (p.frequency > 0.5 && daysSinceLast > 7) {
        anomalies.push({ type: 'disappearance', label: `Utilisateur inactif: ${p.name || p.jid}`, detail: `Actif avant, plus de message depuis ${Math.round(daysSinceLast)} jours`, severity: 'warning', confidence: 0.8 });
      }
    }
    const missions = planner.getAllMissions();
    for (const m of missions) {
      if (m.status === 'active' && !m.isOverdue) {
        const done = m.tasks.filter(t => t.status === 'completed').length;
        if (m.tasks.length > 5 && done === 0 && (Date.now() - m.createdAt) > 7 * 86400000) {
          anomalies.push({ type: 'stalled_project', label: `Projet sans progression: ${m.title}`, detail: 'Aucune tache terminee en 7+ jours', severity: 'warning', confidence: 0.75 });
        }
      }
    }
    const pending = getPendingActions();
    const oldPending = pending.filter(a => a.createdAt && (Date.now() - a.createdAt) > 14 * 86400000);
    for (const a of oldPending.slice(0, 5)) {
      anomalies.push({ type: 'aged_task', label: `Tache abandonnee: ${a.title}`, detail: 'En attente depuis +14 jours', severity: 'low', confidence: 0.7 });
    }
    this._storeInsight('anomalies', anomalies);
    return anomalies;
  }

  /* ── 10. Confidence Analyzer ───────────────────────────── */
  analyzeConfidence(predictions) {
    if (!predictions || predictions.length === 0) return { score: 0, factors: ['Aucune prediction'] };
    const scores = predictions.map(p => p.confidence || 0).filter(s => s > 0);
    if (scores.length === 0) return { score: 0, factors: ['Aucun score de confiance disponible'] };
    const avg = scores.reduce((s, c) => s + c, 0) / scores.length;
    const factors = [];
    if (avg > 0.8) factors.push('Haute confiance globale');
    else if (avg > 0.5) factors.push('Confiance moderee');
    else factors.push('Faible confiance, verifier les sources');
    const lowScores = predictions.filter(p => (p.confidence || 0) < 0.4);
    if (lowScores.length > 0) factors.push(`${lowScores.length} prediction(s) avec faible confiance`);
    return { score: Math.round(avg * 100), averageConfidence: avg, factors, limitations: lowScores.length > 0 ? ['Certaines predictions manquent de donnees'] : [] };
  }

  /* ── Orchestrateur de prédiction complète ──────────────── */
  async foresightComplete(goal = null, missionId = null, options = {}) {
    log.info('[CFE] Foresight complet demande');
    const start = Date.now();
    const result = {
      goal,
      timestamp: start,
      trends: await this.analyzeTrends(),
      risks: await this.predictRisks(missionId),
      resources: await this.predictResources(),
      opportunities: await this.findOpportunities(),
      anomalies: await this.detectAnomalies(),
      scenarios: goal ? await this.generateScenarios(goal, options) : [],
      missionPrediction: missionId ? await this.predictMission(missionId) : null,
      confidence: null,
      duration: 0,
    };
    const allPreds = [result.trends, result.risks, result.opportunities, result.anomalies].flat().filter(Boolean);
    result.confidence = this.analyzeConfidence(allPreds);
    result.duration = Date.now() - start;
    if (result.scenarios.length > 0) {
      const record = this.decisionReplay.record({
        context: goal || missionId || 'Analyse complete',
        scenarios: result.scenarios.map(s => ({ id: s.id, label: s.label, probability: s.successProbability })),
        chosenId: result.scenarios[0]?.id || null,
        reasons: [`Scenario ${result.scenarios[0]?.label || 'par defaut'} recommande automatiquement`],
        predictedOutcome: { status: 'success', confidence: result.scenarios[0]?.successProbability || 50 },
      });
      result.decisionId = record.id;
    }
    bus.emit('foresight:complete', { goal, missionId, duration: result.duration });
    return result;
  }

  /* ── Decision Replay public API ────────────────────────── */
  recordDecision(context, scenarios, chosenId, reasons) {
    return this.decisionReplay.record({ context, scenarios, chosenId, reasons });
  }

  collectOutcome(decisionId, outcome) {
    return this.decisionReplay.collectOutcome(decisionId, outcome);
  }

  getDecision(decisionId) {
    return this.decisionReplay.get(decisionId);
  }

  getAllDecisions(limit = 20) {
    return this.decisionReplay.getAll(limit);
  }

  getDecisionStats() {
    return this.decisionReplay.getStats();
  }

  comparePredictionVsReality(decisionId) {
    return this.decisionReplay.getComparison(decisionId);
  }

  /* ── Store insight ──────────────────────────────────────── */
  _storeInsight(type, data) {
    const insight = { type, data, createdAt: Date.now() };
    this._insightCache.push(insight);
    if (this._insightCache.length > 500) this._insightCache.shift();
  }

  getInsights(type = null, limit = 50) {
    const filtered = type ? this._insightCache.filter(i => i.type === type) : this._insightCache;
    return filtered.slice(-limit);
  }

  getStats() {
    const decisions = this.decisionReplay.getStats();
    return {
      futureNodes: this.futureGraph.nodes.size,
      decisions: decisions,
      insightsCached: this._insightCache.length,
    };
  }
}

export const foresight = new CognitiveForesightEngine();
export { FutureGraph, FutureNode, DecisionReplay };
export default foresight;

/* ── Auto-subscribe aux événements ───────────────────────── */
bus.on(EVENTS.MISSION_UPDATED, async (data) => {
  if (data.mission?.id) {
    foresight.predictMission(data.mission.id).catch(() => {});
  }
});

bus.on('cognitive:ready', async () => {
  foresight.analyzeTrends().catch(() => {});
});
