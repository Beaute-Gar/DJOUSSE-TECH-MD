import { createLogger } from '../../infrastructure/logger.js';
import { fetchJson } from '../../infrastructure/database/utils.js';
const log = createLogger('NEWS');

let listener = null;
let enabled = false;

const NEWS_API = 'https://gnews.io/api/v4/top-headlines?lang=fr&country=cm&max=5&apikey=';

export function enableNewsMonitor(sock) {
  if (enabled) return;
  enabled = true;
  listener = (m) => {
    if (!enabled) return;
    for (const msg of m.messages || []) {
      if (msg.key?.fromMe) continue;
      const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').toLowerCase();
      if (!text) continue;
      if (!text.includes('actualité') && !text.includes('news') && !text.includes('veille') && !text.includes('actu')) continue;
      const jid = msg.key?.remoteJid;
      (async () => {
        try {
          const apiKey = process.env.GNEWS_API_KEY || '';
          const data = await fetchJson(`${NEWS_API}${apiKey}`);
          const articles = data.articles || [];
          if (!articles.length) {
            sock.sendMessage(jid, { text: '📰 *Actualités*\n\nAucune actualité trouvée pour le moment.' }, { quoted: msg });
            return;
          }
          let reply = '📰 *Top Actualités*\n\n';
          for (let i = 0; i < Math.min(articles.length, 5); i++) {
            const a = articles[i];
            reply += `${i + 1}. ${a.title}\n${a.source?.name || ''}\n${a.url || ''}\n\n`;
          }
          sock.sendMessage(jid, { text: reply }, { quoted: msg });
        } catch (e) {
          log.error(`Erreur news: ${e.message}`);
          sock.sendMessage(jid, { text: '📰 *Actualités*\n\nImpossible de récupérer les actualités.' }, { quoted: msg });
        }
      })();
    }
  };
  sock.ev.on('messages.upsert', listener);
  log.info('News monitor activé');
}

export function disableNewsMonitor(sock) {
  enabled = false;
  if (listener && sock) try { sock.ev.off('messages.upsert', listener); } catch {}
}
