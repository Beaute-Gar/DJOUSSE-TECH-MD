import { createLogger } from '../../infrastructure/logger.js';
const log = createLogger('POLLCHART');

let enabled = false, listener = null;

export function enablePollCharts(sock) {
  if (enabled) return;
  enabled = true;
  listener = (m) => {
    if (!enabled) return;
    for (const msg of m.messages || []) {
      if (msg.key?.fromMe) continue;
      const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').toLowerCase();
      if (!text || !/(sondage|poll|resultat|graphique|chart|vote|résultat)/i.test(text)) continue;
      const jid = msg.key?.remoteJid; if (!jid) continue;
      const poll = msg.message?.pollCreationMessageV3 || msg.message?.pollCreationMessage;
      if (!poll) {
        sock.sendMessage(jid, { text: '📊 *Graphique de sondage*\n\nRéponds à un sondage existant avec "resultat sondage" ou "poll result".' }, { quoted: msg });
        continue;
      }
      const options = poll.options || [];
      const total = options.reduce((s, o) => s + (o.voteCount || 0), 0) || 1;
      const maxPct = Math.max(...options.map(o => Math.round(((o.voteCount || 0) / total) * 100)), 10);
      let chart = `📊 *${poll.name || 'Résultats'}*\n\n`;
      for (const opt of options) {
        const pct = Math.round(((opt.voteCount || 0) / total) * 100);
        const bar = '█'.repeat(Math.round((pct / maxPct) * 20));
        const label = (opt.optionName || '?').padEnd(16).substring(0, 16);
        chart += `${label}▎${bar} ${pct}% (${opt.voteCount || 0})\n`;
      }
      chart += `\n━━━━━━━━━━━━━━━━━━\n📬 Total: ${total} vote${total > 1 ? 's' : ''}`;
      sock.sendMessage(jid, { text: chart }, { quoted: msg });
    }
  };
  sock.ev.on('messages.upsert', listener);
  log.info('Graphiques de sondage activés');
}

export function disablePollCharts(sock) { enabled = false; if (listener && sock) try { sock.ev.off('messages.upsert', listener); } catch {} }
export function isPollChartsOn() { return enabled; }
