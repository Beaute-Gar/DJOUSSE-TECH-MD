import { createLogger } from '../../infrastructure/logger.js';
import { rawRun, rawAll } from '../../infrastructure/database/database.js';
const log = createLogger('TRAINER');

let enabled = false, listener = null;
const TRIGGERS = ['apprends-moi', 'apprends moi', 'forme', 'cours', 'leçon', 'formation', 'apprentissage'];

export function enableTrainerMode(sock) {
  if (enabled) return;
  enabled = true;
  rawRun(`CREATE TABLE IF NOT EXISTS lessons (id INTEGER PRIMARY KEY AUTOINCREMENT, jid TEXT NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, created_at INTEGER NOT NULL)`);
  listener = (m) => {
    if (!enabled) return;
    for (const msg of m.messages || []) {
      if (msg.key?.fromMe) continue;
      const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').toLowerCase().trim();
      const jid = msg.key.remoteJid; if (!jid) continue;
      if (TRIGGERS.some(t => text.startsWith(t) || text.includes(` ${t}`))) {
        const lessons = rawAll('SELECT * FROM lessons WHERE jid = ? ORDER BY created_at DESC LIMIT 5', jid);
        if (!lessons.length) return sock.sendMessage(jid, { text: '📚 *Mode Formateur*\nAucune leçon enregistrée.\nEnvoie `.leçon <titre> | <contenu>` pour créer une leçon.' });
        let reply = '📚 *Tes dernières leçons:*\n\n';
        lessons.forEach(l => { reply += `📖 *${l.title}*\n${l.content.substring(0, 300)}\n\n`; reply += `_Pour un quiz sur cette leçon, réponds avec "quiz ${l.id}"_\n\n`; });
        sock.sendMessage(jid, { text: reply });
      }
      const lessonMatch = text.match(/^\.leçon\s+(.+?)\s*\|\s*(.+)/);
      if (lessonMatch) {
        const title = lessonMatch[1].trim(), content = lessonMatch[2].trim();
        rawRun('INSERT INTO lessons (jid, title, content, created_at) VALUES (?, ?, ?, ?)', jid, title, content, Date.now());
        sock.sendMessage(jid, { text: `✅ Leçon *"${title}"* enregistrée !` });
      }
      if (text.startsWith('quiz ')) {
        const id = parseInt(text.split(' ')[1]); if (!id) return;
        const lesson = rawAll('SELECT * FROM lessons WHERE id = ? AND jid = ?', id, jid)[0];
        if (!lesson) return sock.sendMessage(jid, { text: '❌ Leçon introuvable.' });
        const words = lesson.content.split(/\s+/).filter(w => w.length > 4);
        if (words.length < 3) return sock.sendMessage(jid, { text: '❌ Trop court pour un quiz.' });
        const q = words.slice(0, 3).join(' ');
        sock.sendMessage(jid, { text: `🎯 *Quiz — ${lesson.title}*\n\nComplète: "${q} ..."\n\n_Réponds pour vérifier tes connaissances._` });
      }
    }
  };
  sock.ev.on('messages.upsert', listener);
  log.info('Mode formateur activé');
}

export function disableTrainerMode(sock) { enabled = false; if (listener && sock) try { sock.ev.off('messages.upsert', listener); } catch {} }
export function isTrainerModeOn() { return enabled; }
