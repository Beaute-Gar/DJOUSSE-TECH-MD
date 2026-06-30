import { CognitiveApp } from './cognitive-app.js';
import { foresight } from '../foresight-engine.js';
import { planner } from '../planning-engine.js';
import { getPendingActions } from '../automation-engine.js';
import { meta } from '../meta-cognition.js';
import { semanticMemory } from '../semantic-memory.js';
import { crm } from './living-crm.js';
import { getAllPersons } from '../identity-engine.js';
import { trust, audit, approval, safety, policy, permissions } from '../governance/index.js';
import { orchestrator, learning } from '../agents/index.js';
import { createLogger } from '../../core/logger.js';

const log = createLogger('DASH');

export class ExecutiveDashboard extends CognitiveApp {
  constructor() {
    super({ name: 'executive-dashboard', version: '1.0.0', description: 'Cockpit decisionnel guidant l action quotidienne' });
  }

  async briefing() {
    const start = Date.now();
    const trends = await foresight.analyzeTrends().catch(() => []);
    const risks = await foresight.predictRisks().catch(() => []);
    const opportunities = await foresight.findOpportunities().catch(() => []);
    const anomalies = await foresight.detectAnomalies().catch(() => []);
    const missionStats = planner.getStats();
    const pending = getPendingActions();
    const persons = await getAllPersons() || [];
    const atRisk = await crm.getAtRiskContacts().catch(() => []);
    const metaStats = meta.getStats ? meta.getStats() : {};

    const agentConsole = await this._getAgentConsole().catch(() => null);
    const governanceStatus = await this._getGovernanceStatus().catch(() => null);

    return {
      timestamp: start,
      generatedAt: new Date(start).toISOString(),
      duration: Date.now() - start,
      sections: {
        actions_urgentes: this._urgentActions(pending, risks, anomalies),
        missions: {
          stats: missionStats,
          overdue: missionStats.overdue,
          blocked: missionStats.blocked,
          avgProgress: missionStats.avgProgress,
          resume: `${missionStats.active} missions actives, ${missionStats.overdue} en retard, ${missionStats.blocked} bloquees`,
        },
        risques: risks.slice(0, 5).map(r => ({ label: r.label, severity: r.severity, confidence: r.confidence })),
        opportunites: opportunities.slice(0, 3).map(o => ({ label: o.label, gain: o.gain, confidence: o.confidence })),
        anomalies: anomalies.slice(0, 5).map(a => ({ label: a.label, severity: a.severity, detail: a.detail })),
        tendances: trends.slice(0, 3).map(t => ({ label: t.label, direction: t.direction, confidence: t.confidence })),
        contacts_risques: atRisk.slice(0, 5),
        systeme: {
          contacts: persons.length,
          actionsEnAttente: pending.length,
          metaPerformance: metaStats,
        },
        agent_console: agentConsole,
        gouvernance: governanceStatus,
      },
      recommandations: this._generateRecommendations(risks, opportunities, anomalies, missionStats),
    };
  }

  async _getAgentConsole() {
    const agents = await orchestrator.list().catch(() => []);
    const learningSummary = learning ? learning.getModelSummary() : null;
    const workflows = orchestrator.getRecentWorkflows(5);
    return {
      agents: agents.map(a => ({
        name: a.name, state: a.state, trustScore: a.trustScore != null ? +(a.trustScore * 100).toFixed(0) : null,
        autonomy: a.autonomy != null ? +(a.autonomy * 100).toFixed(0) : null,
        executions: a.executions, errors: a.errors,
      })),
      workflows: workflows.map(w => ({
        id: w.id, goal: w.goal?.slice(0, 60), steps: w.steps?.length || 0, status: w.status,
      })),
      apprentissage: learningSummary,
    };
  }

  async _getGovernanceStatus() {
    const trustSummary = trust ? trust.getSummary() : null;
    const auditSummary = audit ? audit.summary() : null;
    const approvalStats = approval ? approval.getStats() : null;
    const policyList = policy ? policy.list() : [];
    return {
      confiance: trustSummary ? {
        moyenne: +(trustSummary.averageScore * 100).toFixed(0),
        total: trustSummary.total,
        distrib: { fiable: trustSummary.trusted, modere: trustSummary.moderate, critique: trustSummary.critical },
      } : null,
      audit: auditSummary ? {
        total24h: auditSummary.total,
        erreurs24h: auditSummary.errors,
        parAgent: auditSummary.byAgent,
      } : null,
      approbations: approvalStats ? {
        enAttente: approvalStats.pending,
        approuvees: approvalStats.approved,
        rejetees: approvalStats.rejected,
      } : null,
      politiques: policyList.filter(p => p.enabled).length,
      permissions: permissions.list().length,
    };
  }

  _urgentActions(pending, risks, anomalies) {
    const urgent = [];
    const criticalRisks = risks.filter(r => r.severity === 'critical');
    for (const r of criticalRisks) urgent.push({ type: 'risque_critique', action: r.label, priorite: 'immediate' });
    const criticalAnomalies = anomalies.filter(a => a.severity === 'critical' || a.severity === 'warning');
    for (const a of criticalAnomalies) urgent.push({ type: 'anomalie', action: a.label, priorite: 'haute' });
    const overduePending = pending.filter(a => a.createdAt && (Date.now() - a.createdAt) > 7 * 86400000);
    for (const a of overduePending.slice(0, 3)) urgent.push({ type: 'action_en_retard', action: a.title, priorite: 'haute' });
    return urgent;
  }

  _generateRecommendations(risks, opportunities, anomalies, missionStats) {
    const recs = [];
    if (missionStats.overdue > 0) recs.push(`🔴 ${missionStats.overdue} mission(s) en retard. Revoir les priorites.`);
    if (missionStats.blocked > 0) recs.push(`⛔ ${missionStats.blocked} mission(s) bloquee(s). Identifier les dependances.`);
    const highRisks = risks.filter(r => r.severity === 'critical').length;
    if (highRisks > 0) recs.push(`⚠️ ${highRisks} risque(s) critique(s) necessitent votre attention.`);
    for (const o of opportunities.slice(0, 2)) recs.push(`💡 Opportunite: ${o.label} (${o.gain})`);
    const staleContacts = anomalies.filter(a => a.type === 'disappearance').length;
    if (staleContacts > 0) recs.push(`👤 ${staleContacts} contact(s) inactif(s) a relancer.`);
    if (recs.length === 0) recs.push('✅ Tout est sous controle. Aucune action urgente.');
    return recs;
  }

  async dailyDigest() {
    const brief = await this.briefing();
    const lines = [];
    lines.push('=== COCKPIT QUOTIDIEN ===');
    const urgent = brief.sections.actions_urgentes;
    if (urgent.length > 0) {
      lines.push(`\nActions urgentes (${urgent.length}) :`);
      for (const u of urgent) lines.push(`  [${u.priorite.toUpperCase()}] ${u.action}`);
    }
    lines.push(`\n${brief.sections.missions.resume}`);
    if (brief.sections.risques.length > 0) lines.push(`Risques: ${brief.sections.risques.map(r => r.label).join(', ')}`);
    if (brief.sections.opportunites.length > 0) lines.push(`Opportunites: ${brief.sections.opportunites.map(o => o.label).join(', ')}`);
    lines.push(`\nRecommandations:`);
    for (const r of brief.recommandations) lines.push(`  ${r}`);
    lines.push(`\nSysteme: ${brief.sections.systeme.contacts} contacts, ${brief.sections.systeme.actionsEnAttente} actions en attente`);
    return lines.join('\n');
  }

  render() {
    return { app: 'executive-dashboard', status: this._ready ? 'actif' : 'inactif', description: 'Cockpit decisionnel' };
  }
}

export const dashboard = new ExecutiveDashboard();
export default dashboard;
