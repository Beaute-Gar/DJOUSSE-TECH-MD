import { createLogger } from '../../infrastructure/logger.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const config = require('../../../config.cjs');
const log = createLogger('SMARTNOTIF');

let enabled = false;
let ownerJid = null;
const queue = [];
const rateLimit = 30 * 60 * 1000;
let lastSent = 0;
let timer = null;

export function pushNotification(title, message, priority = 'normal') {
  if (!enabled) return;
  queue.push({ title, message, priority, ts: Date.now() });
  queue.sort((a, b) => ({ urgent: 0, important: 1, normal: 2 })[a.priority] - ({ urgent: 0, important: 1, normal: 2 })[b.priority]);
}

async function flush(sock) {
  if (!enabled || !ownerJid || !queue.length) return;
  const now = Date.now();
  if (now - lastSent < rateLimit) return;
  const notif = queue.shift();
  if (!notif) return;
  const icons = { urgent: '??', important: '??', normal: '??' };
  try {
    await sock.sendMessage(ownerJid, {
      text: (icons[notif.priority] || '??') + ' *' + notif.title + '*\n\n' + notif.message + '\n\n? ' + new Date(notif.ts).toLocaleTimeString('fr-FR'),
    });
    lastSent = Date.now();
  } catch (e) {
    log.warn('Erreur notification: ' + e.message);
    queue.unshift(notif);
  }
}

export async function enableSmartNotifications(sock, owner) {
  if (enabled) return;
  enabled = true;
  ownerJid = owner || (config.OWNER_NUMBER ? config.OWNER_NUMBER + '@s.whatsapp.net' : null);
  if (!ownerJid) { log.warn('OWNER_NUMBER non défini'); return; }
  timer = setInterval(() => flush(sock), 30000);
  log.info('Notifications intelligentes activées (rate: 30min)');
}

export async function sendUrgent(sock, owner, title, message) {
  if (!enabled) return;
  try { await sock.sendMessage(owner, { text: '?? *URGENT — ' + title + '*\n\n' + message }); }
  catch (e) { log.warn('Erreur urgent: ' + e.message); }
}

export function disableSmartNotifications() {
  enabled = false;
  if (timer) { clearInterval(timer); timer = null; }
  queue.length = 0;
}
export function isSmartNotificationsOn() { return enabled; }
export function getNotificationQueue() { return [...queue]; }
