import { createLogger } from '../../packages/infrastructure/logger.js';

const log = createLogger('MODE');

const modeTriggers = {
  public: [/mode public/i, /passe en public/i, /ouvre le bot/i],
  private: [/mode private/i, /passe en private/i, /mode privé/i, /réservé à moi/i, /owner only/i],
  invisible: [/mode invisible/i, /cache le bot/i, /invisible/i]
};

export function enableMode(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue;
      const chat = msg.key.remoteJid;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!text || !chat) continue;
      const sender = msg.key.participant || chat;
      const isOwner = sender?.split('@')[0] === (global.__sessionOwnerNumber || process.env.BOT_OWNER || process.env.OWNER_NUMBER || '') || msg.key.fromMe;
      if (!isOwner) continue;

      for (const [mode, patterns] of Object.entries(modeTriggers)) {
        if (patterns.some(p => p.test(text))) {
          process.env.MODE = mode;
          log.info(`Mode changé en ${mode} par ${sender}`);
          try {
            await sock.sendMessage(chat, { text: `✅ Mode changé: *${mode}*\n\n📢 public → tout le monde\n🔒 private → owner seulement\n👻 invisible → silencieux` });
          } catch (_) {}
          break;
        }
      }
    }
  });

  log.info('Module mode actif (owner: "mode public/private/invisible")');
}
