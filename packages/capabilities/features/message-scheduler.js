import { createLogger } from '../../infrastructure/logger.js';
const log = createLogger('SCHEDULER');

let intervalId = null;
let enabled = false;

function parseSchedule(str) {
  const t = ['minute', 'hour', 'day', 'week', 'month'];
  for (const unit of t) {
    const re = new RegExp(`^(\\d+)?_?${unit}$`);
    const m = str.match(re);
    if (m) {
      const n = parseInt(m[1]) || 1;
      const ms = { minute: 60000, hour: 3600000, day: 86400000, week: 604800000, month: 2592000000 };
      return { interval: ms[unit] * n, every: n, unit };
    }
  }
  const tMatch = str.match(/^(\d{1,2}):(\d{2})$/);
  if (tMatch) {
    const h = parseInt(tMatch[1]), min = parseInt(tMatch[2]);
    return { time: { h, min }, cron: true };
  }
  return null;
}

function nextCronTime(h, min) {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, min, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next;
}

let db = null;

export function setDatabase(d) { db = d; }

export async function enableScheduler(sock) {
  if (enabled) return;
  enabled = true;
  db = db || (await import('../../infrastructure/database/database.js'));
  const runCheck = async () => {
    if (!enabled) return;
    try {
      const tasks = db.listActive();
      const now = Date.now();
      for (const t of tasks) {
        const parsed = parseSchedule(t.schedule);
        if (!parsed) continue;
        if (parsed.cron) {
          const next = nextCronTime(parsed.time.h, parsed.time.min);
          if (now >= next.getTime() - 30000 && now <= next.getTime() + 30000) {
            try { await sock.sendMessage(t.group_jid, { text: t.message }); } catch {}
          }
        } else {
          const lastKey = `_last_${t.id}`;
          const last = global[lastKey] || 0;
          if (now - last >= parsed.interval) {
            global[lastKey] = now;
            try { await sock.sendMessage(t.group_jid, { text: t.message }); } catch {}
          }
        }
      }
    } catch {}
  };
  runCheck();
  intervalId = setInterval(runCheck, 30000);
  log.info('Scheduler activé (30s)');
}

export function disableScheduler() {
  enabled = false;
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
}

export function isSchedulerOn() { return enabled; }
export { parseSchedule };
