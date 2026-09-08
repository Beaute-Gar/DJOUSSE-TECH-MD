const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const DB_PATH = path.join(__dirname, '..', 'database', 'autoreply-cfg.json');
const COOLDOWN_MS = 5 * 60 * 1000; // 5 min par contact
const TZ = 'Africa/Douala';

const DEFAULTS = {
  enabled: false,
  dm: true,
  groupMention: true,
  message: '🤖 Auto-reply: Je suis indisponible pour le moment. Je reviens vite !',
  schedule: null, // "HH:MM-HH:MM" (plage) ou expression cron (active)
  cooldowns: {},
};

const load = () => {
  try {
    if (!fs.existsSync(DB_PATH)) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(DB_PATH, 'utf8')) };
  } catch {
    return { ...DEFAULTS };
  }
};

const save = (db) => {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
};

let db = load();
let cronJob = null;

/* --- Planification (cron) : active l'auto-reply quand l'expression se déclenche --- */
const scheduleJob = () => {
  if (cronJob) { cronJob.stop(); cronJob = null; }
  if (!db.schedule || db.schedule.includes('-')) return;
  try {
    if (cron.validate(db.schedule)) {
      cronJob = cron.schedule(db.schedule, () => {
        db.enabled = true;
        save(db);
        console.log('[AUTOREPLY] Activé par schedule');
      }, { timezone: TZ });
    }
  } catch (e) {
    console.error('[AUTOREPLY] Cron invalide:', e.message);
  }
};

/* --- Vérifie la plage horaire "HH:MM-HH:MM" (gère minuit: 22:00-06:00) --- */
const isInSchedule = () => {
  if (!db.schedule || !db.schedule.includes('-')) return true;
  const [start, end] = db.schedule.split('-');
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if ([sh, sm, eh, em].some(isNaN)) return true;
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (startMin > endMin) return nowMin >= startMin || nowMin <= endMin;
  return nowMin >= startMin && nowMin <= endMin;
};

/* --- API publique : testé à chaque message --- */
const check = (m, botJid) => {
  if (!db.enabled || !isInSchedule()) return false;
  if (!m || m.fromMe) return false; // ignore ses propres messages

  const jid = m.chat;
  if (!jid) return false;
  const sender = m.sender || jid; // expéditeur réel (groupe) ou jid (DM)
  const isGroup = m.isGroup || jid.endsWith('@g.us');
  const isMentioned = isGroup && botJid &&
    (m.mention || []).some(j => String(j).split(':')[0] === String(botJid).split(':')[0]);

  const triggerDM = !isGroup && db.dm;
  const triggerGroup = isGroup && db.groupMention && isMentioned;
  if (!triggerDM && !triggerGroup) return false;

  const key = `${sender}-${jid}`;
  const last = db.cooldowns[key] || 0;
  if (Date.now() - last < COOLDOWN_MS) return false;

  db.cooldowns[key] = Date.now();
  save(db);
  return { message: db.message, mentionedJid: isGroup ? [sender] : [] };
};

const getConfig = () => ({ ...db, cooldowns: undefined });
const setConfig = (cfg) => {
  db = { ...db, ...cfg };
  save(db);
  scheduleJob();
  return getConfig();
};
const resetCooldown = (jid) => {
  delete db.cooldowns[jid];
  save(db);
};

scheduleJob();

module.exports = { check, getConfig, setConfig, resetCooldown, COOLDOWN_MS };
