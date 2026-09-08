import { createLogger } from '../../infrastructure/logger.js';
const log = createLogger('POLL');

export async function createPoll(sock, groupJid, question, options, maxSelectable = 1) {
  return await sock.sendMessage(groupJid, {
    poll: { name: question, values: options.slice(0, 12), selectableCount: maxSelectable },
  });
}
