import { createLogger } from '../../packages/infrastructure/logger.js';

const log = createLogger('IMAGINE');

const triggers = [
  /génère.*image/i, /imagine/i, /dessine/i, /crée.*image/i,
  /génère/i, /générer/i, /image.*ia/i, /ai.*image/i,
  /un (chat|chien|paysage|robot|monstre|arbre|voiture|maison)/i
];

const negativeTriggers = [
  /comment|pourquoi|qui|quand|où|combien|quel|quelle/i
];

export function enableImagine(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue;
      const chat = msg.key.remoteJid;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!text || !chat) continue;
      if (text.length < 10 || text.length > 200) continue;
      if (negativeTriggers.some(p => p.test(text))) continue;
      if (!triggers.some(p => p.test(text))) continue;

      const prompt = text
        .replace(/génère.*image\s*/i, '').replace(/imagine\s*/i, '').replace(/dessine\s*/i, '').replace(/crée.*image\s*/i, '').trim()
        .slice(0, 100);

      if (!prompt || prompt.length < 3) continue;

      try {
        try { await sock.sendMessage(chat, { text: '🎨 Génération en cours...' }); } catch (_) {}
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&seed=${Math.floor(Math.random() * 10000)}`;
        await sock.sendMessage(chat, { image: { url }, caption: `🎨 *${prompt}*\n> Généré par DJOUSSE TECH IA` });
        log.info(`Image générée: "${prompt.slice(0, 50)}"`);
      } catch (e) {
        await sock.sendMessage(chat, { text: `❌ Erreur: ${e.message}` }).catch(() => {});
      }
    }
  });

  log.info('Module imagine actif (génération IA sur prompts créatifs)');
}
