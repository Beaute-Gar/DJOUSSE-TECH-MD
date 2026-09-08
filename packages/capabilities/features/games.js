import { createLogger } from '../../infrastructure/logger.js';
import { rawRun, rawGet, rawAll } from '../../infrastructure/database/database.js';
const log = createLogger('GAMES');
let listener = null, enabled = false;
const games = new Map();
const quiz = [{ q: 'Quelle est la capitale de la France ?', a: 'paris' }, { q: 'Combien de continents ?', a: '7' }, { q: 'Le plus grand océan ?', a: 'pacifique' }, { q: 'Révolution française ?', a: '1789' }];
export function enableGames(sock) {
  if (enabled) return;
  enabled = true;
  rawRun(`CREATE TABLE IF NOT EXISTS game_scores (jid TEXT, score INTEGER DEFAULT 0, game_type TEXT, PRIMARY KEY (jid, game_type))`);
  listener = (m) => {
    if (!enabled) return;
    for (const msg of m.messages || []) {
      if (msg.key?.fromMe) continue;
      const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').toLowerCase();
      if (!text) continue;
      const jid = msg.key?.remoteJid, sender = msg.key?.participant || msg.key?.remoteJid;
      if (text === 'devinette' || text === '.devinette') {
        const num = Math.floor(Math.random() * 10) + 1;
        games.set(sender, { type: 'devinette', answer: num, ts: Date.now() });
        sock.sendMessage(jid, { text: '🎯 *Devinette*\nJe pense à un nombre entre 1 et 10. Devine !' }, { quoted: msg });
      } else if (text === 'quiz' || text === '.quiz') {
        const q = quiz[Math.floor(Math.random() * quiz.length)];
        games.set(sender, { type: 'quiz', answer: q.a, ts: Date.now() });
        sock.sendMessage(jid, { text: `❓ *Quiz*\n${q.q}` }, { quoted: msg });
      } else if (text === 'score' || text === '.score') {
        const s = rawGet('SELECT SUM(score) as total FROM game_scores WHERE jid = ?', sender);
        sock.sendMessage(jid, { text: `🏆 *Score :* ${s?.total || 0} points` }, { quoted: msg });
      } else {
        const game = games.get(sender);
        if (!game || (Date.now() - game.ts) > 60000) { if (game) games.delete(sender); return; }
        if (text === game.answer.toString().toLowerCase()) {
          rawRun('INSERT INTO game_scores (jid, score, game_type) VALUES (?, 1, ?) ON CONFLICT(jid, game_type) DO UPDATE SET score = score + 1', sender, game.type);
          sock.sendMessage(jid, { text: '✅ Bonne réponse ! +1 point 🏆' }, { quoted: msg });
          games.delete(sender);
        } else { sock.sendMessage(jid, { text: '❌ Pas exact. Essaie encore !' }, { quoted: msg }); }
      }
    }
  };
  sock.ev.on('messages.upsert', listener);
  log.info('Games activé');
}
export function disableGames(sock) { enabled = false; if (listener && sock) try { sock.ev.off('messages.upsert', listener); } catch {} }
export function getLeaderboard() { return rawAll('SELECT jid, SUM(score) as total FROM game_scores GROUP BY jid ORDER BY total DESC LIMIT 10'); }
