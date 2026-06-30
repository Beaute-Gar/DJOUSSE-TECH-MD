import { createLogger } from '../core/logger.js';
import { bus, EVENTS } from './event-bus.js';
import { addNode, getNode, addEdge, getRelated, NODE_TYPES, REL_TYPES } from './knowledge-graph.js';
import { getPerson } from './identity-engine.js';
import { createAction, completeAction, getPendingActions } from './automation-engine.js';
import { reasoner } from './reasoning-engine.js';
import { getWorldSummary } from './world-model.js';
import { rawGet, rawRun, rawAll } from '../lib/database.js';

const log = createLogger('PLAN');

/* ════════════════════════════════════════════════════════════
   MISSION
════════════════════════════════════════════════════════════ */

export class Mission {
  constructor(data) {
    this.id = data.id || `mission_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.title = data.title || 'Mission sans titre';
    this.description = data.description || '';
    this.owner = data.owner || null;
    this.status = data.status || 'draft';
    this.priority = data.priority || 3;
    this.tags = data.tags || [];
    this.metadata = data.metadata || {};
    this.createdAt = data.createdAt || Date.now();
    this.updatedAt = data.updatedAt || Date.now();
    this.completedAt = data.completedAt || null;
    this.objectives = data.objectives || [];
    this.tasks = data.tasks || [];
    this.dependencies = data.dependencies || [];
    this.resources = data.resources || [];
    this.timeline = data.timeline || {};
    this.participants = data.participants || [];
    this.snapshots = data.snapshots || [];
  }

  get progress() {
    if (this.tasks.length === 0) return 0;
    const done = this.tasks.filter(t => t.status === 'completed').length;
    return Math.round((done / this.tasks.length) * 100);
  }

  get isOverdue() {
    if (!this.timeline.deadline) return false;
    return this.status !== 'completed' && Date.now() > this.timeline.deadline;
  }

  get statusLabel() {
    const labels = { draft: 'Brouillon', active: 'Active', paused: 'En pause', completed: 'Terminee', abandoned: 'Abandonnee', blocked: 'Bloquee' };
    return labels[this.status] || this.status;
  }

  toJSON() {
    return { id: this.id, title: this.title, description: this.description, owner: this.owner, status: this.status, priority: this.priority, tags: this.tags, progress: this.progress, isOverdue: this.isOverdue, statusLabel: this.statusLabel, objectives: this.objectives.length, tasks: this.tasks.length, dependencies: this.dependencies.length, resources: this.resources.length, participants: this.participants.length, createdAt: this.createdAt, updatedAt: this.updatedAt, completedAt: this.completedAt, timeline: this.timeline };
  }
}

/* ════════════════════════════════════════════════════════════
   TIME MACHINE — snapshots d'état
════════════════════════════════════════════════════════════ */

class TimeMachine {
  constructor(missionId) {
    this.missionId = missionId;
  }

  snapshot(mission, reason = 'auto') {
    const snap = {
      id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      reason,
      state: {
        status: mission.status,
        objectives: JSON.parse(JSON.stringify(mission.objectives)),
        tasks: JSON.parse(JSON.stringify(mission.tasks)),
        dependencies: JSON.parse(JSON.stringify(mission.dependencies)),
        timeline: JSON.parse(JSON.stringify(mission.timeline)),
        progress: mission.progress,
      },
    };
    mission.snapshots.push(snap);
    rawRun('INSERT INTO cognitive_history (id, mission_id, reason, state, created_at) VALUES (?, ?, ?, ?, ?)',
      snap.id, this.missionId, reason, JSON.stringify(snap.state), snap.timestamp);
    return snap;
  }

  getHistory(mission, limit = 20) {
    return (mission.snapshots || []).slice(-limit);
  }

  getStateAt(mission, timestamp) {
    const relevant = (mission.snapshots || []).filter(s => s.timestamp <= timestamp);
    if (relevant.length === 0) return null;
    return relevant[relevant.length - 1].state;
  }

  getDiff(mission, snapId1, snapId2) {
    const s1 = (mission.snapshots || []).find(s => s.id === snapId1)?.state;
    const s2 = (mission.snapshots || []).find(s => s.id === snapId2)?.state;
    if (!s1 || !s2) return null;
    const diff = {};
    for (const key of ['status', 'progress']) {
      if (s1[key] !== s2[key]) diff[key] = { from: s1[key], to: s2[key] };
    }
    if (s1.tasks.length !== s2.tasks.length) diff.tasksCount = { from: s1.tasks.length, to: s2.tasks.length };
    return diff;
  }

  explainChange(mission, snapId) {
    const snap = (mission.snapshots || []).find(s => s.id === snapId);
    if (!snap) return 'Instantané introuvable';
    const prev = this.getStateAt(mission, snap.timestamp - 1);
    if (!prev) return `État initial: ${snap.state.status} (${snap.reason})`;
    const changes = [];
    if (prev.status !== snap.state.status) changes.push(`Statut: ${prev.status} → ${snap.state.status}`);
    if (prev.progress !== snap.state.progress) changes.push(`Progression: ${prev.progress}% → ${snap.state.progress}%`);
    if (prev.tasks.length !== snap.state.tasks.length) changes.push(`Tâches: ${prev.tasks.length} → ${snap.state.tasks.length}`);
    return changes.length > 0 ? changes.join(', ') + ` (${snap.reason})` : `Aucun changement significatif (${snap.reason})`;
  }
}

/* ════════════════════════════════════════════════════════════
   PLANNING ENGINE
════════════════════════════════════════════════════════════ */

export class PlanningEngine {
  constructor() {
    this.missions = new Map();
    this.planTemplates = this._defaultTemplates();
  }

  /* ── Mission CRUD ──────────────────────────────────────── */
  createMission(data) {
    const mission = new Mission(data);
    const timeMachine = new TimeMachine(mission.id);
    this.missions.set(mission.id, { mission, timeMachine });
    this._persistMission(mission);
    timeMachine.snapshot(mission, 'creation');
    bus.emit('mission:created', { mission: mission.toJSON() });
    log.info(`[Plan] Mission creee: ${mission.title}`);
    return mission;
  }

  getMission(id) {
    const entry = this.missions.get(id);
    if (entry) return entry.mission;
    const row = rawGet('SELECT * FROM cognitive_missions WHERE id = ?', id);
    if (!row) return null;
    const mission = this._rowToMission(row);
    this.missions.set(id, { mission, timeMachine: new TimeMachine(id) });
    return mission;
  }

  getAllMissions(status = null) {
    const sql = status ? 'SELECT * FROM cognitive_missions WHERE status = ? ORDER BY priority ASC, created_at DESC' : 'SELECT * FROM cognitive_missions ORDER BY priority ASC, created_at DESC';
    const params = status ? [status] : [];
    const rows = rawAll(sql, ...params);
    for (const row of rows) {
      const id = row.id;
      if (!this.missions.has(id)) {
        const mission = this._rowToMission(row);
        this.missions.set(id, { mission, timeMachine: new TimeMachine(id) });
      }
    }
    return rows.map(r => this.missions.get(r.id).mission);
  }

  updateMission(id, updates) {
    const mission = this.getMission(id);
    if (!mission) return null;
    const timeMachine = this.missions.get(id).timeMachine;
    const prevStatus = mission.status;
    const allowed = ['title', 'description', 'status', 'priority', 'tags', 'metadata', 'timeline'];
    for (const key of allowed) {
      if (updates[key] !== undefined) mission[key] = updates[key];
    }
    mission.updatedAt = Date.now();
    if (updates.status === 'completed') mission.completedAt = Date.now();
    this._persistMission(mission);
    const reason = prevStatus !== mission.status ? `statut: ${prevStatus} → ${mission.status}` : 'mise_a_jour';
    timeMachine.snapshot(mission, reason);
    bus.emit('mission:updated', { mission: mission.toJSON() });
    return mission;
  }

  deleteMission(id) {
    rawRun('DELETE FROM cognitive_missions WHERE id = ?', id);
    rawRun('DELETE FROM cognitive_history WHERE mission_id = ?', id);
    this.missions.delete(id);
    bus.emit('mission:deleted', { id });
  }

  /* ── 1. Goal Planner ───────────────────────────────────── */
  async planFromGoal(goalText, owner = null) {
    log.info(`[Plan] Planification depuis: "${goalText.slice(0, 100)}"`);
    const mission = this.createMission({ title: goalText.slice(0, 200), description: goalText, owner, status: 'draft' });
    const objectives = this._decomposeGoal(goalText);
    for (const obj of objectives) mission.objectives.push(obj);

    for (const obj of mission.objectives) {
      const tasks = this._objectiveToTasks(obj);
      for (const task of tasks) mission.tasks.push(task);
    }

    mission.dependencies = this._buildDependencies(mission.tasks);
    mission.timeline = this._buildTimeline(mission.tasks, mission.dependencies);
    mission.resources = this._identifyResources(mission);
    mission.status = 'active';
    this._persistMission(mission);
    this.missions.get(mission.id).timeMachine.snapshot(mission, 'planification_auto');
    bus.emit('mission:planned', { mission: mission.toJSON() });
    return mission;
  }

  _decomposeGoal(goalText) {
    const patterns = [
      { regex: /(?:lancer|creer|developper|build|start)\s+(.+)/i, type: 'creation' },
      { regex: /(?:ameliorer|optimiser|perfectionner|improve)\s+(.+)/i, type: 'improvement' },
      { regex: /(?:organiser|planifier|preparer|plan)\s+(.+)/i, type: 'organization' },
      { regex: /(?:vendre|commercialiser|marketer|sell|market)\s+(.+)/i, type: 'commercial' },
    ];
    let type = 'general';
    for (const { regex, type: t } of patterns) {
      if (regex.test(goalText)) { type = t; break; }
    }
    const defaults = {
      creation: [
        { title: 'Phase de conception', description: 'Definir les besoins et l architecture', status: 'pending', order: 1 },
        { title: 'Phase de realisation', description: 'Construire le produit ou service', status: 'pending', order: 2 },
        { title: 'Phase de test et validation', description: 'Verifier la qualite et corriger', status: 'pending', order: 3 },
        { title: 'Phase de lancement', description: 'Mettre en production et communiquer', status: 'pending', order: 4 },
        { title: 'Phase de suivi', description: 'Analyser les retours et iterer', status: 'pending', order: 5 },
      ],
      improvement: [
        { title: 'Audit et diagnostic', description: 'Evaluer l existant', status: 'pending', order: 1 },
        { title: 'Definition des axes d amelioration', description: 'Prioriser les actions', status: 'pending', order: 2 },
        { title: 'Mise en oeuvre', description: 'Executer les ameliorations', status: 'pending', order: 3 },
        { title: 'Evaluation', description: 'Mesurer l impact', status: 'pending', order: 4 },
      ],
      organization: [
        { title: 'Definition du perimetre', description: 'Clarifier les objectifs et contraintes', status: 'pending', order: 1 },
        { title: 'Planification detaillee', description: 'Calendrier et ressources', status: 'pending', order: 2 },
        { title: 'Execution', description: 'Mettre en oeuvre le plan', status: 'pending', order: 3 },
        { title: 'Cloture et bilan', description: 'Documenter et archiver', status: 'pending', order: 4 },
      ],
      commercial: [
        { title: 'Etude de marche', description: 'Analyser la cible et la concurrence', status: 'pending', order: 1 },
        { title: 'Strategie commerciale', description: 'Definir les canaux et le pricing', status: 'pending', order: 2 },
        { title: 'Execution commerciale', description: 'Lancer les actions de vente', status: 'pending', order: 3 },
        { title: 'Suivi et optimisation', description: 'Ajuster la strategie selon les resultats', status: 'pending', order: 4 },
      ],
      general: [
        { title: 'Analyse des besoins', description: 'Comprendre le contexte et les attentes', status: 'pending', order: 1 },
        { title: 'Planification', description: 'Structurer les etapes et les ressources', status: 'pending', order: 2 },
        { title: 'Execution', description: 'Realiser les taches planifiees', status: 'pending', order: 3 },
        { title: 'Validation et livraison', description: 'Verifier et finaliser', status: 'pending', order: 4 },
      ],
    };
    return (defaults[type] || defaults.general).map(o => ({ ...o, id: `obj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` }));
  }

  /* ── 2. Task Planner ───────────────────────────────────── */
  _objectiveToTasks(objective) {
    const taskTemplates = {
      'conception': [
        { title: 'Rediger le cahier des charges', effort: '3j' },
        { title: 'Valider les specifications', effort: '1j' },
        { title: 'Concevoir l architecture', effort: '5j' },
      ],
      'realisation': [
        { title: 'Developper les composants principaux', effort: '10j' },
        { title: 'Integrer les solutions', effort: '5j' },
      ],
      'test': [
        { title: 'Executer les tests fonctionnels', effort: '3j' },
        { title: 'Corriger les anomalies', effort: '4j' },
        { title: 'Validation finale', effort: '2j' },
      ],
      'lancement': [
        { title: 'Preparer la communication', effort: '3j' },
        { title: 'Deployer en production', effort: '2j' },
        { title: 'Annoncer le lancement', effort: '1j' },
      ],
    };
    const name = objective.title.toLowerCase();
    let tasks = [];
    for (const [key, templates] of Object.entries(taskTemplates)) {
      if (name.includes(key)) {
        tasks = templates.map(t => ({
          id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          objectiveId: objective.id,
          title: t.title,
          effort: t.effort,
          status: 'pending',
          assignedTo: null,
          priority: 3,
          dependsOn: [],
          createdAt: Date.now(),
        }));
        break;
      }
    }
    if (tasks.length === 0) {
      tasks = [{
        id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        objectiveId: objective.id,
        title: objective.title,
        effort: '5j',
        status: 'pending',
        assignedTo: null,
        priority: 3,
        dependsOn: [],
        createdAt: Date.now(),
      }];
    }
    return tasks;
  }

  /* ── 3. Dependency Planner ─────────────────────────────── */
  _buildDependencies(tasks) {
    const deps = [];
    const byObjective = {};
    for (const t of tasks) {
      if (!byObjective[t.objectiveId]) byObjective[t.objectiveId] = [];
      byObjective[t.objectiveId].push(t);
    }
    const objOrder = Object.keys(byObjective);
    for (let i = 0; i < objOrder.length; i++) {
      const currentTasks = byObjective[objOrder[i]];
      if (i > 0) {
        const prevTasks = byObjective[objOrder[i - 1]];
        for (const ct of currentTasks) {
          for (const pt of prevTasks) {
            deps.push({ from: pt.id, to: ct.id, type: 'objective_dependency' });
            ct.dependsOn.push(pt.id);
          }
        }
      }
      if (currentTasks.length > 1) {
        for (let j = 1; j < currentTasks.length; j++) {
          deps.push({ from: currentTasks[j - 1].id, to: currentTasks[j].id, type: 'sequential' });
          currentTasks[j].dependsOn.push(currentTasks[j - 1].id);
        }
      }
    }
    return deps;
  }

  /* ── 4. Calendar Planner ───────────────────────────────── */
  _buildTimeline(tasks, dependencies) {
    const startDate = Date.now();
    const dayMs = 86400000;
    const scheduled = {};
    const getEffortDays = (effort) => {
      const m = (effort || '1j').match(/(\d+)([jhds])/);
      if (!m) return 1;
      const n = parseInt(m[1]);
      if (m[2] === 'j') return n;
      if (m[2] === 'h') return Math.ceil(n / 8);
      if (m[2] === 's') return n * 5;
      return 1;
    };
    const ready = tasks.filter(t => t.dependsOn.length === 0);
    const visited = new Set();
    let cursor = startDate;
    while (ready.length > 0 && visited.size < tasks.length) {
      const task = ready.shift();
      if (visited.has(task.id)) continue;
      visited.add(task.id);
      const effortDays = getEffortDays(task.effort);
      scheduled[task.id] = { start: cursor, end: cursor + effortDays * dayMs, effortDays };
      cursor += effortDays * dayMs;
      for (const t of tasks) {
        if (visited.has(t.id)) continue;
        if (t.dependsOn.every(d => visited.has(d))) ready.push(t);
      }
    }
    const allDates = Object.values(scheduled);
    return {
      startDate,
      deadline: allDates.length > 0 ? Math.max(...allDates.map(d => d.end)) : startDate + 30 * dayMs,
      estimatedDuration: allDates.length > 0 ? Math.round((Math.max(...allDates.map(d => d.end)) - startDate) / dayMs) : 30,
      scheduled,
    };
  }

  /* ── 5. Resource Planner ────────────────────────────────── */
  _identifyResources(mission) {
    return {
      human: [],
      budget: null,
      tools: [],
      documents: [],
      skills: [],
    };
  }

  /* ── 6-10: Execution, Adaptive, Collaboration, Monitoring, Recovery ── */
  async executeTask(missionId, taskId, update) {
    const mission = this.getMission(missionId);
    if (!mission) return null;
    const task = mission.tasks.find(t => t.id === taskId);
    if (!task) return null;
    Object.assign(task, update);
    task.updatedAt = Date.now();
    if (update.status === 'completed') task.completedAt = Date.now();
    this._persistMission(mission);
    this.missions.get(missionId).timeMachine.snapshot(mission, `tache: ${task.status}`);
    bus.emit('mission:task_updated', { missionId, taskId, status: task.status });
    if (update.status === 'completed') {
      createAction({ type: 'task', jid: mission.owner, title: `Tache terminee: ${task.title}`, priority: 2, metadata: { missionId, taskId } });
    }
    return mission;
  }

  async adaptPlan(missionId, reason = 'replanification') {
    const mission = this.getMission(missionId);
    if (!mission) return null;
    const tm = this.missions.get(missionId).timeMachine;
    tm.snapshot(mission, `avant_adaptation: ${reason}`);
    const pending = mission.tasks.filter(t => t.status === 'pending' || t.status === 'blocked');
    const completed = mission.tasks.filter(t => t.status === 'completed');
    if (pending.length === 0) return mission;
    const remainingDeps = this._buildDependencies(pending);
    mission.dependencies = mission.dependencies.filter(d => pending.some(t => t.id === d.from || t.id === d.to));
    mission.dependencies.push(...remainingDeps);
    const remainingTimeline = this._buildTimeline(pending, remainingDeps);
    mission.timeline.scheduled = { ...mission.timeline.scheduled, ...remainingTimeline.scheduled };
    if (remainingTimeline.deadline > mission.timeline.deadline) {
      mission.timeline.deadline = remainingTimeline.deadline;
    }
    this._persistMission(mission);
    tm.snapshot(mission, `apres_adaptation: ${reason}`);
    bus.emit('mission:adapted', { missionId, reason });
    return mission;
  }

  async recoverMission(missionId) {
    const mission = this.getMission(missionId);
    if (!mission) return null;
    const tm = this.missions.get(missionId).timeMachine;
    const blocked = mission.tasks.filter(t => t.status === 'blocked');
    const overdue = mission.tasks.filter(t => t.status === 'pending' && t.deadline && Date.now() > t.deadline);
    const scenarios = [];
    if (blocked.length > 0) {
      scenarios.push({
        name: 'Degager les blocages',
        actions: blocked.map(t => ({ task: t.title, action: 'Reaffecter ou decomposer' })),
        confidence: 0.7,
      });
    }
    if (overdue.length > 0) {
      scenarios.push({
        name: 'Reprioriser les echances',
        actions: [`Reporter ${overdue.length} taches`, 'Reduire le perimetre'],
        confidence: 0.6,
      });
    }
    scenarios.push({
      name: 'Reduire le perimetre',
      actions: ['Supprimer les taches non critiques', 'Conserver le minimum viable'],
      confidence: 0.5,
    });
    return scenarios;
  }

  async assignTask(missionId, taskId, assignee) {
    const mission = this.getMission(missionId);
    if (!mission) return null;
    const task = mission.tasks.find(t => t.id === taskId);
    if (!task) return null;
    task.assignedTo = assignee;
    if (!mission.participants.includes(assignee)) mission.participants.push(assignee);
    this._persistMission(mission);
    return mission;
  }

  getMissionTimeline(missionId) {
    const mission = this.getMission(missionId);
    if (!mission) return null;
    const tm = this.missions.get(missionId).timeMachine;
    return {
      current: mission.timeline,
      history: tm.getHistory(mission, 10),
      progress: mission.progress,
      overdue: mission.isOverdue,
    };
  }

  explainState(missionId, snapshotId = null) {
    const mission = this.getMission(missionId);
    if (!mission) return 'Mission introuvable';
    const tm = this.missions.get(missionId).timeMachine;
    if (snapshotId) return tm.explainChange(mission, snapshotId);
    const parts = [];
    parts.push(`Mission: ${mission.title}`);
    parts.push(`Statut: ${mission.statusLabel}`);
    parts.push(`Progression: ${mission.progress}% (${mission.tasks.filter(t => t.status === 'completed').length}/${mission.tasks.length} taches)`);
    const overdue = mission.tasks.filter(t => t.status === 'pending' && t.deadline && Date.now() > t.deadline);
    if (overdue.length > 0) parts.push(`Taches en retard: ${overdue.length}`);
    const blocked = mission.tasks.filter(t => t.status === 'blocked');
    if (blocked.length > 0) parts.push(`Taches bloquees: ${blocked.length}`);
    return parts.join('\n');
  }

  getStats() {
    const all = this.getAllMissions();
    return {
      total: all.length,
      active: all.filter(m => m.status === 'active').length,
      completed: all.filter(m => m.status === 'completed').length,
      blocked: all.filter(m => m.status === 'blocked').length,
      overdue: all.filter(m => m.isOverdue).length,
      avgProgress: all.length > 0 ? Math.round(all.reduce((s, m) => s + m.progress, 0) / all.length) : 0,
      totalTasks: all.reduce((s, m) => s + m.tasks.length, 0),
    };
  }

  /* ── Persistence ────────────────────────────────────────── */
  _persistMission(mission) {
    const data = {
      id: mission.id, title: mission.title, description: mission.description,
      owner: mission.owner, status: mission.status, priority: mission.priority,
      tags: JSON.stringify(mission.tags), metadata: JSON.stringify(mission.metadata),
      objectives: JSON.stringify(mission.objectives), tasks: JSON.stringify(mission.tasks),
      dependencies: JSON.stringify(mission.dependencies), resources: JSON.stringify(mission.resources),
      timeline: JSON.stringify(mission.timeline), participants: JSON.stringify(mission.participants),
      progress: mission.progress, created_at: mission.createdAt, updated_at: Date.now(),
      completed_at: mission.completedAt,
    };
    rawRun(`INSERT OR REPLACE INTO cognitive_missions
      (id, title, description, owner, status, priority, tags, metadata, objectives, tasks, dependencies, resources, timeline, participants, progress, created_at, updated_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      data.id, data.title, data.description, data.owner, data.status, data.priority,
      data.tags, data.metadata, data.objectives, data.tasks, data.dependencies, data.resources,
      data.timeline, data.participants, data.progress, data.created_at, data.updated_at, data.completed_at);
  }

  _rowToMission(row) {
    return new Mission({
      id: row.id, title: row.title, description: row.description, owner: row.owner,
      status: row.status, priority: row.priority, tags: tryParse(row.tags, []),
      metadata: tryParse(row.metadata, {}), objectives: tryParse(row.objectives, []),
      tasks: tryParse(row.tasks, []), dependencies: tryParse(row.dependencies, []),
      resources: tryParse(row.resources, []), timeline: tryParse(row.timeline, {}),
      participants: tryParse(row.participants, []),
      createdAt: row.created_at, updatedAt: row.updated_at, completedAt: row.completed_at,
    });
  }

  _defaultTemplates() {
    return {
      creation_projet: { name: 'Creation projet', objectives: ['Conception', 'Realisation', 'Test', 'Lancement'] },
      organisation: { name: 'Organisation evenement', objectives: ['Planification', 'Preparation', 'Execution', 'Cloture'] },
    };
  }
}

function tryParse(str, fallback) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

export const planner = new PlanningEngine();
export default planner;

bus.on(EVENTS.DECISION_MADE, async (data) => {
  if (data.jid && data.context) {
    planner.planFromGoal(`Suite a decision: ${data.context.slice(0, 200)}`, data.jid).catch(() => {});
  }
});
