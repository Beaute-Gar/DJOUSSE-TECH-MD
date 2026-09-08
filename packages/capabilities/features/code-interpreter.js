import { createLogger } from '../../infrastructure/logger.js';
const log = createLogger('CODEINT');

let enabled = false, listener = null;

export async function enableCodeInterpreter(sock) {
  if (enabled) return;
  enabled = true;
  listener = async (m) => {
    if (!enabled) return;
    for (const msg of m.messages || []) {
      if (msg.key?.fromMe) continue;
      const doc = msg.message?.documentMessage;
      if (!doc) continue;
      const name = (doc.fileName || '').toLowerCase();
      if (!/\.(csv|xlsx?|tsv)$/.test(name)) continue;
      const jid = msg.key.remoteJid; if (!jid) continue;
      try {
        const buf = await sock.downloadMediaMessage(msg);
        if (!buf?.length) return;
        if (/\.xlsx?$/.test(name)) {
          sock.sendMessage(jid, { text: '📊 *Analyse Excel*\n\nPour l\'analyse complète des fichiers Excel, installe le package "xlsx" (npm install xlsx).\n\nAnalyse CSV disponible directement.' }, { quoted: msg });
          return;
        }
        const raw = buf.toString('utf-8');
        const sep = raw.includes('\t') ? '\t' : ',';
        const lines = raw.split('\n').map(l => l.trim()).filter(l => l);
        if (lines.length < 2) { sock.sendMessage(jid, { text: '📄 Fichier trop court ou vide.' }, { quoted: msg }); return; }
        const headers = lines[0].split(sep).map(h => h.trim().replace(/^["']|["']$/g, ''));
        const rows = lines.slice(1).map(l => l.split(sep).map(c => c.trim().replace(/^["']|["']$/g, '')));
        const numRows = rows.length, numCols = headers.length;
        const numericCols = [];
        for (let ci = 0; ci < numCols; ci++) {
          const vals = rows.map(r => parseFloat(r[ci])).filter(v => !isNaN(v));
          if (vals.length < numRows * 0.5) continue;
          const sum = vals.reduce((a, b) => a + b, 0);
          const sorted = [...vals].sort((a, b) => a - b);
          numericCols.push({ name: headers[ci], min: sorted[0], max: sorted[sorted.length - 1], avg: (sum / vals.length).toFixed(2), count: vals.length });
        }
        const apiKey = process.env.GROQ_API_KEY;
        let insights = '';
        if (apiKey) {
          const sample = rows.slice(0, 8).map(r => headers.map((h, i) => `${h}:${r[i] || ''}`).join(', ')).join('\n');
          const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'openai/gpt-oss-120b', messages: [{ role: 'user', content: `Analyse CSV (${numRows} lignes, colonnes: ${headers.join(', ')}). Échantillon:\n${sample}\n\n3 insights clés en français, max 100 mots.` }], max_tokens: 200 })
          });
          insights = (await res.json()).choices?.[0]?.message?.content || '';
        }
        let reply = `📊 *${doc.fileName}*\n📋 ${numRows} lignes, ${numCols} colonnes\n🏷️ ${headers.join(', ')}\n`;
        if (numericCols.length) {
          reply += '\n*Stats numériques:*\n';
          for (const c of numericCols) {
            const maxVal = Math.max(Math.abs(c.max), Math.abs(c.min), 1);
            const bar = '█'.repeat(Math.min(20, Math.max(1, Math.round((c.avg / maxVal) * 20))));
            reply += `▸ ${c.name}\n${bar} min=${c.min} max=${c.max} moy=${c.avg}\n`;
          }
        }
        const emptyRate = (rows.filter(r => r.some(c => !c)).length / numRows * 100).toFixed(1);
        reply += `\n🔍 Cellules vides: ~${emptyRate}%`;
        if (insights) reply += `\n\n🤖 *Insights IA:*\n${insights}`;
        sock.sendMessage(jid, { text: reply }, { quoted: msg });
      } catch (e) { log.warn(`Code interpreter: ${e.message}`); }
    }
  };
  sock.ev.on('messages.upsert', listener);
  log.info('Interpréteur de code activé');
}

export function disableCodeInterpreter(sock) { enabled = false; if (listener && sock) try { sock.ev.off('messages.upsert', listener); } catch {} }
export function isCodeInterpreterOn() { return enabled; }
