import { createLogger } from '../../infrastructure/logger.js';
const log = createLogger('ANTIDEL');

const cache = new Map();
const owner = { jid: null };

export function setOwner(jid) { owner.jid = jid; }

export function cacheMessage(rawMsg) {
  const key = `${rawMsg.key?.remoteJid}_${rawMsg.key?.id}`;
  if (!rawMsg.message) return;
  cache.set(key, {
    message: rawMsg.message,
    key: rawMsg.key,
    sender: rawMsg.key?.participant || rawMsg.key?.remoteJid,
    pushName: rawMsg.pushName || 'Inconnu',
    ts: Date.now(),
  });
  try {
    if (rawMsg.message?.imageMessage || rawMsg.message?.videoMessage || rawMsg.message?.audioMessage) {
      import('../../connectors/whatsapp/adapter-baileys/bot.js').then(m => m.getSocket()).then(async (sock) => {
        if (sock) {
          const buf = await sock.downloadMediaMessage(rawMsg).catch(() => null);
          if (buf) { const c = cache.get(key); if (c) c.media = buf; }
        }
      });
    }
  } catch {}
  setTimeout(() => cache.delete(key), 600000);
}

export async function handleDelete(sock, update) {
  const msgId = update.key?.id;
  const jid = update.key?.remoteJid;
  if (!msgId || !jid) return;
  const key = `${jid}_${msgId}`;
  const c = cache.get(key);
  if (!c) return;
  const sender = c.sender?.split('@')[0] || '?';
  let groupName = '';
  if (jid.endsWith('@g.us')) try { const meta = await sock.groupMetadata(jid); groupName = meta.subject || ''; } catch {}
  let text = '';
  if (c.message?.conversation) text = c.message.conversation;
  else if (c.message?.extendedTextMessage?.text) text = c.message.extendedTextMessage.text;
  else if (c.message?.imageMessage?.caption) text = '📸 ' + c.message.imageMessage.caption;
  else if (c.message?.videoMessage?.caption) text = '🎥 ' + c.message.videoMessage.caption;
  else text = '[Média]';
  const notif = `🗑️ *MESSAGE SUPPRIMÉ*\n👤 ${sender}\n📍 ${groupName || 'Privé'}\n🕐 ${new Date(c.ts).toLocaleString('fr-FR')}\n\n${text}`;
  if (owner.jid) await sock.sendMessage(owner.jid, { text: notif }).catch(() => {});
  if (c.media) {
    const type = c.message?.imageMessage ? 'image' : c.message?.videoMessage ? 'video' : 'audio';
    try { await sock.sendMessage(owner.jid, { [type]: c.media, caption: `🗑️ Supprimé par @${sender}`, mentions: [c.sender] }); } catch {}
  }
  cache.delete(key);
  log.info(`Anti-delete: ${sender} dans ${groupName || 'Privé'}`);
}
