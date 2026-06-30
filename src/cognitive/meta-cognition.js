import { createLogger } from '../core/logger.js';
import { bus, EVENTS } from './event-bus.js';
import { reasoner } from './reasoning-engine.js';
import { rawGet, rawRun, rawAll } from '../lib/database.js';
import { getWorldState } from './world-model.js';

const log = createLogger('META');

class MetaCognition {
  constructor() {
    this.performanceLog = [];
    this.maxLog = 500;
    this.reviewInterval = 3600000;
    this.lastReview = 0;
  }

  async recordOutcome(traceId, outcome, feedback = {}) {
    const trace = reasoner.traceHistory.find(t => t.id === traceId);
    if (!trace) return null;

    const entry = {
      traceId,
      timestamp: Date.now(),
      goal: trace.goal,
      confidence: trace.confidence,
      chosenAction: trace.chosenAction,
      outcome: outcome || 'unknown',
      wasCorrect: feedback.wasCorrect ?? null,
      userFeedback: feedback.userFeedback || null,
      latency: Date.now() - trace.timestamp,
    };

    this.performanceLog.push(entry);
    if (this.performanceLog.length > this.maxLog) this.performanceLog.shift();

    rawRun('INSERT INTO cognitive_meta (trace_id, goal, confidence, action, outcome, was_correct, user_feedback, latency, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      traceId, trace.goal, trace.confidence, trace.chosenAction || '', outcome || 'unknown',
      feedback.wasCorrect !== undefined ? (feedback.wasCorrect ? 1 : 0) : null,
      feedback.userFeedback || null, entry.latency, Date.now());

    return entry;
  }

  getPerformanceSummary() {
    const recent = this.performanceLog.slice(-100);
    if (recent.length === 0) return { total: 0, message: 'Aucune donnee de performance' };

    const correct = recent.filter(e => e.wasCorrect === true).length;
    const incorrect = recent.filter(e => e.wasCorrect === false).length;
    const unknown = recent.filter(e => e.wasCorrect === null || e.wasCorrect === undefined).length;
    const avgLatency = recent.reduce((s, e) => s + (e.latency || 0), 0) / recent.length;
    const byGoal = {};
    for (const e of recent) {
      if (!byGoal[e.goal]) byGoal[e.goal] = { total: 0, correct: 0 };
      byGoal[e.goal].total++;
      if (e.wasCorrect) byGoal[e.goal].correct++;
    }

    return {
      total: recent.length,
      correct,
      incorrect,
      unknown,
      accuracyRate: correct + incorrect > 0 ? Math.round((correct / (correct + incorrect)) * 100) : null,
      avgLatency: Math.round(avgLatency),
      byGoal: Object.entries(byGoal).map(([goal, stats]) => ({ goal, ...stats, rate: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0 })),
      topErrors: incorrect > 0 ? this._analyzeErrors(recent.filter(e => e.wasCorrect === false)) : [],
    };
  }

  _analyzeErrors(errors) {
    const goalCount = {};
    for (const e of errors) {
      goalCount[e.goal] = (goalCount[e.goal] || 0) + 1;
    }
    return Object.entries(goalCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([goal, count]) => ({ goal, count, suggestion: `Revoir les inferences pour "${goal}"` }));
  }

  getAccuracyTrend() {
    const recent = this.performanceLog.slice(-200);
    if (recent.length < 10) return { message: 'Pas assez de donnees (minimum 10 traces)' };

    const chunkSize = Math.max(10, Math.floor(recent.length / 5));
    const chunks = [];
    for (let i = 0; i < recent.length; i += chunkSize) {
      const chunk = recent.slice(i, i + chunkSize);
      const correct = chunk.filter(e => e.wasCorrect === true).length;
      const total = chunk.filter(e => e.wasCorrect !== null).length;
      chunks.push({
        from: chunk[0]?.timestamp || 0,
        to: chunk[chunk.length - 1]?.timestamp || 0,
        accuracy: total > 0 ? Math.round((correct / total) * 100) : null,
        sampleSize: total,
      });
    }
    return chunks;
  }

  getConfidenceCalibration() {
    const recent = this.performanceLog.slice(-200);
    if (recent.length < 5) return { message: 'Pas assez de donnees' };

    const buckets = {};
    for (const e of recent) {
      if (e.wasCorrect === null) continue;
      const bucket = Math.round(e.confidence * 10) * 10;
      if (!buckets[bucket]) buckets[bucket] = { count: 0, correct: 0 };
      buckets[bucket].count++;
      if (e.wasCorrect) buckets[bucket].correct++;
    }

    return Object.entries(buckets).map(([bucket, stats]) => ({
      confidenceBucket: parseInt(bucket) / 100,
      count: stats.count,
      accuracy: stats.count > 0 ? Math.round((stats.correct / stats.count) * 100) : 0,
      calibrated: Math.abs(parseInt(bucket) / 100 - (stats.correct / stats.count)) < 0.15,
    }));
  }

  async selfReview() {
    const now = Date.now();
    if (now - this.lastReview < this.reviewInterval) return null;
    this.lastReview = now;

    const summary = this.getPerformanceSummary();
    const findings = [];

    if (summary.accuracyRate !== null && summary.accuracyRate < 60) {
      findings.push({ severity: 'critical', message: `Taux de precision faible (${summary.accuracyRate}%)`, suggestion: 'Revoir les regles d\'inference' });
    }

    if (summary.avgLatency > 2000) {
      findings.push({ severity: 'warning', message: `Latence moyenne elevee (${summary.avgLatency}ms)`, suggestion: 'Optimiser la collecte de faits' });
    }

    const calibration = this.getConfidenceCalibration();
    if (calibration.length > 0) {
      const miscalibrated = calibration.filter(c => !c.calibrated);
      if (miscalibrated.length > 0) {
        findings.push({ severity: 'info', message: `${miscalibrated.length} buckets de confiance desequilibres`, suggestion: 'Ajuster le Confidence Engine' });
      }
    }

    if (findings.length > 0) {
      bus.emit('meta:review', { findings, timestamp: now });
      log.info(`[Meta] Auto-review: ${findings.length} constats`);
    }

    return findings;
  }

  suggestImprovements() {
    const summary = this.getPerformanceSummary();
    if (summary.total < 10) return [{ message: 'Collectez plus de donnees pour des suggestions pertinentes' }];

    const suggestions = [];
    if (summary.accuracyRate !== null && summary.accuracyRate < 70) {
      suggestions.push({
        area: 'inference',
        message: 'Ameliorer les regles d\'inference',
        detail: `Precision actuelle: ${summary.accuracyRate}%`,
        priority: 'haute',
      });
    }

    for (const err of summary.topErrors || []) {
      suggestions.push({
        area: 'goal',
        message: err.suggestion,
        detail: `${err.count} erreurs pour "${err.goal}"`,
        priority: err.count > 5 ? 'haute' : 'moyenne',
      });
    }

    const trace = reasoner.getLastTrace();
    if (trace && trace.confidence < 0.4) {
      suggestions.push({
        area: 'confidence',
        message: 'Ajouter des sources de donnees supplementaires',
        detail: `Derniere confiance: ${Math.round(trace.confidence * 100)}%`,
        priority: 'moyenne',
      });
    }

    return suggestions;
  }
}

export const meta = new MetaCognition();
export default meta;

setInterval(() => meta.selfReview().catch(() => {}), 3600000);
