import { createLogger } from '../../packages/infrastructure/logger.js';

const log = createLogger('BROADCAST');

const triggers = [
  /annonce pour tous/i, /broadcast/i, /message à tous/i, /diffuser/i,
  /préviens tout le monde/i, /info importante/i, /urgence/i, /⚠️/i
];

export function enableBroadcast(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue;
      const chat = msg.key.remoteJid;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!text || !chat) continue;
      const sender = msg.key.participant || chat;
      const isOwner = sender?.split('@')[0] === (global.__sessionOwnerNumber || process.env.BOT_OWNER || process.env.OWNER_NUMBER || '') || msg.key.fromMe;
      if (!isOwner) continue;

      if (!triggers.some(p => p.test(text))) continue;
      const cleanText = text.replace(/broadcast|diffuser|annonce pour tous|préviens tout le monde|message à tous/i, '').trim();
      if (!cleanText || cleanText.length < 3) {
        try { await sock.sendMessage(chat, { text: '📢 Quel message veux-tu diffuser à tous les groupes ?' }); } catch (_) {}
        continue;
      }

      try {
        const groups = await sock.groupFetchAllParticipating();
        const ids = Object.keys(groups);
        let sent = 0, failed = 0;

        try { await sock.sendMessage(chat, { text: `📡 Diffusion vers ${ids.length} groupes...` }); } catch (_) {}

        for (const id of ids) {
          try {
            await sock.sendMessage(id, { text: `📢 *BROADCAST*\n\n${cleanText}\n\n> DJOUSSE TECH` });
            sent++;
          } catch { failed++; }
        }

        log.info(`Broadcast: ${sent} OK / ${failed} échec`);
        try { await sock.sendMessage(chat, { text: `✅ Diffusion terminée\n📨 ${sent} groupes\n❌ ${failed} échec` }); } catch (_) {}
      } catch (e) {
        try { await sock.sendMessage(chat, { text: `❌ Erreur broadcast: ${e.message}` }); } catch (_) {}
      }
    }
  });

  log.info('Module broadcast actif');
}
