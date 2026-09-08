import { createLogger } from '../../infrastructure/logger.js';
const log = createLogger('DATAANLZ');

let enabled = false;
let listener = null;

export async function enableDataAnalyzer(sock) {
  if (enabled) return;
  enabled = true;
  listener = (m) => {
    if (!enabled) return;
    for (const msg of m.messages || []) {
      if (msg.key?.fromMe) continue;
      const doc = msg.message?.documentMessage;
      if (!doc) continue;
      const name = (doc.fileName || '').toLowerCase();
      if (!name.endsWith('.csv') && !name.endsWith('.xlsx') && !name.endsWith('.xls') && !name.endsWith('.tsv')) continue;
      analyzeFile(sock, msg, doc);
    }
  };
  sock.ev.on('messages.upsert', listener);
  log.info('Analyseur de données activé');
}

async function analyzeFile(sock, msg, doc) {
  try {
    const jid = msg.key.remoteJid;
    const buf = await sock.downloadMediaMessage(msg);
    if (!buf?.length) return;
    const text = buf.toString('utf-8');
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      sock.sendMessage(jid, { text: '?? Fichier trop court ou vide.' }, { quoted: msg });
      return;
    }
    const headers = lines[0].split(/[,;\t]/).map(h => h.trim().replace(/^["']|["']$/g, ''));
    const rows = lines.slice(1).map(l => l.split(/[,;\t]/).map(c => c.trim().replace(/^["']|["']$/g, '')));
    const numCols = headers.length;
    const numRows = rows.length;
    const numericCols = [];
    for (let ci = 0; ci < numCols; ci++) {
      const vals = rows.map(r => parseFloat(r[ci])).filter(v => !isNaN(v));
      if (vals.length > numRows * 0.5) {
        const sum = vals.reduce((a, b) => a + b, 0);
        const avg = sum / vals.length;
        const sorted = [...vals].sort((a, b) => a - b);
        const min = sorted[0];
        const max = sorted[sorted.length - 1];
        numericCols.push({ name: headers[ci], min, max, avg: avg.toFixed(2), count: vals.length });
      }
    }
    let reply = '?? *Analyse: ' + doc.fileName + '*\n';
    reply += '?? Lignes: ' + numRows + '\n';
    reply += '?? Colonnes: ' + numCols + ' (' + headers.join(', ') + ')\n';
    if (numericCols.length) {
      reply += '\n*Stats numériques:*\n';
      for (const c of numericCols) {
        reply += '• ' + c.name + ': min=' + c.min + ', max=' + c.max + ', moy=' + c.avg + ' (' + c.count + ' val)\n';
      }
    }
    const emptyRate = (rows.filter(r => r.some(c => !c)).length / numRows * 100).toFixed(1);
    reply += '\n?? Cellules vides: ~' + emptyRate + '%';
    sock.sendMessage(jid, { text: reply }, { quoted: msg });
  } catch (e) {
    log.warn('Erreur analyse: ' + e.message);
  }
}

export function disableDataAnalyzer(sock) {
  enabled = false;
  if (listener && sock) try { sock.ev.off('messages.upsert', listener); } catch {}
}
export function isDataAnalyzerOn() { return enabled; }
