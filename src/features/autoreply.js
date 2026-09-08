import { createLogger } from '../../packages/infrastructure/logger.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const log = createLogger('AUTOREPLY');
const DB = './database/autoreply.json';

function load() {
  try {
    if (!existsSync(DB)) writeFileSync(DB, '{}');
    return JSON.parse(readFileSync(DB, 'utf8'));
  } catch { return {}; }
}

export function enableAutoReply(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const rules = load();
    if (!Object.keys(rules).length) return;

    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue;
      const chat = msg.key.remoteJid;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!text || !chat) continue;

      const lower = text.toLowerCase();
      for (const [keyword, rule] of Object.entries(rules)) {
        if (lower.includes(keyword)) {
          try {
            const reply = rule.reply
              .replace(/{user}/g, `@${(msg.key.participant || chat).split('@')[0]}`)
              .replace(/{name}/g, msg.pushName || '');
            await sock.sendMessage(chat, { text: reply, mentions: [msg.key.participant].filter(Boolean) });
            log.info(`Auto-reply "${keyword}" → ${chat}`);
          } catch (_) {}
          break;
        }
      }
    }
  });

  log.info('Module autoreply actif (réponses auto sur mots-clés)');
}
