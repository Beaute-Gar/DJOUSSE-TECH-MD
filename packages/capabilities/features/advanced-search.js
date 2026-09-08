import { createLogger } from '../../infrastructure/logger.js';
import { rawAll } from '../../infrastructure/database/database.js';
const log = createLogger('ADVSEARCH');

let enabled = false, listener = null;

export function enableAdvancedSearch(sock) {
  if (enabled) return;
  enabled = true;
  listener = async (m) => {
    if (!enabled) return;
    for (const msg of m.messages || []) {
      if (msg.key?.fromMe) continue;
      const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
      const jid = msg.key.remoteJid; if (!jid) continue;
      if (!text.toLowerCase().startsWith('.search ')) continue;
      const parts = text.slice(8).split('|').map(s => s.trim());
      const keyword = parts[0] || ''; const person = parts[2] || '';
      if (!keyword && !person) return sock.sendMessage(jid, { text: '❌ Usage: .search <mot-clé> | [date] | [personne]' });
      try {
        const tbl = rawAll("SELECT name FROM sqlite_master WHERE type='table' AND name='cognitive_memories'").length ? 'cognitive_memories' : 'conversations';
        let sql = `SELECT content, jid, created_at FROM ${tbl} WHERE 1=1`;
        const params = [];
        if (keyword) { sql += ' AND content LIKE ?'; params.push(`%${keyword}%`); }
        if (person) { sql += ' AND jid LIKE ?'; params.push(`%${person}%`); }
        sql += ' ORDER BY created_at DESC LIMIT 20';
        const results = rawAll(sql, ...params);
        if (!results.length) return sock.sendMessage(jid, { text: `🔍 Aucun résultat pour "${keyword}".` });
        let reply = `🔍 *Résultats* ${keyword ? `"${keyword}"` : ''}\n\n`;
        results.forEach((r, i) => { reply += `${i + 1}. [${new Date(r.created_at).toLocaleDateString('fr-FR')}] @${(r.jid||'').split('@')[0]}\n${(r.content||'').substring(0, 150)}\n\n`; });
        sock.sendMessage(jid, { text: reply });
      } catch (e) { log.warn(`Search error: ${e.message}`); }
    }
  };
  sock.ev.on('messages.upsert', listener);
  log.info('Recherche avancée activée');
}

export function disableAdvancedSearch(sock) { enabled = false; if (listener && sock) try { sock.ev.off('messages.upsert', listener); } catch {} }
export function isAdvancedSearchOn() { return enabled; }
