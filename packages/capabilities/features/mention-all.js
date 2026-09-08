import { createLogger } from '../../infrastructure/logger.js';
const log = createLogger('MENTION');

export async function mentionEveryone(sock, groupJid, message) {
  const metadata = await sock.groupMetadata(groupJid);
  const all = metadata.participants.map(p => p.id);
  await sock.sendMessage(groupJid, { text: message, mentions: all });
  log.info(`@all -> ${all.length} membres`);
  return all.length;
}
