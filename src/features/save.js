import { createLogger } from '../../packages/infrastructure/logger.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';

const log = createLogger('SAVE');
const SAVE_DIR = './database/media';

const triggers = [
  /sauvegarde/i, /sauvegarder/i, /enregistre/i, /save/i,
  /garde.*(ça|ce|cette)/i, /enregistrer/i
];

export function enableSave(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue;
      const chat = msg.key.remoteJid;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!chat) continue;

      const isRequest = text && triggers.some(p => p.test(text));
      const isMedia = msg.message?.imageMessage || msg.message?.videoMessage || msg.message?.audioMessage || msg.message?.documentMessage;

      if (!isRequest || !isMedia) continue;

      try {
        if (!existsSync(SAVE_DIR)) mkdirSync(SAVE_DIR, { recursive: true });
        const type = msg.message?.imageMessage ? 'jpg' : msg.message?.videoMessage ? 'mp4' : msg.message?.audioMessage ? 'mp3' : 'bin';
        const name = `DJ_${Date.now()}.${type}`;
        const buffer = await sock.downloadMediaMessage(msg);
        writeFileSync(`${SAVE_DIR}/${name}`, buffer);
        log.info(`Média sauvegardé: ${name}`);
        await sock.sendMessage(chat, { text: `✅ Média sauvegardé: ${name}` });
      } catch (e) {
        await sock.sendMessage(chat, { text: `❌ Erreur sauvegarde: ${e.message}` }).catch(() => {});
      }
    }
  });

  if (!existsSync(SAVE_DIR)) mkdirSync(SAVE_DIR, { recursive: true });
  log.info('Module save actif (sauvegarde silencieuse des médias sur demande)');
}
