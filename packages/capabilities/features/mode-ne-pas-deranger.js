import { createLogger } from '../../infrastructure/logger.js';
import { rawRun, rawGet } from '../../infrastructure/database/database.js';

const log = createLogger('NPD');

export async function configurerNPD(jid, { heureDebut, heureFin, active }) {
  rawRun(`CREATE TABLE IF NOT EXISTS preferences_npd (
    jid TEXT PRIMARY KEY,
    heure_debut TEXT NOT NULL DEFAULT '22:00',
    heure_fin TEXT NOT NULL DEFAULT '07:00',
    fuseau TEXT NOT NULL DEFAULT 'Africa/Douala',
    active INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  )`);
  rawRun('INSERT OR REPLACE INTO preferences_npd (jid, heure_debut, heure_fin, active, updated_at) VALUES (?, ?, ?, ?, ?)',
    jid, heureDebut, heureFin, active ? 1 : 0, Date.now());
  log.info(`NPD configuré pour ${jid}: ${heureDebut}-${heureFin} active=${active}`);
  return { success: true };
}

export function estEnPeriodeNPD(jid, texteMessage) {
  const pref = rawGet('SELECT * FROM preferences_npd WHERE jid = ? AND active = 1', jid);
  if (!pref) return false;
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const current = `${h}:${m}`;
  const debut = pref.heure_debut;
  const fin = pref.heure_fin;
  if (debut < fin) return current >= debut && current < fin;
  return current >= debut || current < fin;
}
