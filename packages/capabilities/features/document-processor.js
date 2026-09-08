import fs from 'fs/promises';
import path from 'path';
import { createLogger } from '../../infrastructure/logger.js';
const log = createLogger('DOCPROC');

let enabled = false, listener = null;
const tempDir = './temp/docs';

export async function enableDocumentProcessor(sock) {
  if (enabled) return;
  enabled = true;
  await fs.mkdir(tempDir, { recursive: true }).catch(() => {});
  listener = async (m) => {
    if (!enabled) return;
    for (const msg of m.messages || []) {
      if (msg.key?.fromMe) continue;
      const doc = msg.message?.documentMessage;
      if (!doc) continue;
      const jid = msg.key.remoteJid; if (!jid) continue;
      const fileName = doc.fileName || '';
      const mime = doc.mimetype || '';
      if (!/\.(pdf|docx?|txt)$/i.test(fileName) && !/text|pdf|document/.test(mime)) continue;
      try {
        const buf = await sock.downloadMediaMessage(msg);
        if (!buf?.length) return;
        const ext = fileName.match(/\.(\w+)$/)?.[1] || 'bin';
        const tmpFile = path.join(tempDir, `${Date.now()}.${ext}`);
        await fs.writeFile(tmpFile, buf);
        let content = '';
        if (ext === 'txt' || mime.includes('text')) content = buf.toString('utf-8').substring(0, 3000);
        else if (ext === 'pdf' || mime.includes('pdf')) {
          try { const pdfParse = (await import('pdf-parse')).default; const data = await pdfParse(buf); content = data.text.substring(0, 3000); } catch { content = '[PDF — extraction non disponible]'; }
        } else { content = '[DOCX — extraction non disponible]'; }
        await fs.unlink(tmpFile).catch(() => {});
        const words = content.split(/\s+/).filter(Boolean);
        const summary = words.length > 50 ? words.slice(0, 50).join(' ') + '...' : content;
        const lines = content.split('\n').filter(Boolean);
        sock.sendMessage(jid, { text: `📄 *Document analysé*\n📁 ${fileName}\n📏 ${words.length} mots, ${lines.length} lignes\n\n📝 *Résumé:*\n${summary || '[Vide]'}` });
      } catch (e) { log.warn(`Doc error: ${e.message}`); }
    }
  };
  sock.ev.on('messages.upsert', listener);
  log.info('Processeur de documents activé');
}

export function disableDocumentProcessor(sock) { enabled = false; if (listener && sock) try { sock.ev.off('messages.upsert', listener); } catch {} }
export function isDocumentProcessorOn() { return enabled; }
