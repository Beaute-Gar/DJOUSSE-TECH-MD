import {
  isRobloxGroup,
  isRobloxEnabled,
  isInSilence,
  recordActivity,
  handleConversation,
  checkInfraction,
  handleInfraction,
} from './roblox-elite.js';
import { isOwner } from '../security/auth.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const config  = require('../../config.cjs');
const PREFIX = config.PREFIX;

export async function robloxHook(sock, m, text, chat, isGroup) {
  if (!isGroup) return false;
  if (!isRobloxEnabled() || !isRobloxGroup(chat)) return false;
  if (text.startsWith(PREFIX)) return false;
  if (!text || text.trim().length < 3) { recordActivity(); return false; }

  recordActivity();
  if (m.key.fromMe) return false;

  const sender = m.sender ?? '';
  if (!isOwner(sender)) {
    const infraction = checkInfraction(text);
    if (infraction) {
      await handleInfraction(sock, chat, sender, m.pushName ?? '');
      return true;
    }
  }

  if (isInSilence()) return false;

  try {
    await handleConversation(sock, m, chat, text, m.pushName ?? null, sender);
  } catch {}

  return false;
}
