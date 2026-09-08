import { createLogger } from '../../infrastructure/logger.js';
const log = createLogger('BROADCAST');

const history = [];

export async function broadcastTo(sock, targets, message) {
  let ok = 0, fail = 0;
  for (const t of targets) {
    try { await sock.sendMessage(t, { text: message }); ok++; } catch { fail++; }
    await new Promise(r => setTimeout(r, 2000));
  }
  const entry = { targets: targets.length, ok, fail, message: message.slice(0, 100), ts: Date.now() };
  history.push(entry);
  return entry;
}

export async function getAllGroups(sock) {
  const groups = await sock.groupFetchAllParticipating();
  return Object.keys(groups);
}

export function getHistory() { return history.slice(-10); }
