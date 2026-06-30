import { CognitiveApp } from './cognitive-app.js';
import { planner, Mission } from '../planning-engine.js';
import { foresight } from '../foresight-engine.js';
import { semanticMemory } from '../semantic-memory.js';
import { getPendingActions } from '../automation-engine.js';
import { createLogger } from '../../core/logger.js';

const log = createLogger('MISSION');

export class MissionCenter extends CognitiveApp {
  constructor() {
    super({ name: 'mission-center', version: '1.0.0', description: 'Console centralisee de pilotage des missions cognitives' });
  }

  list(status = null) {
    return planner.getAllMissions(status).map(m => ({
      id: m.id, title: m.title, status: m.status, priority: m.priority,
      progress: m.progress, overdue: m.isOverdue, tasks: m.tasks.length,
      completedTasks: m.tasks.filter(t => t.status === 'completed').length,
    }));
  }

  getDetail(missionId) {
    const mission = planner.getMission(missionId);
    if (!mission) return null;
    const deps = semanticMemory.missions.getDependencies(missionId);
    const chain = semanticMemory.missions.getChain(missionId);
    const hist = semanticMemory.missions?.getChain ? semanticMemory.timeline.getBySource('mission', missionId, 10) : [];
    const prediction = foresight.predictMission(missionId);
    const risks = foresight.predictRisks(missionId);
    const statusBlocked = mission.tasks.filter(t => t.status === 'blocked').map(t => ({ title: t.title, reason: t.metadata?.reason || 'Inconnu' }));
    const explain = planner.explainState(missionId);
    return {
      mission: { id: mission.id, title: mission.title, description: mission.description, status: mission.status, priority: mission.priority, progress: mission.progress, overdue: mission.isOverdue },
      objectives: mission.objectives.map(o => ({ title: o.title, status: o.status })),
      tasks: mission.tasks.map(t => ({ title: t.title, status: t.status, assignedTo: t.assignedTo, priority: t.priority })),
      dependencies: deps,
      chain,
      timeline: hist.map(h => ({ title: h.title, date: h.timestamp })),
      prediction: prediction || null,
      risks: risks || [],
      blockedTasks: statusBlocked,
      explain,
    };
  }

  getTimeline(missionId) {
    return planner.getMissionTimeline(missionId);
  }

  createFromGoal(goal, owner = null) {
    return planner.planFromGoal(goal, owner);
  }

  async recover(missionId) {
    return foresight.recoverMission(missionId);
  }

  getStats() {
    return planner.getStats();
  }

  getExecutiveSummary() {
    const stats = planner.getStats();
    const all = planner.getAllMissions();
    const critical = all.filter(m => (m.isOverdue && m.status === 'active') || m.status === 'blocked');
    const recent = all.filter(m => m.status === 'active').sort((a, b) => b.priority - a.priority).slice(0, 5);
    return {
      stats,
      criticalMissions: critical.map(m => ({ id: m.id, title: m.title, status: m.status, progress: m.progress })),
      activePriorities: recent.map(m => ({ title: m.title, priority: m.priority, progress: m.progress })),
    };
  }

  render() {
    return { app: 'mission-center', status: this._ready ? 'actif' : 'inactif', stats: this.getStats() };
  }
}

export const missionCenter = new MissionCenter();
export default missionCenter;
