import { createLogger } from '../../infrastructure/logger.js';
const log = createLogger('SILENT');

export async function sendSilent(sock, jid, text) {
  const msg = await sock.sendMessage(jid, { text, disappearingMessagesInChat: 1 });
  try {
    await sock.chatModify({
      delete: true,
      lastMessages: [{ key: msg.key, messageTimestamp: Math.floor(Date.now() / 1000) }],
    }, jid);
  } catch {}
  return msg?.key?.id;
}
