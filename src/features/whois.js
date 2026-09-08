import { createLogger } from '../../packages/infrastructure/logger.js';

const log = createLogger('WHOIS');

const triggers = [
  /qui est/i, /info.*@/i, /profil.*@/i, /détails.*@/i,
  /whois/i, /c'est qui/i, /renseigne.*toi/i
];

export function enableWhois(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue;
      const chat = msg.key.remoteJid;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!text || !chat) continue;
      if (!triggers.some(p => p.test(text))) continue;

      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;
      let target = mentioned[0] || quoted;

      if (!target) {
        const match = text.match(/@(\d+)/);
        if (match) target = `${match[1]}@s.whatsapp.net`;
      }

      if (!target) {
        try { await sock.sendMessage(chat, { text: '👤 Mentionne ou répond à la personne que tu veux identifier.' }); } catch (_) {}
        continue;
      }

      try {
        const pp = await sock.profilePictureUrl(target, 'image').catch(() => null);
        let response = `👤 *Whois*\n\n📱 Numéro: ${target.split('@')[0]}\n🆔 JID: ${target}\n📸 Photo: ${pp ? '✅' : '❌'}`;

        if (chat.endsWith('@g.us')) {
          try {
            const meta = await sock.groupMetadata(chat);
            const part = meta.participants?.find(p => p.id === target);
            if (part) {
              response += `\n👑 Rôle: ${part.admin === 'superadmin' ? '🌟 Créateur' : part.admin === 'admin' ? '👑 Admin' : '👤 Membre'}`;
              const joined = new Date().toLocaleDateString('fr-FR');
              response += `\n📅 Membre depuis: ${joined}`;
            }
          } catch {}
        }

        if (pp) {
          await sock.sendMessage(chat, { image: { url: pp }, caption: response, mentions: [target] });
        } else {
          await sock.sendMessage(chat, { text: response, mentions: [target] });
        }
        log.info(`Whois: ${target}`);
      } catch (e) {
        try { await sock.sendMessage(chat, { text: `❌ Erreur: ${e.message}` }); } catch (_) {}
      }
    }
  });

  log.info('Module whois actif');
}
