import { analyzeText } from '../security/validator.js';
import { checkRateLimit, checkCommandCooldown } from '../security/rateLimit.js';
import { getAuthLevel, isGroupAllowed, LEVEL } from '../security/auth.js';
import { upsertUser, upsertGroup, addXP, getGroup, logMessage, isBanned } from '../lib/database.js';
import { isGroup as isGroupJid, cleanJid } from '../lib/utils.js';
import { createLogger } from './logger.js';

const log = createLogger('MW');
const LINK_RE = /(https?:\/\/[^\s]+|chat\.whatsapp\.com\/[^\s]+|t\.me\/[^\s]+)/i;

export async function runMiddlewares(ctx, middlewares) {
  let idx = 0;
  async function next() {
    if (ctx.aborted || idx >= middlewares.length) return;
    const mw = middlewares[idx++];
    try { await mw(ctx, next); }
    catch (err) { ctx.error = err; log.error(`[MW #${idx}] ${err.message}`); ctx.aborted = true; }
  }
  await next();
}

export function buildCtx(m, sock) {
  const jid = m.chatJid || m.key?.remoteJid || '';
  const senderJid = cleanJid(m.sender || jid);
  const isGroup = isGroupJid(jid);
  return {
    m, sock, jid, senderJid, isGroup,
    pushName: m.pushName || '',
    isGroupAdmin: m.isGroupAdmin || false,
    botIsAdmin: m.botIsAdmin || false,
    text: m.body || '',
    type: m.msgType || '',
    quoted: m.quotedMsg || null,
    mentionedJid: m.mentions || [],
    cleanText: '', textFlags: [], authLevel: LEVEL.USER, groupData: null,
    intent: null, command: null, args: [], body: m.body || '',
    aborted: false, skipAgent: false, error: null, startedAt: Date.now(),
  };
}

export const mwIgnoreSelf = async (ctx, next) => {
  if (ctx.m.fromMe) { ctx.aborted = true; return; }
  await next();
};

export const mwIgnoreBroadcast = async (ctx, next) => {
  if (ctx.jid.endsWith('@broadcast') || ctx.jid === 'status@broadcast') { ctx.aborted = true; return; }
  await next();
};

export const mwValidateText = async (ctx, next) => {
  const { flags, cleaned } = analyzeText(ctx.text);
  ctx.textFlags = flags; ctx.cleanText = cleaned;
  if (flags.includes('ZALGO') || flags.includes('CONTROL_CHARS')) {
    log.warn(`Input suspect ${ctx.senderJid} : ${flags}`);
    ctx.aborted = true; return;
  }
  await next();
};

export const mwRateLimit = async (ctx, next) => {
  const rl = checkRateLimit(ctx.senderJid);
  if (!rl.allowed) {
    if (rl.reason === 'HARD_BLOCK') { ctx.aborted = true; return; }
    if (rl.reason === 'SPAM_BLOCK') {
      await ctx.m.reply(`⏱️ Trop vite ! Attends *${rl.retryAfter}s*.`);
      ctx.aborted = true; return;
    }
    ctx.aborted = true; return;
  }
  await next();
};

export const mwGroupBan = async (ctx, next) => {
  if (ctx.isGroup && !isGroupAllowed(ctx.jid)) { ctx.aborted = true; return; }
  await next();
};

export const mwUserBan = async (ctx, next) => {
  if (isBanned(ctx.senderJid)) {
    await ctx.m.reply('🚫 Tu es banni du bot.');
    ctx.aborted = true; return;
  }
  await next();
};

export const mwAuthLevel = async (ctx, next) => {
  ctx.authLevel = getAuthLevel(ctx.senderJid);
  await next();
};

export const mwDbUpsert = async (ctx, next) => {
  try {
    upsertUser(ctx.senderJid, ctx.pushName);
    if (ctx.isGroup) upsertGroup(ctx.jid, ctx.m.groupMetadata?.subject || '');
    addXP(ctx.senderJid, 1);
  } catch (err) { log.error(`[MW:DbUpsert] ${err.message}`); }
  await next();
};

export const mwLoadGroup = async (ctx, next) => {
  if (ctx.isGroup) { try { ctx.groupData = getGroup(ctx.jid); } catch {} }
  await next();
};

export const mwAntiLink = async (ctx, next) => {
  if (!ctx.isGroup || !ctx.groupData?.antilink) { await next(); return; }
  if (!LINK_RE.test(ctx.cleanText)) { await next(); return; }
  if (ctx.isGroupAdmin || ctx.authLevel >= LEVEL.SUDO) { await next(); return; }
  await ctx.m.reply('🔗 Les liens sont interdits dans ce groupe.');
  try { await ctx.sock.groupParticipantsUpdate(ctx.jid, [ctx.senderJid], 'remove'); } catch {}
  log.info(`[MW:AntiLink] Lien de ${ctx.senderJid} dans ${ctx.jid}`);
  ctx.aborted = true;
};

export const mwAntiBot = async (ctx, next) => {
  if (!ctx.isGroup || !ctx.groupData?.antibot) { await next(); return; }
  const isBot = ctx.senderJid.includes(':');
  if (isBot && ctx.authLevel < LEVEL.SUDO) {
    try { await ctx.sock.groupParticipantsUpdate(ctx.jid, [ctx.senderJid], 'remove'); } catch {}
    ctx.aborted = true; return;
  }
  await next();
};

export const mwLogger = async (ctx, next) => {
  await next();
  const elapsed = Date.now() - ctx.startedAt;
  const intent = ctx.intent || 'unknown';
  const cmd = ctx.command || '';
  log.debug(`${ctx.senderJid} intent=${intent} cmd=${cmd} ${elapsed}ms`);
  setImmediate(async () => {
    try { await logMessage(ctx.senderJid, ctx.isGroup ? ctx.jid : null, intent, cmd || ctx.cleanText.substring(0, 200)); } catch {}
  });
};

export const MIDDLEWARE_STACK = [
  mwIgnoreSelf, mwIgnoreBroadcast, mwValidateText, mwRateLimit,
  mwGroupBan, mwUserBan, mwAuthLevel, mwDbUpsert, mwLoadGroup,
  mwAntiLink, mwAntiBot, mwLogger,
];

export function createCooldownMiddleware(command, cooldownMs) {
  return async (ctx, next) => {
    const cd = checkCommandCooldown(ctx.senderJid, command, cooldownMs);
    if (!cd.allowed) {
      await ctx.m.reply(`⏳ Attends encore ${cd.retryAfter}s.`);
      ctx.aborted = true; return;
    }
    await next();
  };
}

export function createAuthMiddleware(minLevel, errMsg) {
  return async (ctx, next) => {
    if (ctx.authLevel < minLevel) {
      await ctx.m.reply(errMsg || '❌ Permission refusée.');
      ctx.aborted = true; return;
    }
    await next();
  };
}

export const requireGroup = async (ctx, next) => {
  if (!ctx.isGroup) { await ctx.m.reply('👥 Cette action ne fonctionne qu\'en groupe.'); ctx.aborted = true; return; }
  await next();
};

export const requireDM = async (ctx, next) => {
  if (ctx.isGroup) { await ctx.m.reply('💬 Cette action ne fonctionne qu\'en message privé.'); ctx.aborted = true; return; }
  await next();
};
