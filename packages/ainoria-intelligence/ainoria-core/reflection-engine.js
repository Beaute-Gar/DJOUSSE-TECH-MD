import { createLogger } from '../../infrastructure/logger.js';
import { aiRouter } from './ai-router.js';
import { rawGet, rawRun, rawAll } from '../../infrastructure/database/database.js';

const log = createLogger('REFLECT');

export class ReflectionEngine {
  constructor() {
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    try {
      rawRun(`CREATE TABLE IF NOT EXISTS ainoria_reflections (
        id TEXT PRIMARY KEY,
        action_type TEXT NOT NULL,
        action_id TEXT,
        success INTEGER NOT NULL,
        summary TEXT,
        insights TEXT DEFAULT '[]',
        improvements TEXT DEFAULT '[]',
        tools_used TEXT DEFAULT '[]',
        errors TEXT DEFAULT '[]',
        confidence REAL,
        duration INTEGER,
        created_at INTEGER NOT NULL
      )`);
      rawRun(`CREATE INDEX IF NOT EXISTS idx_reflections_action ON ainoria_reflections(action_type)`);
      rawRun(`CREATE INDEX IF NOT EXISTS idx_reflections_created ON ainoria_reflections(created_at)`);
      this.initialized = true;
      log.info('Reflection Engine initialise');
    } catch (err) {
      log.error(`Init Reflection: ${err.message}`);
    }
  }

  async record(actionType, actionId, outcome, opts = {}) {
    await this.init();
    const id = `refl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const insights = opts.insights || [];
    const improvements = opts.improvements || [];
    const toolsUsed = opts.toolsUsed || [];
    const errors = opts.errors || [];

    if (opts.autoAnalyze !== false && outcome) {
      try {
        const analysis = await aiRouter.query('analyse',
          'Analyse cette action. Donne 2-3 insights (ce qui a fonctionne/non) et 1-2 ameliorations possibles. Reponds UNIQUEMENT avec JSON: { "insights": [], "improvements": [] }',
          [{ role: 'user', content: `Action: ${actionType}\nResultat: ${JSON.stringify(outcome).slice(0, 1000)}` }],
          { temperature: 0.3, maxTokens: 512 }
        );
        const parsed = JSON.parse(analysis.text);
        if (parsed.insights) insights.push(...parsed.insights);
        if (parsed.improvements) improvements.push(...parsed.improvements);
      } catch {}
    }

    const success = opts.success !== undefined ? (opts.success ? 1 : 0) : (outcome && !opts.errors?.length ? 1 : 0);

    rawRun('INSERT INTO ainoria_reflections (id, action_type, action_id, success, summary, insights, improvements, tools_used, errors, confidence, duration, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id, actionType, actionId, success, (opts.summary || '').slice(0, 2000),
      JSON.stringify(insights.slice(0, 10)), JSON.stringify(improvements.slice(0, 10)),
      JSON.stringify(toolsUsed.slice(0, 20)), JSON.stringify(errors.slice(0, 10)),
      opts.confidence || null, opts.duration || null, Date.now());

    return id;
  }

  getReflection(id) {
    try {
      const row = rawGet('SELECT * FROM ainoria_reflections WHERE id = ?', id);
      if (!row) return null;
      return {
        ...row,
        insights: JSON.parse(row.insights || '[]'),
        improvements: JSON.parse(row.improvements || '[]'),
        tools_used: JSON.parse(row.tools_used || '[]'),
        errors: JSON.parse(row.errors || '[]'),
      };
    } catch { return null; }
  }

  listRecent(limit = 20) {
    try {
      return rawAll('SELECT * FROM ainoria_reflections ORDER BY created_at DESC LIMIT ?', limit)
        .map(r => ({ ...r, insights: JSON.parse(r.insights || '[]'), improvements: JSON.parse(r.improvements || '[]') }));
    } catch { return []; }
  }

  async generateReport(limit = 50) {
    const reflections = this.listRecent(limit);
    if (reflections.length === 0) return 'Aucune reflexion disponible.';

    const successRate = reflections.filter(r => r.success).length / reflections.length;
    const allInsights = reflections.flatMap(r => r.insights || []);
    const allImprovements = reflections.flatMap(r => r.improvements || []);

    let synthesis = '';
    try {
      const data = reflections.map(r => `[${r.action_type}] ${r.summary?.slice(0, 100) || 'N/A'} (${r.success ? 'OK' : 'ECHEC'})`).join('\n');
      const result = await aiRouter.query('analyse',
        'Synthetise ces reflexions en 3-5 points cles. Que peut-on ameliorer globalement ?',
        [{ role: 'user', content: data }],
        { maxTokens: 512 }
      );
      synthesis = result.text;
    } catch { synthesis = 'Synthese indisponible'; }

    const topInsights = [...new Set(allInsights)].slice(0, 5);
    const topImprovements = [...new Set(allImprovements)].slice(0, 5);

    return { total: reflections.length, successRate: Math.round(successRate * 100), topInsights, topImprovements, synthesis };
  }

  getRecentFailures(limit = 10) {
    try {
      return rawAll('SELECT * FROM ainoria_reflections WHERE success = 0 ORDER BY created_at DESC LIMIT ?', limit)
        .map(r => ({ ...r, insights: JSON.parse(r.insights || '[]'), errors: JSON.parse(r.errors || '[]') }));
    } catch { return []; }
  }

  getStats() {
    try {
      const total = rawGet('SELECT COUNT(*) as c FROM ainoria_reflections')?.c || 0;
      const successes = rawGet('SELECT COUNT(*) as c FROM ainoria_reflections WHERE success = 1')?.c || 0;
      const byType = {};
      const types = rawAll('SELECT action_type, COUNT(*) as c FROM ainoria_reflections GROUP BY action_type');
      for (const t of types) byType[t.action_type] = t.c;
      return { total, successRate: total > 0 ? Math.round((successes / total) * 100) : 0, byType };
    } catch { return { total: 0, successRate: 0, byType: {} }; }
  }
}

export const reflectionEngine = new ReflectionEngine();
export default reflectionEngine;
