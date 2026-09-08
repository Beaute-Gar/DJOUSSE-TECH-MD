import { createLogger } from '../../infrastructure/logger.js';
import { aiRouter } from './ai-router.js';
import { rawGet, rawRun, rawAll } from '../../infrastructure/database/database.js';

const log = createLogger('GOAL-MGR');

export const GOAL_STATUS = { PENDING: 'pending', ACTIVE: 'active', PAUSED: 'paused', COMPLETED: 'completed', FAILED: 'failed', CANCELLED: 'cancelled' };
export const GOAL_PRIORITY = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

export class GoalManager {
  constructor() {
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    try {
      rawRun(`CREATE TABLE IF NOT EXISTS ainoria_goals (
        id TEXT PRIMARY KEY,
        jid TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'pending',
        priority INTEGER DEFAULT 2,
        milestones TEXT DEFAULT '[]',
        progress INTEGER DEFAULT 0,
        tags TEXT DEFAULT '[]',
        metadata TEXT DEFAULT '{}',
        deadline INTEGER,
        started_at INTEGER,
        completed_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`);
      rawRun(`CREATE TABLE IF NOT EXISTS ainoria_goal_milestones (
        id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'pending',
        order_index INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        completed_at INTEGER
      )`);
      rawRun(`CREATE INDEX IF NOT EXISTS idx_goals_jid ON ainoria_goals(jid)`);
      rawRun(`CREATE INDEX IF NOT EXISTS idx_goals_status ON ainoria_goals(status)`);
      rawRun(`CREATE INDEX IF NOT EXISTS idx_goals_milestones_goal ON ainoria_goal_milestones(goal_id)`);
      this.initialized = true;
      log.info('Goal Manager initialise');
    } catch (err) {
      log.error(`Init Goal Manager: ${err.message}`);
    }
  }

  async createGoal(jid, title, description = '', opts = {}) {
    await this.init();
    const id = `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();
    const priority = opts.priority || GOAL_PRIORITY.MEDIUM;
    const tags = JSON.stringify(opts.tags || []);
    const metadata = JSON.stringify(opts.metadata || {});
    const deadline = opts.deadline || null;

    let milestones = [];
    if (opts.autoDecompose !== false && description) {
      try {
        const decomp = await aiRouter.query('planification',
          'Decompose cet objectif en 3-5 jalons concrets. Reponds UNIQUEMENT avec un tableau JSON de strings.',
          [{ role: 'user', content: `${title}: ${description}` }],
          { temperature: 0.2, maxTokens: 1024 }
        );
        milestones = JSON.parse(decomp.text);
        if (!Array.isArray(milestones)) milestones = [];
      } catch { milestones = []; }
    }

    rawRun('INSERT INTO ainoria_goals (id, jid, title, description, status, priority, milestones, progress, tags, metadata, deadline, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)',
      id, jid, title.slice(0, 300), description.slice(0, 2000), GOAL_STATUS.ACTIVE, priority, JSON.stringify(milestones), tags, metadata, deadline, now, now);

    for (let i = 0; i < milestones.length; i++) {
      const mid = `ms_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 4)}`;
      rawRun('INSERT INTO ainoria_goal_milestones (id, goal_id, title, description, status, order_index, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        mid, id, milestones[i].slice(0, 300), '', 'pending', i, now);
    }

    log.info(`Goal cree: ${id} — ${title.slice(0, 80)}`);
    return this.getGoal(id);
  }

  getGoal(id) {
    try {
      const goal = rawGet('SELECT * FROM ainoria_goals WHERE id = ?', id);
      if (!goal) return null;
      const milestones = rawAll('SELECT * FROM ainoria_goal_milestones WHERE goal_id = ? ORDER BY order_index ASC', id);
      return {
        ...goal,
        milestones: JSON.parse(goal.milestones || '[]'),
        tags: JSON.parse(goal.tags || '[]'),
        metadata: JSON.parse(goal.metadata || '{}'),
        milestoneDetails: milestones,
      };
    } catch { return null; }
  }

  listGoals(jid, status = null, limit = 50) {
    try {
      const sql = status
        ? 'SELECT * FROM ainoria_goals WHERE jid = ? AND status = ? ORDER BY priority DESC, created_at DESC LIMIT ?'
        : 'SELECT * FROM ainoria_goals WHERE jid = ? ORDER BY priority DESC, created_at DESC LIMIT ?';
      const params = status ? [jid, status, limit] : [jid, limit];
      return rawAll(sql, ...params).map(g => ({ ...g, tags: JSON.parse(g.tags || '[]'), metadata: JSON.parse(g.metadata || '{}') }));
    } catch { return []; }
  }

  listActive(jid) {
    return this.listGoals(jid, GOAL_STATUS.ACTIVE);
  }

  completeMilestone(milestoneId) {
    try {
      const ms = rawGet('SELECT * FROM ainoria_goal_milestones WHERE id = ?', milestoneId);
      if (!ms) return false;
      rawRun('UPDATE ainoria_goal_milestones SET status = ?, completed_at = ? WHERE id = ?', 'completed', Date.now(), milestoneId);
      this._recalcProgress(ms.goal_id);
      return true;
    } catch { return false; }
  }

  updateGoalStatus(id, status) {
    const goal = this.getGoal(id);
    if (!goal) return false;
    const updates = { status };
    if (status === GOAL_STATUS.COMPLETED) updates.completed_at = Date.now();
    rawRun('UPDATE ainoria_goals SET status = ?, updated_at = ? WHERE id = ?', status, Date.now(), id);
    return true;
  }

  _recalcProgress(goalId) {
    const milestones = rawAll('SELECT * FROM ainoria_goal_milestones WHERE goal_id = ?', goalId);
    if (milestones.length === 0) return;
    const completed = milestones.filter(m => m.status === 'completed').length;
    const progress = Math.round((completed / milestones.length) * 100);
    rawRun('UPDATE ainoria_goals SET progress = ?, updated_at = ? WHERE id = ?', progress, Date.now(), goalId);
  }

  async reasonAboutGoal(goalId) {
    const goal = this.getGoal(goalId);
    if (!goal) return null;
    const prompt = `Objectif: ${goal.title}\nDescription: ${goal.description}\nProgression: ${goal.progress}%\nJalons: ${goal.milestones.join(', ')}\nStatut: ${goal.status}`;
    const result = await aiRouter.query('analyse',
      'Analyse la progression de cet objectif. Donne des recommandations concrètes pour avancer.',
      [{ role: 'user', content: prompt }],
      { maxTokens: 512 }
    );
    return result.text;
  }

  getStats() {
    try {
      const total = rawGet('SELECT COUNT(*) as c FROM ainoria_goals')?.c || 0;
      const active = rawGet("SELECT COUNT(*) as c FROM ainoria_goals WHERE status = 'active'")?.c || 0;
      const completed = rawGet("SELECT COUNT(*) as c FROM ainoria_goals WHERE status = 'completed'")?.c || 0;
      const overdue = rawAll("SELECT COUNT(*) as c FROM ainoria_goals WHERE deadline IS NOT NULL AND deadline < ? AND status != 'completed'", Date.now())[0]?.c || 0;
      return { total, active, completed, overdue };
    } catch { return { total: 0, active: 0, completed: 0, overdue: 0 }; }
  }
}

export const goalManager = new GoalManager();
export default goalManager;
