import { createLogger } from '../../packages/infrastructure/logger.js';

const log = createLogger('SETNAME');
const triggers = [/renomme.*groupe/i, /change.*nom.*groupe/i, /set name/i, /nouveau nom/i, /rename group/i];

export function enableSetName(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue;
      const chat = msg.key.remoteJid;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!text || !chat?.endsWith('@g.us')) continue;
      const sender = msg.key.participant;
      if (!sender) continue;
      const meta = await sock.groupMetadata(chat).catch(() => null);
      if (!meta) continue;
      const isAdmin = meta.participants?.some(p => p.id === sender && p.admin);
      if (!isAdmin) continue;
      if (!triggers.some(p => p.test(text))) continue;
      const newName = text.replace(/renomme.*groupe\s*/i, '').replace(/change.*nom.*groupe\s*/i, '').replace(/set name\s*/i, '').replace(/nouveau nom\s*/i, '').trim();
      if (!newName || newName.length < 2) {
        try { await sock.sendMessage(chat, { text: '📝 Quel nouveau nom veux-tu donner au groupe ?' }); } catch (_) {}
        return;
      }
      try {
        await sock.groupUpdateSubject(chat, newName.slice(0, 50));
        log.info(`Groupe renommé: ${newName}`);
        try { await sock.sendMessage(chat, { text: `✅ Groupe renommé: *${newName.slice(0, 50)}*` }); } catch (_) {}
      } catch (e) {
        try { await sock.sendMessage(chat, { text: `❌ Erreur: ${e.message}` }); } catch (_) {}
      }
    }
  });
  log.info('Module setname actif');
}
