import { createLogger } from '../../infrastructure/logger.js';
import { rawRun, rawAll, rawGet } from '../../infrastructure/database/database.js';
const log = createLogger('ADVOTE');

let enabled = false, listener = null;

export function enableAdvancedVoting(sock) {
  if (enabled) return;
  enabled = true;
  rawRun(`CREATE TABLE IF NOT EXISTS votes (id INTEGER PRIMARY KEY AUTOINCREMENT, group_jid TEXT NOT NULL, title TEXT NOT NULL, options_json TEXT NOT NULL, created_by TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL)`);
  rawRun(`CREATE TABLE IF NOT EXISTS vote_responses (id INTEGER PRIMARY KEY AUTOINCREMENT, vote_id INTEGER NOT NULL, voter_jid TEXT NOT NULL, option TEXT NOT NULL, weight INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, UNIQUE(vote_id, voter_jid))`);
  listener = (m) => {
    if (!enabled) return;
    for (const msg of m.messages || []) {
      if (msg.key?.fromMe) continue;
      const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
      const jid = msg.key.remoteJid; if (!jid) continue;
      const sender = msg.key.participant || jid;
      const createMatch = text.match(/^\.vote\s+(.+?)\s*\|\s*(.+)/);
      if (createMatch) {
        const title = createMatch[1].trim();
        const opts = createMatch[2].split(',').map(o => o.trim()).filter(Boolean);
        if (opts.length < 2) return sock.sendMessage(jid, { text: '❌ Au moins 2 options requises.' });
        const expires = Date.now() + 86400000;
        rawRun('INSERT INTO votes (group_jid, title, options_json, created_by, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)', jid, title, JSON.stringify(opts), sender, expires, Date.now());
        sock.sendMessage(jid, { text: `🗳️ *Sondage créé:* "${title}"\n\n${opts.map((o, i) => `  ${i + 1}. ${o}`).join('\n')}\n\n_Réponds avec le numéro de ton choix._\n_Expire dans 24h._` });
      }
      const optNum = parseInt(text);
      if (optNum > 0) {
        const active = rawAll('SELECT * FROM votes WHERE group_jid = ? AND expires_at > ? ORDER BY created_at DESC LIMIT 1', jid, Date.now());
        if (!active.length) return;
        const v = active[0];
        const opts = JSON.parse(v.options_json);
        if (optNum < 1 || optNum > opts.length) return sock.sendMessage(jid, { text: `❌ Choisis entre 1 et ${opts.length}.` });
        const selected = opts[optNum - 1];
        const existing = rawGet('SELECT * FROM vote_responses WHERE vote_id = ? AND voter_jid = ?', v.id, sender);
        if (existing) return sock.sendMessage(jid, { text: '❌ Tu as déjà voté.' });
        const weight = rawAll('SELECT COUNT(*) as n FROM cognitive_persons WHERE jid = ?', sender)[0]?.n || 1;
        rawRun('INSERT INTO vote_responses (vote_id, voter_jid, option, weight, created_at) VALUES (?, ?, ?, ?, ?)', v.id, sender, selected, Math.min(weight, 10), Date.now());
        const allVotes = rawAll('SELECT option, SUM(weight) as total FROM vote_responses WHERE vote_id = ? GROUP BY option', v.id);
        const total = allVotes.reduce((s, r) => s + r.total, 0);
        let reply = `🗳️ *${v.title} — Résultats*\n`;
        allVotes.forEach(r => { reply += `\n${r.option}: ${r.total} voix (${total ? Math.round(r.total / total * 100) : 0}%)`; });
        sock.sendMessage(jid, { text: reply });
      }
    }
  };
  sock.ev.on('messages.upsert', listener);
  log.info('Vote avancé activé');
}

export function disableAdvancedVoting(sock) { enabled = false; if (listener && sock) try { sock.ev.off('messages.upsert', listener); } catch {} }
export function isAdvancedVotingOn() { return enabled; }
