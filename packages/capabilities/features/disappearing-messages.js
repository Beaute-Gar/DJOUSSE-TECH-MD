import { createLogger } from '../../infrastructure/logger.js';
import { rawRun, rawGet, rawAll } from '../../infrastructure/database/database.js';
const log = createLogger('DISAPPEAR');

const DURATIONS = { '24h': 86400, '7j': 604800, '90j': 7776000, off: 0 };

export async function setDisappearing(sock, jid, duration) {
  const seconds = DURATIONS[duration];
  if (seconds === undefined) return { success: false, message: `Durée invalide. Options: ${Object.keys(DURATIONS).join(', ')}` };
  try {
    await sock.sendMessage(jid, { disappearingMessagesInChat: seconds });
    rawRun(`CREATE TABLE IF NOT EXISTS disappearing_prefs (jid TEXT PRIMARY KEY, duration TEXT NOT NULL, updated_at INTEGER NOT NULL)`);
    rawRun('INSERT OR REPLACE INTO disappearing_prefs (jid, duration, updated_at) VALUES (?, ?, ?)', jid, duration, Date.now());
    log.info(`Messages qui disparaissent: ${jid} -> ${duration}`);
    return { success: true, message: duration === 'off' ? 'Messages qui disparaissent désactivés' : `Messages qui disparaissent activés (${duration})` };
  } catch (e) {
    log.warn(`setDisappearing error: ${e.message}`);
    return { success: false, message: `Erreur: ${e.message}` };
  }
}

export function getDisappearing(jid) {
  const row = rawGet('SELECT * FROM disappearing_prefs WHERE jid = ?', jid);
  return row ? row.duration : 'off';
}

export function isDisappearingOn(jid) {
  const row = rawGet('SELECT * FROM disappearing_prefs WHERE jid = ? AND duration != ?', jid, 'off');
  return !!row;
}
