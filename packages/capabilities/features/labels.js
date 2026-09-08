import { createLogger } from '../../infrastructure/logger.js';
import { rawRun, rawGet, rawAll } from '../../infrastructure/database/database.js';
const log = createLogger('LABELS');

let enabled = false, listener = null;

export function initLabels() {
  rawRun(`CREATE TABLE IF NOT EXISTS labels (
    id INTEGER PRIMARY KEY AUTOINCREMENT, jid TEXT NOT NULL, label TEXT NOT NULL,
    color TEXT DEFAULT '#039be5', created_at INTEGER NOT NULL,
    UNIQUE(jid, label)
  )`);
}

export function addLabel(jid, label, color) {
  initLabels();
  try {
    rawRun('INSERT OR IGNORE INTO labels (jid, label, color, created_at) VALUES (?, ?, ?, ?)',
      jid, label.toLowerCase().trim(), color || '#039be5', Date.now());
    return { success: true, message: `Étiquette "${label}" ajoutée` };
  } catch (e) { return { success: false, message: e.message }; }
}

export function removeLabel(jid, label) {
  initLabels();
  rawRun('DELETE FROM labels WHERE jid = ? AND label = ?', jid, label.toLowerCase().trim());
  return { success: true, message: `Étiquette "${label}" retirée` };
}

export function getLabels(jid) {
  initLabels();
  return rawAll('SELECT * FROM labels WHERE jid = ? ORDER BY created_at DESC', jid);
}

export function getAllLabels() {
  initLabels();
  return rawAll('SELECT label, COUNT(*) as count FROM labels GROUP BY label ORDER BY count DESC');
}

export function searchByLabel(label) {
  initLabels();
  return rawAll('SELECT * FROM labels WHERE label = ? ORDER BY created_at DESC', label.toLowerCase().trim());
}

export function enableLabelDetection(sock) {
  if (enabled) return;
  enabled = true;
  initLabels();
  listener = (m) => {
    if (!enabled) return;
    for (const msg of m.messages || []) {
      if (msg.key?.fromMe) continue;
      const jid = msg.key.remoteJid;
      if (!jid) continue;
    }
  };
  sock.ev.on('messages.upsert', listener);
  log.info('Détection d\'étiquettes activée');
}

export function disableLabelDetection(sock) {
  enabled = false;
  if (listener && sock) try { sock.ev.off('messages.upsert', listener); } catch {}
}
