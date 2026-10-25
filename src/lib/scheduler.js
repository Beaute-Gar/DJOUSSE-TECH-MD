'use strict';
/**
 * Planificateur de messages (in-process, persisté dans state)
 * Usage: .schedule 5m Bonjour  |  .schedule 18:30 Texte  |  .schedules  |  .unschedule <id>
 */
const fs = require('fs');
const path = require('path');
const { send } = require('./wa-send');

function parseWhen(str) {
  const s = String(str || '').trim().toLowerCase();
  // 5m / 2h / 1d
  let m = s.match(/^(\d+)\s*(s|m|h|d|sec|min|mins|hour|hours|jour|jours)?$/i);
  if (m) {
    const n = parseInt(m[1], 10);
    const u = (m[2] || 'm').toLowerCase();
    const mult =
      u.startsWith('s') ? 1000 :
      u.startsWith('h') ? 3600000 :
      u.startsWith('d') || u.startsWith('j') ? 86400000 :
      60000;
    return Date.now() + n * mult;
  }
  // HH:MM aujourd'hui ou demain
  m = s.match(/^(\d{1,2})[:hH](\d{2})$/);
  if (m) {
    const d = new Date();
    d.setSeconds(0, 0);
    d.setHours(+m[1], +m[2], 0, 0);
    if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
    return d.getTime();
  }
  // JJ/MM/AAAA HH:MM
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T]+(\d{1,2})[:hH](\d{2})$/);
  if (m) {
    const d = new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], 0, 0);
    if (!isNaN(d.getTime())) return d.getTime();
  }
  return null;
}

class Scheduler {
  constructor(file) {
    this.file = file;
    this.jobs = [];
    this.timer = null;
    this.sock = null;
    this._load();
  }

  _load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      this.jobs = Array.isArray(raw.jobs) ? raw.jobs : [];
    } catch (_) {
      this.jobs = [];
    }
  }

  _save() {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify({ jobs: this.jobs }, null, 2));
      fs.renameSync(tmp, this.file);
    } catch (e) {
      console.error('[SCHED] save:', e.message);
    }
  }

  start(sock) {
    this.sock = sock;
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 15000);
    this.timer.unref?.();
    console.log(`[SCHED] ${this.jobs.length} job(s) chargé(s)`);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  add({ jid, text, when, from }) {
    const id = `job_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e4)}`;
    const job = { id, jid, text, when, from: from || null, created: Date.now() };
    this.jobs.push(job);
    this._save();
    return job;
  }

  remove(id) {
    const before = this.jobs.length;
    this.jobs = this.jobs.filter((j) => j.id !== id && !String(j.id).endsWith(id));
    this._save();
    return this.jobs.length < before;
  }

  list(jid) {
    return this.jobs.filter((j) => !jid || j.jid === jid || j.from === jid);
  }

  async tick() {
    if (!this.sock || !this.jobs.length) return;
    const now = Date.now();
    const due = this.jobs.filter((j) => j.when <= now);
    if (!due.length) return;
    this.jobs = this.jobs.filter((j) => j.when > now);
    this._save();
    for (const job of due) {
      try {
        await send(this.sock, job.jid, { text: job.text });
        console.log(`[SCHED] envoyé ${job.id} → ${job.jid}`);
      } catch (e) {
        console.error(`[SCHED] échec ${job.id}:`, e.message);
      }
    }
  }
}

let sched = null;

function initScheduler(sessionDir) {
  sched = new Scheduler(path.join(sessionDir, 'scheduler.json'));
  return sched;
}

function getScheduler() {
  return sched;
}

module.exports = { initScheduler, getScheduler, parseWhen, Scheduler };
