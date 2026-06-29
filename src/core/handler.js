import { createRequire } from 'module';
import { createLogger } from './logger.js';
import { validateText, validateCommand } from '../security/validator.js';
import { checkRateLimit } from '../security/rateLimit.js';
import { hasAccess, getPrivilege, isModeAllowed, isOwner, registerOwnerJid } from '../security/auth.js';
import { getPlugin } from './loader.js';
import { Users, Groups, ensureUser, ensureGroup, addXp, getUserLevel, incrementCmd } from '../lib/database.js';
import { robloxHook } from '../modules/roblox-hook.js';

const require = createRequire(import.meta.url);
const config  = require('../../config.cjs');
const log     = createLogger('HANDLER');

const LEVEL_XP = [0, 100, 250, 500, 1000, 2000, 4000, 8000, 15000, 30000];
const GROUP_SETTINGS_CACHE = new Map();

function parseCommand(text, prefix) {
  if (!text.startsWith(prefix)) return null;
  const body    = text.slice(prefix.length).trim();
  if (!body)    return null;
  const parts   = body.split(/\s+/);
  const command = parts[0].toLowerCase();
  const args    = parts.slice(1);
  const argText = args.join(' ');
  return { command, args, text: argText };
}

async function sendError(sock, m, message) {
  try {
    await sock.sendMessage(m.key.remoteJid, { text: `❌ ${message}` }, { quoted: m });
  } catch {}
}

export async function handleMessage(sock, rawMsg, m) {
  const chatJid   = m.key.remoteJid;
  const senderJid = m.sender;
  const isGroup   = chatJid?.endsWith('@g.us') ?? false;
  const rawText   = m.body ?? '';

  const validation = validateText(rawText);
  if (!validation.safe) {
    log.warn({ jid: senderJid, reason: validation.reason }, 'Message invalide rejeté');
    return;
  }
  const text = validation.sanitized;

  try {
    const senderName = m.pushName || 'Inconnu';
    Users.upsert(senderJid, senderName);
    if (isGroup) Groups.upsert(chatJid, m.groupMetadata?.subject || 'Groupe');
  } catch {}

  if (Users.isBanned(senderJid)) return;

  if (isGroup) {
    const grp = Groups.get(chatJid);
    if (grp?.is_banned) return;
    if (grp?.botban === 1) return;
  }

  if (!isOwner(senderJid)) {
    const controlled = Groups.get(chatJid);
    if (!isGroup || (controlled && chatJid)) {
      registerOwnerJid(senderJid);
    }
  }

  if (isGroup && !text.startsWith(config.PREFIX)) {
    ensureUser(senderJid, m.pushName || '');
    const user = getUserLevel(senderJid);
    const oldXp = user?.xp || 0;
    addXp(senderJid, 1);
    const newUser = getUserLevel(senderJid);
    const newLevel = newUser.level || 0;
    const newXp = newUser.xp || 0;
    const xpNeeded = LEVEL_XP[newLevel] || LEVEL_XP[LEVEL_XP.length - 1];
    if (newXp >= xpNeeded && newLevel < LEVEL_XP.length) {
      const { getDB } = await import('../lib/database.js');
      getDB().prepare('UPDATE users SET level = level + 1, xp = 0 WHERE jid = ?').run(senderJid);
    }
  }

  if (config.AUTO_REACT && m.key?.id && text.startsWith(config.PREFIX)) {
    sock.sendMessage(chatJid, { react: { text: '⏳', key: m.key } }).catch(() => {});
  }

  if (isGroup && config.ANTI_LINK) {
    const grp = Groups.get(chatJid);
    if (grp?.antilink && !hasAccess(senderJid, 'sudo')) {
      const linkRegex = /(?:https?:\/\/)?(?:www\.)?(?:chat\.whatsapp\.com|wa\.me)\/\S+/gi;
      if (linkRegex.test(text)) {
        await sock.sendMessage(chatJid, { text: '❌ *Liens WhatsApp interdits* dans ce groupe.', delete: m.key });
        return;
      }
    }
  }

  if (isGroup && text && !text.startsWith(config.PREFIX)) {
    try {
      const handled = await robloxHook(sock, m, text, chatJid, isGroup);
      if (handled) return;
    } catch {}
  }

  const parsed = parseCommand(text, config.PREFIX);
  if (!parsed) return;

  const { command, args, text: argText } = parsed;

  const cmdValidation = validateCommand(command, args);
  if (!cmdValidation.safe) {
    log.debug({ command, reason: cmdValidation.reason }, 'Commande invalide');
    return;
  }

  const privilege = getPrivilege(senderJid);
  if (privilege === 'user') {
    const rl = checkRateLimit(senderJid);
    if (!rl.allowed) {
      if (rl.reason === 'RATE_LIMIT_EXCEEDED') {
        await sendError(sock, m, 'Trop de commandes envoyées. Patiente quelques secondes.');
      }
      return;
    }
  }

  if (!isModeAllowed(m)) {
    log.debug({ mode: config.MODE, sender: senderJid }, 'Mode ne permet pas cette commande');
    return;
  }

  const plugin = getPlugin(command);
  if (!plugin) return;

  const required = plugin.level || 'user';
  if (!hasAccess(senderJid, required)) {
    await sendError(sock, m,
      required === 'owner' ? 'Commande réservée au propriétaire.' :
      required === 'sudo'  ? 'Commande réservée aux administrateurs du bot.' :
      'Accès refusé.'
    );
    return;
  }

  log.info({ command, sender: senderJid, chat: chatJid, privilege }, `.${command}`);

  try {
    await plugin.handler(sock, m, {
      args,
      text: argText,
      prefix: config.PREFIX,
      config,
      isGroup,
      privilege,
    });

    if (config.AUTO_REACT && m.key?.id) {
      sock.sendMessage(chatJid, { react: { text: '✅', key: m.key } }).catch(() => {});
    }

    incrementCmd(command);
  } catch (err) {
    log.error({ err, command, sender: senderJid }, `Erreur dans le plugin .${command}`);
    if (config.AUTO_REACT && m.key?.id) {
      sock.sendMessage(chatJid, { react: { text: '❌', key: m.key } }).catch(() => {});
    }
    await sendError(sock, m, 'Une erreur est survenue. Réessaie ou contacte l\'admin.');
  }
}

export { handleMessage as msgHandler };

export function clearGroupCache() {
  GROUP_SETTINGS_CACHE.clear();
}
