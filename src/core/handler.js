import { buildCtx, runMiddlewares, MIDDLEWARE_STACK } from './middleware.js';
import { detectIntent } from './agent.js';
import { resolveCommand, commandCount } from './loader.js';
import { checkPermission, denyMessage } from '../security/auth.js';
import { checkCommandCooldown } from '../security/rateLimit.js';
import { createLogger } from './logger.js';

let _handleOSCommand;

const log = createLogger('HANDLER');
const PREFIX = process.env.PREFIX || '.';
const OS_PREFIX = '.OS';

export async function handleMessage(m, sock) {
  if (!m?.message) return;

  const ctx = buildCtx(m, sock);

  await runMiddlewares(ctx, MIDDLEWARE_STACK);
  if (ctx.aborted) return;

  /* ── .OS Command (Cognitive OS) ─────────────────────────── */
  const rawText = ctx.cleanText || ctx.text || '';
  if (rawText.toUpperCase().startsWith(OS_PREFIX)) {
    if (!_handleOSCommand) {
      try {
        const mod = await import('../cognitive/workspace/os-commands.js');
        _handleOSCommand = mod.handleOSCommand;
      } catch {
        log.warn('.OS commands not available');
        return;
      }
    }
    await _handleOSCommand(ctx, sock);
    return;
  }

  await detectIntent(ctx, PREFIX);
  if (!ctx.intent || ctx.intent === 'ignore') return;

  switch (ctx.intent) {
    case 'command': return _routeCommand(ctx);
    case 'question': return _routeQuestion(ctx);
    case 'task': return _routeTask(ctx);
    case 'auto': return _routeAuto(ctx);
  }
}

async function _routeCommand(ctx) {
  const { command, args, body, m } = ctx;
  const resolved = resolveCommand(command);
  if (!resolved) {
    await m.reply(`\u2753 Commande inconnue. \nTape *${PREFIX}menu* pour voir les ${commandCount()} commandes.`);
    return;
  }
  const { handler, meta } = resolved;
  const perm = checkPermission(ctx.senderJid, meta, { isGroup: ctx.isGroup, isGroupAdmin: ctx.isGroupAdmin, botIsAdmin: ctx.botIsAdmin });
  if (!perm.allowed) { await m.reply(denyMessage(perm.reason)); return; }
  if (meta.cooldown > 0) {
    const cd = checkCommandCooldown(ctx.senderJid, command, meta.cooldown * 1000);
    if (!cd.allowed) { await m.reply(`\u23F3 Attends ${cd.retryAfter}s.`); return; }
  }
  try {
    await m.react('\u23F3');
    log.info(`CMD ${ctx.senderJid} \u2192 ${PREFIX}${command}`);
    await handler(m, { ...ctx, prefix: PREFIX });
    await m.react('\u2705');
  } catch (err) {
    log.error(`Plugin ${command}: ${err.message}`);
    await m.reply(`\u274C Erreur: ${err.message}`);
    await m.react('\u274C');
  }
}

async function _routeQuestion(ctx) {
  try {
    await ctx.m.react('\uD83E\uDD14');
    const { answerWithContext } = await import('../cognitive/ai-orchestrator.js');
    const reply = await answerWithContext(ctx.senderJid, ctx.cleanText || ctx.text);
    await ctx.m.react('\u2705');
    await ctx.m.reply(`\uD83E\uDD16 *DTE AI*\n\n${reply}`);
  } catch (err) {
    log.error(`Question: ${err.message}`);
    const { agentAnswer } = await import('./agent.js');
    try { await agentAnswer(ctx); } catch {}
  }
}

async function _routeTask(ctx) {
  const { agentTask } = await import('./agent.js');
  try { await ctx.m.react('\u2699\uFE0F'); await agentTask(ctx); }
  catch (err) { await ctx.m.reply(`\u274C T\u00e2che: ${err.message}`); await ctx.m.react('\u274C'); }
}

async function _routeAuto(ctx) {
  const { agentAuto } = await import('./agent.js');
  try { await agentAuto(ctx); } catch {}
}
