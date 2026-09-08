import { createLogger } from '../../infrastructure/logger.js';
import { rawRun, rawAll } from '../../infrastructure/database/database.js';
const log = createLogger('SOCIALPOST');

let enabled = false, listener = null;

export function enableSocialPoster(sock) {
  if (enabled) return;
  enabled = true;
  rawRun(`CREATE TABLE IF NOT EXISTS social_posts (id INTEGER PRIMARY KEY AUTOINCREMENT, jid TEXT NOT NULL, platform TEXT NOT NULL DEFAULT 'all', content TEXT NOT NULL, scheduled_at INTEGER, posted INTEGER DEFAULT 0, created_at INTEGER NOT NULL)`);
  listener = async (m) => {
    if (!enabled) return;
    for (const msg of m.messages || []) {
      if (msg.key?.fromMe) continue;
      const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
      const jid = msg.key.remoteJid; if (!jid) continue;
      const lower = text.toLowerCase();
      const pubMatch = text.match(/^\.(publie|post)\s+(.+)/);
      if (pubMatch) {
        const content = pubMatch[2].trim();
        rawRun('INSERT INTO social_posts (jid, platform, content, posted, created_at) VALUES (?, ?, ?, ?, ?)', jid, 'all', content, 0, Date.now());
        sock.sendMessage(jid, { text: `📤 *Publication programmée*\n\nContenu: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"\n\n_Le cross-posting API nécessite des tokens. La publication est stockée localement._` });
      }
      const crossMatch = text.match(/^\.crosspost\s+(.+?)\s*\|\s*(.+)/);
      if (crossMatch) {
        const platform = crossMatch[1].trim().toLowerCase();
        const content = crossMatch[2].trim();
        if (!['twitter', 'facebook', 'instagram', 'telegram', 'whatsapp', 'all'].includes(platform)) return sock.sendMessage(jid, { text: '❌ Plateforme non supportée. Utilise: twitter, facebook, instagram, telegram, whatsapp, all' });
        rawRun('INSERT INTO social_posts (jid, platform, content, posted, created_at) VALUES (?, ?, ?, ?, ?)', jid, platform, content, 0, Date.now());
        sock.sendMessage(jid, { text: `📤 Cross-post vers *${platform}* programmé.\n\n_Configuration API requise pour publication automatique._` });
      }
      if (lower === '.mes-posts') {
        const posts = rawAll('SELECT * FROM social_posts WHERE jid = ? ORDER BY created_at DESC LIMIT 10', jid);
        if (!posts.length) return sock.sendMessage(jid, { text: '📭 Aucun post.' });
        let reply = '📤 *Mes publications*\n\n';
        posts.forEach(p => { reply += `${p.posted ? '✅' : '⏳'} [${p.platform}] ${p.content.substring(0, 50)} — ${new Date(p.created_at).toLocaleDateString('fr-FR')}\n`; });
        sock.sendMessage(jid, { text: reply });
      }
    }
  };
  sock.ev.on('messages.upsert', listener);
  log.info('Social poster activé');
}

export function disableSocialPoster(sock) { enabled = false; if (listener && sock) try { sock.ev.off('messages.upsert', listener); } catch {} }
export function isSocialPosterOn() { return enabled; }
