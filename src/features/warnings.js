import { createLogger } from '../../packages/infrastructure/logger.js';
import { readFileSync, existsSync } from 'fs';

const log = createLogger('WARNINGS');
const DB = './database/warns.json';

function load() {
  try {
    if (!existsSync(DB)) return {};
    return JSON.parse(readFileSync(DB, 'utf8'));
  } catch { return {}; }
}

const profileQueries = [/qui est/i, /c'est qui/i, /profil.*@/i, /info.*@/i, /warnings.*@/i, /avertissements.*@/i];

export function enableWarnings(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue;
      const chat = msg.key.remoteJid;
      if (!chat?.endsWith('@g.us')) continue;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!text) continue;
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

      const isQuery = profileQueries.some(p => p.test(text));
      if (!isQuery && !mentioned.length) continue;

      const target = mentioned[0] || text.match(/@(\d+)/)?.[0];
      if (!target) continue;
      const jid = target.includes('@') ? target : `${target}@s.whatsapp.net`;

      const warns = load();
      const list = warns[jid];
      if (!list?.length) return;

      const msgWarns = `⚠️ *Avertissements* pour @${jid.split('@')[0]}\n` +
        list.map((w, i) => `${i + 1}. ${w.reason} (${new Date(w.date).toLocaleDateString('fr-FR')})`).join('\n') +
        `\n\n⚠️ ${list.length}/3 — ${list.length >= 3 ? '⛔ Banni' : `${3 - list.length} avant exclusion`}`;

      try {
        await sock.sendMessage(chat, { text: msgWarns, mentions: [jid] });
      } catch (_) {}
    }
  });

  log.info('Module warnings actif (affiche warns dans profil)');
}
