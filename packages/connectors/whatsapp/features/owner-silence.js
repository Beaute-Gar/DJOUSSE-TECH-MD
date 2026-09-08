import { createLogger } from '../../../infrastructure/logger.js';

const log = createLogger('OwnerSilence');
const ownerChats = new Map();

export function trackOwnerMessage(remoteJid, sender) {
  if (!remoteJid || !sender) return;
  const key = `${remoteJid}:${sender}`;
  const now = Date.now();
  ownerChats.set(key, now);
  log.debug(`Owner silence tracked: ${key}`);
}

export async function checkOwnerSilence(jid, sender) {
  if (!jid || !sender) return false;
  const key = `${jid}:${sender}`;
  const last = ownerChats.get(key);
  if (!last) return false;
  const silencieux = (Date.now() - last) < 60000;
  if (silencieux) {
    log.debug(`Owner silence actif pour ${key}`);
  }
  return silencieux;
}
