import { createLogger } from '../../../infrastructure/logger.js';

const log = createLogger('PersonalizedAnalyzer');
const messageLogs = new Map();
const userProfiles = new Map();

export function initTracker() {
  log.info('Personalized analyzer initialized');
}

export function trackMessage(jid, pushName, body, isGroup) {
  if (!jid) return;
  if (!messageLogs.has(jid)) {
    messageLogs.set(jid, []);
  }
  const logs = messageLogs.get(jid);
  logs.push({ pushName, body, isGroup, time: Date.now() });
  if (logs.length > 200) logs.splice(0, 50);
  if (pushName) {
    userProfiles.set(jid, { pushName, lastSeen: Date.now() });
  }
}

export async function collectRichStats(sock) {
  const totalMessages = [...messageLogs.values()].reduce((a, b) => a + b.length, 0);
  const uniqueUsers = userProfiles.size;
  const topChats = [...messageLogs.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10)
    .map(([jid, msgs]) => ({
      jid,
      pushName: userProfiles.get(jid)?.pushName || jid.split('@')[0],
      count: msgs.length,
    }));
  return { totalMessages, uniqueUsers, topChats };
}
