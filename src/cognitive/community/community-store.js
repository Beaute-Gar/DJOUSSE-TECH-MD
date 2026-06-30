import { createLogger } from '../../core/logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const log = createLogger('SCG:STORE');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_PATH = path.resolve(__dirname, '../../../data/community.json');

class CommunityStore {
  constructor() {
    this._data = { groups: {}, lastSaved: Date.now() };
    this._dirty = false;
    this._saveTimer = null;
    this._load();
  }

  _load() {
    try {
      if (fs.existsSync(STORE_PATH)) {
        const raw = fs.readFileSync(STORE_PATH, 'utf-8');
        this._data = JSON.parse(raw);
        log.info(`Loaded ${Object.keys(this._data.groups).length} community profiles`);
      }
    } catch (err) {
      log.warn(`Load failed, starting fresh: ${err.message}`);
    }
  }

  _save() {
    try {
      const dir = path.dirname(STORE_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      this._data.lastSaved = Date.now();
      fs.writeFileSync(STORE_PATH, JSON.stringify(this._data, null, 2), 'utf-8');
      this._dirty = false;
    } catch (err) {
      log.error(`Save failed: ${err.message}`);
    }
  }

  _scheduleSave() {
    this._dirty = true;
    if (this._saveTimer) return;
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      if (this._dirty) this._save();
    }, 5000);
  }

  _getGroup(groupJid) {
    if (!this._data.groups[groupJid]) {
      this._data.groups[groupJid] = {
        profile: { type: 'unknown', confidence: 0, topics: [], lastAnalyzed: null, analyzed: false },
        mode: 'libre', modeExpiry: null, modeSetBy: null,
        polls: [], games: { scores: {}, currentGame: null },
        stats: { totalMessages: 0, activeMembers: 0, inactiveMembers: 0, dailyActivity: {}, hourlyActivity: {} },
        inactivity: { lastActive: Date.now(), overdueSince: null, inactiveMembers: [] },
        lockedMembers: {},
        createdAt: Date.now(), updatedAt: Date.now(),
      };
    }
    return this._data.groups[groupJid];
  }

  getGroupProfile(groupJid) {
    return this._getGroup(groupJid).profile;
  }

  updateGroupProfile(groupJid, updates) {
    const g = this._getGroup(groupJid);
    Object.assign(g.profile, updates);
    g.updatedAt = Date.now();
    this._scheduleSave();
    return g.profile;
  }

  getGroupMode(groupJid) {
    const g = this._getGroup(groupJid);
    if (g.modeExpiry && Date.now() > g.modeExpiry) {
      g.mode = 'libre';
      g.modeExpiry = null;
      this._scheduleSave();
    }
    return g.mode;
  }

  setGroupMode(groupJid, mode, expiry, setBy) {
    const g = this._getGroup(groupJid);
    g.mode = mode;
    g.modeExpiry = expiry || null;
    g.modeSetBy = setBy || null;
    g.updatedAt = Date.now();
    this._scheduleSave();
  }

  getPolls(groupJid) {
    return this._getGroup(groupJid).polls.filter(p => p.status === 'active');
  }

  getAllPolls(groupJid) {
    return this._getGroup(groupJid).polls;
  }

  createPoll(groupJid, poll) {
    const g = this._getGroup(groupJid);
    g.polls.push({
      id: `poll_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      status: 'active',
      votes: {},
      result: null,
      ...poll,
    });
    g.updatedAt = Date.now();
    this._scheduleSave();
    return g.polls[g.polls.length - 1];
  }

  closePoll(groupJid, pollId) {
    const g = this._getGroup(groupJid);
    const poll = g.polls.find(p => p.id === pollId);
    if (!poll) return null;
    poll.status = 'closed';
    const counts = {};
    for (const opt of poll.options) counts[opt] = 0;
    for (const v of Object.values(poll.votes)) {
      if (counts[v.option] !== undefined) counts[v.option]++;
    }
    poll.result = {
      total: Object.keys(poll.votes).length,
      counts,
      winner: Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
    };
    this._unlockAllForPoll(groupJid, pollId);
    g.updatedAt = Date.now();
    this._scheduleSave();
    return poll;
  }

  votePoll(groupJid, pollId, voterJid, option) {
    const g = this._getGroup(groupJid);
    const poll = g.polls.find(p => p.id === pollId);
    if (!poll || poll.status !== 'active') return { ok: false, reason: 'poll_not_active' };
    if (!poll.options.includes(option)) return { ok: false, reason: 'invalid_option' };
    poll.votes[voterJid] = { option, votedAt: Date.now() };
    this._unlockMember(groupJid, voterJid);
    g.updatedAt = Date.now();
    this._scheduleSave();
    return { ok: true, poll, total: Object.keys(poll.votes).length };
  }

  setMandatory(groupJid, pollId, mandatory) {
    const g = this._getGroup(groupJid);
    const poll = g.polls.find(p => p.id === pollId);
    if (!poll) return false;
    poll.mandatory = mandatory;
    g.updatedAt = Date.now();
    this._scheduleSave();
    return true;
  }

  isMemberLocked(groupJid, memberJid) {
    const g = this._getGroup(groupJid);
    const lock = g.lockedMembers[memberJid];
    if (!lock) return false;
    if (Date.now() > lock.until) {
      delete g.lockedMembers[memberJid];
      this._scheduleSave();
      return false;
    }
    return true;
  }

  lockMember(groupJid, memberJid, pollId, durationMs) {
    const g = this._getGroup(groupJid);
    g.lockedMembers[memberJid] = { pollId, until: Date.now() + durationMs, lockedAt: Date.now() };
    g.updatedAt = Date.now();
    this._scheduleSave();
  }

  _unlockMember(groupJid, memberJid) {
    const g = this._getGroup(groupJid);
    if (g.lockedMembers[memberJid]) {
      delete g.lockedMembers[memberJid];
      this._scheduleSave();
    }
  }

  _unlockAllForPoll(groupJid, pollId) {
    const g = this._getGroup(groupJid);
    let changed = false;
    for (const [jid, lock] of Object.entries(g.lockedMembers)) {
      if (lock.pollId === pollId) {
        delete g.lockedMembers[jid];
        changed = true;
      }
    }
    if (changed) this._scheduleSave();
  }

  unlockMember(groupJid, memberJid) {
    this._unlockMember(groupJid, memberJid);
  }

  unlockAll(groupJid) {
    const g = this._getGroup(groupJid);
    if (Object.keys(g.lockedMembers).length > 0) {
      g.lockedMembers = {};
      g.updatedAt = Date.now();
      this._scheduleSave();
    }
  }

  getLockedMembers(groupJid) {
    const g = this._getGroup(groupJid);
    const now = Date.now();
    const locked = {};
    for (const [jid, lock] of Object.entries(g.lockedMembers)) {
      if (now <= lock.until) locked[jid] = lock;
    }
    return locked;
  }

  getGameScores(groupJid) {
    return this._getGroup(groupJid).games.scores;
  }

  updateGameScore(groupJid, memberJid, points, badge) {
    const g = this._getGroup(groupJid);
    if (!g.games.scores[memberJid]) {
      g.games.scores[memberJid] = { points: 0, badges: [], level: 1 };
    }
    g.games.scores[memberJid].points += points;
    if (badge && !g.games.scores[memberJid].badges.includes(badge)) {
      g.games.scores[memberJid].badges.push(badge);
    }
    const total = g.games.scores[memberJid].points;
    g.games.scores[memberJid].level = Math.floor(total / 100) + 1;
    g.updatedAt = Date.now();
    this._scheduleSave();
    return g.games.scores[memberJid];
  }

  setCurrentGame(groupJid, game) {
    const g = this._getGroup(groupJid);
    g.games.currentGame = game;
    g.updatedAt = Date.now();
    this._scheduleSave();
  }

  clearCurrentGame(groupJid) {
    const g = this._getGroup(groupJid);
    g.games.currentGame = null;
    g.updatedAt = Date.now();
    this._scheduleSave();
  }

  getCurrentGame(groupJid) {
    return this._getGroup(groupJid).games.currentGame;
  }

  recordActivity(groupJid, memberJid) {
    const g = this._getGroup(groupJid);
    g.stats.totalMessages++;
    g.inactivity.lastActive = Date.now();
    const today = new Date().toISOString().slice(0, 10);
    g.stats.dailyActivity[today] = (g.stats.dailyActivity[today] || 0) + 1;
    const hour = String(new Date().getHours());
    g.stats.hourlyActivity[hour] = (g.stats.hourlyActivity[hour] || 0) + 1;
    g.updatedAt = Date.now();
  }

  getStats(groupJid) {
    return this._getGroup(groupJid).stats;
  }

  getInactiveMembers(groupJid) {
    return this._getGroup(groupJid).inactivity.inactiveMembers;
  }

  getLastSummary(groupJid) {
    return this._getGroup(groupJid).stats.lastSummary || null;
  }

  setLastSummary(groupJid, summary) {
    const g = this._getGroup(groupJid);
    g.stats.lastSummary = summary;
    g.updatedAt = Date.now();
    this._scheduleSave();
  }

  getGroupData(groupJid) {
    return this._getGroup(groupJid);
  }

  getAllGroups() {
    return Object.keys(this._data.groups);
  }

  flush() {
    if (this._dirty) this._save();
  }
}

export const communityStore = new CommunityStore();
export default communityStore;
