import { createLogger } from '../../core/logger.js';
import { bus } from '../event-bus.js';

const log = createLogger('TRUST');

export class TrustEngine {
  #scores = new Map();
  #history = [];
  #config = {
    initialScore: 0.85,
    successIncrement: 0.02,
    failureDecrement: 0.05,
    errorDecrement: 0.1,
    rejectionDecrement: 0.03,
    decayRate: 0.001,
    minAutonomyScore: 0.4,
    maxScore: 0.99,
    minScore: 0.1,
  };

  constructor(config = {}) {
    Object.assign(this.#config, config);
  }

  register(agentName) {
    if (!this.#scores.has(agentName)) {
      this.#scores.set(agentName, {
        score: this.#config.initialScore,
        executions: 0,
        successes: 0,
        failures: 0,
        errors: 0,
        rejections: 0,
        lastUpdated: Date.now(),
        autonomy: 1.0,
      });
    }
    return this;
  }

  record(agentName, outcome, context = {}) {
    let record = this.#scores.get(agentName);
    if (!record) { this.register(agentName); record = this.#scores.get(agentName); }

    record.executions++;
    record.lastUpdated = Date.now();

    if (outcome === 'success') {
      record.successes++;
      record.score = Math.min(record.score + this.#config.successIncrement, this.#config.maxScore);
    } else if (outcome === 'failure') {
      record.failures++;
      record.score = Math.max(record.score - this.#config.failureDecrement, this.#config.minScore);
    } else if (outcome === 'error') {
      record.errors++;
      record.score = Math.max(record.score - this.#config.errorDecrement, this.#config.minScore);
    } else if (outcome === 'rejection') {
      record.rejections++;
      record.score = Math.max(record.score - this.#config.rejectionDecrement, this.#config.minScore);
    }

    record.autonomy = record.score >= this.#config.minAutonomyScore
      ? record.score
      : 0.2;

    const entry = { agent: agentName, outcome, score: record.score, autonomy: record.autonomy, context, timestamp: Date.now() };
    this.#history.push(entry);
    if (this.#history.length > 500) this.#history.shift();

    if (record.score < this.#config.minAutonomyScore) {
      log.warn(`[TRUST] ${agentName} trust critical (${(record.score * 100).toFixed(1)}%)`);
      bus.emit('trust:critical', { agent: agentName, score: record.score });
    }

    return record;
  }

  getScore(agentName) {
    const record = this.#scores.get(agentName);
    if (!record) return null;
    this.#applyDecay(record);
    return {
      score: record.score,
      autonomy: record.autonomy,
      executions: record.executions,
      successRate: record.executions > 0 ? record.successes / record.executions : 0,
    };
  }

  getAutonomy(agentName) {
    const s = this.getScore(agentName);
    return s ? s.autonomy : this.#config.initialScore;
  }

  canAct(agentName) {
    const s = this.getScore(agentName);
    return s ? s.score >= this.#config.minAutonomyScore : true;
  }

  #applyDecay(record) {
    const hoursSinceUpdate = (Date.now() - record.lastUpdated) / 3600000;
    if (hoursSinceUpdate > 24) {
      const decay = Math.min(this.#config.decayRate * hoursSinceUpdate, 0.1);
      record.score = Math.max(record.score - decay, this.#config.minScore);
    }
  }

  list() {
    return Array.from(this.#scores.entries()).map(([name, r]) => ({
      agent: name,
      score: +r.score.toFixed(3),
      autonomy: +r.autonomy.toFixed(3),
      executions: r.executions,
      successRate: r.executions > 0 ? +((r.successes / r.executions) * 100).toFixed(1) : 0,
      lastActive: r.lastUpdated,
    }));
  }

  getHistory(agentName, limit = 20) {
    return agentName
      ? this.#history.filter(e => e.agent === agentName).slice(-limit)
      : this.#history.slice(-limit);
  }

  getSummary() {
    const all = this.list();
    const trusted = all.filter(a => a.score >= 0.7);
    const moderate = all.filter(a => a.score >= 0.4 && a.score < 0.7);
    const critical = all.filter(a => a.score < 0.4);
    return {
      total: all.length,
      averageScore: all.length > 0 ? +(all.reduce((s, a) => s + a.score, 0) / all.length).toFixed(3) : 0,
      trusted: trusted.length,
      moderate: moderate.length,
      critical: critical.length,
      all,
    };
  }

  reset(agentName) {
    if (agentName) {
      this.#scores.set(agentName, {
        score: this.#config.initialScore,
        executions: 0, successes: 0, failures: 0, errors: 0, rejections: 0,
        lastUpdated: Date.now(), autonomy: 1.0,
      });
    } else {
      this.#scores.clear();
    }
  }
}

export const trust = new TrustEngine();
export default trust;
