import { createLogger } from '../../infrastructure/logger.js';
import { rawRun, rawAll, rawGet } from '../../infrastructure/database/database.js';
const log = createLogger('TRELLO');

let enabled = false, listener = null;

export function enableTrelloSync(sock) {
  if (enabled) return;
  enabled = true;
  rawRun(`CREATE TABLE IF NOT EXISTS trello_config (jid TEXT PRIMARY KEY, api_key TEXT, api_token TEXT, board_id TEXT)`);
  rawRun(`CREATE TABLE IF NOT EXISTS trello_tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, jid TEXT NOT NULL, title TEXT NOT NULL, description TEXT, status TEXT DEFAULT 'todo', created_at INTEGER NOT NULL)`);
  listener = (m) => {
    if (!enabled) return;
    for (const msg of m.messages || []) {
      if (msg.key?.fromMe) continue;
      const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
      const jid = msg.key.remoteJid; if (!jid) continue;
      const lower = text.toLowerCase();
      const addMatch = text.match(/^\.carte\s+(.+)/);
      if (addMatch || (lower.includes('ajoute carte') && text.includes(':'))) {
        const title = addMatch ? addMatch[1].trim() : text.split(':')[1]?.trim();
        if (!title) return;
        rawRun('INSERT INTO trello_tasks (jid, title, description, status, created_at) VALUES (?, ?, ?, ?, ?)', jid, title, text, 'todo', Date.now());
        sock.sendMessage(jid, { text: `📋 Carte créée: *${title}* ✅` });
      }
      if (lower.includes('trello') && lower.includes('liste')) {
        const tasks = rawAll('SELECT * FROM trello_tasks WHERE jid = ? ORDER BY created_at DESC LIMIT 10', jid);
        if (!tasks.length) return sock.sendMessage(jid, { text: '📋 Aucune tâche.' });
        const config = rawGet('SELECT * FROM trello_config WHERE jid = ?', jid);
        let reply = `${config ? '🔗 ' : '📋 '}*Tâches*${config ? ' (sync Trello configuré)' : ' (local)'}\n\n`;
        tasks.forEach(t => { reply += `${t.status === 'done' ? '✅' : '📌'} *${t.title}*\n  ${t.description?.substring(0, 100) || ''}\n\n`; });
        sock.sendMessage(jid, { text: reply });
      }
      if (lower.startsWith('.trello-conf')) {
        const parts = text.split(' ').slice(1);
        const [key, token, board] = parts;
        if (!key || !token) return sock.sendMessage(jid, { text: '❌ Usage: .trello-conf <api_key> <token> [board_id]' });
        rawRun('INSERT OR REPLACE INTO trello_config VALUES (?, ?, ?, ?)', jid, key, token, board || '');
        sock.sendMessage(jid, { text: '✅ Configuration Trello enregistrée (local uniquement pour l\'instant).' });
      }
    }
  };
  sock.ev.on('messages.upsert', listener);
  log.info('Sync Trello activé');
}

export function disableTrelloSync(sock) { enabled = false; if (listener && sock) try { sock.ev.off('messages.upsert', listener); } catch {} }
export function isTrelloSyncOn() { return enabled; }
