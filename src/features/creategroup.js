import { createLogger } from '../../packages/infrastructure/logger.js';

const log = createLogger('CREATEGROUP');

const createTriggers = [
  /cr[ée]er un groupe/i, /nouveau groupe/i, /new group/i,
  /fais un groupe/i, /cr[ée]e.*groupe/i
];

export function enableCreateGroup(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key || msg.key.fromMe) continue;
      const chat = msg.key.remoteJid;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!text || !chat) continue;
      const sender = msg.key.participant || chat;
      const isOwner = sender?.split('@')[0] === (global.__sessionOwnerNumber || process.env.BOT_OWNER || process.env.OWNER_NUMBER || '') || msg.key.fromMe;
      if (!isOwner) continue;

      if (!createTriggers.some(p => p.test(text))) continue;

      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      if (mentioned.length < 2) {
        try {
          await sock.sendMessage(chat, {
            text: '👥 Pour créer un groupe, mentionne au moins 2 membres.\nEx: "crée un groupe Projet avec @user1 @user2"'
          });
        } catch (_) {}
        continue;
      }

      const nameMatch = text.match(/groupe[:\s]+(.+?)(?: avec|$)/i);
      const groupName = nameMatch ? nameMatch[1].trim().slice(0, 50) : 'Groupe DJOUSSE TECH';

      try {
        const group = await sock.groupCreate(groupName, mentioned);
        log.info(`Groupe créé: ${groupName} (${group.gid})`);
        await sock.sendMessage(chat, { text: `✅ Groupe "${groupName}" créé avec ${mentioned.length} membres !` });
        await sock.sendMessage(group.gid, {
          text: `👋 Bienvenue dans *${groupName}*\n\n🤖 Géré par DJOUSSE TECH\n📌 Tapez votre message pour commencer.`
        });
      } catch (e) {
        log.error(`Erreur création groupe: ${e.message}`);
        try { await sock.sendMessage(chat, { text: `❌ Impossible de créer le groupe: ${e.message}` }); } catch (_) {}
      }

      const idx = messages.indexOf(msg);
      if (idx >= 0) messages.splice(idx, 1);
      break;
    }
  });

  log.info('Module creategroup actif (sur mention + ordre owner)');
}
