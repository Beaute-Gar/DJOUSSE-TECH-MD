import { analyzeText } from './security/validator.js';
import { checkRateLimit, checkCommandCooldown } from './security/rateLimit.js';
import { getAuthLevel, isGroupAllowed, LEVEL } from './security/auth.js';
import { upsertUser, upsertGroup, addXP, getGroup, logMessage, isBanned } from './database/database.js';
import { isGroup as isGroupJid, cleanJid } from './database/utils.js';
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
  await next();
};

export const mwIgnoreBroadcast = async (ctx, next) => {
  if (ctx.jid.endsWith('@broadcast') && ctx.jid !== 'status@broadcast') { ctx.aborted = true; return; }
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
    await ctx.m.reply(`⏱️ Limité. Réessaie dans quelques secondes.`);
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
  if (ctx.authLevel >= LEVEL.SUDO) { await next(); return; }
  try {
    const { Warns } = await import('./database/database.js');
    const count = Warns.count(ctx.senderJid, ctx.jid) + 1;
    Warns.add(ctx.senderJid, ctx.jid, 'Lien interdit (anti-link)', ctx.sock.user?.id || 'bot');
    const warnMsg = `⚠️ @${ctx.senderJid.split('@')[0]} *Avertissement #${count}* : Envoi de lien interdit.`;
    if (count >= 3) {
      await ctx.m.reply(`${warnMsg}\n🚫 *3 avertissements → Exclusion.*`);
      try { await ctx.sock.groupParticipantsUpdate(ctx.jid, [ctx.senderJid], 'remove'); } catch {}
      Warns.reset(ctx.senderJid, ctx.jid);
    } else {
      await ctx.m.reply(warnMsg);
      try { await ctx.sock.sendMessage(ctx.jid, { delete: ctx.m.key }); } catch {}
    }
  } catch { await ctx.m.reply('🔗 Liens interdits dans ce groupe.'); try { await ctx.sock.groupParticipantsUpdate(ctx.jid, [ctx.senderJid], 'remove'); } catch {} }
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

export const mwSOCFlood = async (ctx, next) => {
  if (!ctx.isGroup || ctx.authLevel >= LEVEL.SUDO) { await next(); return; }
  try {
    const { groupManager } = await import('../../ainoria-intelligence/core/brain.js');
    if (!groupManager.isGroupActivated(ctx.jid)) { await next(); return; }
    if (groupManager.checkFlood(ctx.jid, ctx.senderJid)) {
      const meta = await ctx.sock.groupMetadata(ctx.jid).catch(() => null);
      const admins = meta?.participants?.filter(p => p.admin) || [];
      const warnMsg = `⚠️ @${ctx.senderJid.split('@')[0]} *Flood détecté* — Merci de ralentir (>7 messages/min).`;
      await ctx.m.reply(warnMsg);
      groupManager.updateTrustScore(ctx.jid, ctx.senderJid, -5);
      log.info(`[MW:SOC] Flood ${ctx.senderJid} dans ${ctx.jid}`);
      if (admins.length > 0) {
        ctx.sock.sendMessage(ctx.jid, {
          text: `🚨 *Flood*: @${ctx.senderJid.split('@')[0]} envoie trop de messages.`,
          mentions: [ctx.senderJid],
        }).catch(() => {});
      }
    }
  } catch {}
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

async function mwGuardian(ctx, next) {
  await next();
  if (!ctx.isGroup || !ctx.cleanText) return;
  try {
    const { estActifPourGroupe, extraireUrls, verifierLien, formaterAlerteLien } = await import('../core/misinformation-guardian.js');
    const actif = await estActifPourGroupe(ctx.jid);
    if (!actif) return;

    const urls = extraireUrls(ctx.cleanText);
    for (const url of urls) {
      const verdict = await verifierLien(url, ctx.jid);
      const alerte = verdict && formaterAlerteLien(verdict);
      if (alerte) {
        await ctx.sock.sendMessage(ctx.jid, { text: alerte });
        break;
      }
    }
  } catch (err) {
    log.warn(`[Guardian] ${err.message}`);
  }
}

async function mwSuiviProactif(ctx, next) {
  await next();
  if (!ctx.isGroup || !ctx.cleanText || !ctx.pushName) return;
  try {
    const { analyserMessagePourEngagement } = await import('../ainoria-intelligence/core/proactive-followup-engine.js');
    await analyserMessagePourEngagement(ctx.jid, ctx.cleanText, ctx.senderJid, ctx.pushName);
  } catch {}
}

export const MIDDLEWARE_STACK = [
  mwIgnoreSelf, mwIgnoreBroadcast, mwValidateText, mwRateLimit,
  mwGroupBan, mwUserBan, mwAuthLevel, mwDbUpsert, mwLoadGroup,
  mwAntiLink, mwAntiBot, mwSOCFlood, mwGuardian, mwSuiviProactif, mwLogger,
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
