import { buildCtx, runMiddlewares, MIDDLEWARE_STACK } from '../../infrastructure/middleware.js';
import { detectIntent } from './agent.js';
import { resolveCommand, commandCount } from '../../infrastructure/loader.js';
import { checkPermission, denyMessage, getPrivilege } from '../../infrastructure/security/auth.js';
import { checkCommandCooldown } from '../../infrastructure/security/rateLimit.js';
import { createLogger } from '../../infrastructure/logger.js';
import { createRequire } from 'module';
import { CommunityManager, trackBotMessage, isBotOwnMessage } from '../agents/communication-agent.js';
import { normalizeCommand, sanitizeInput } from '../../infrastructure/deploy/v2.2-patch.js';

const require = createRequire(import.meta.url);
const config = require('../../../config.cjs');

export const cm = new CommunityManager();

const log = createLogger('HANDLER');
const PREFIX = process.env.PREFIX || '.';
let _ultima = null;
let _suggest = null;

async function _getUltima() {
  if (_ultima) return _ultima;
  try {
    const { getServices } = await import('./djousse-init.js');
    const { UltimaOrchestrator } = await import('../../../src/ultima/ultima-orchestrator.js');
    const svc = getServices();
    _ultima = new UltimaOrchestrator(svc.llmService, svc.vfsService, svc.dbService, svc.learningLoop, svc.contextOptimizer);
    log.info('Ultima orchestrateur initialisé');
  } catch (err) {
    log.warn(`Ultima non disponible: ${err.message}`);
  }
  return _ultima;
}

export async function handleMessage(m, sock) {
  if (!m?.message) return;

  // ─── Group Selector : ignorer si le chat n'est pas autorisé ──
  const jid = m.key?.remoteJid;
  if (jid) {
    try {
      if (!jid.endsWith('@g.us') && !jid.includes('@s.whatsapp.net')) { /* skip non-chat */ }
      else {
        const { GroupSelector } = await import('../../packages/core/group-selector.js');
        if (!GroupSelector.canRespond(jid)) return;
      }
    } catch {}
  }

  const ctx = buildCtx(m, sock);

  await runMiddlewares(ctx, MIDDLEWARE_STACK);
  if (ctx.aborted) return;

  await checkChatbotTriggers(ctx);
  if (ctx.aborted) return;

  await detectIntent(ctx, PREFIX);
  if (!ctx.intent || ctx.intent === 'ignore') return;

  switch (ctx.intent) {
    case 'command': return _routeCommand(ctx);
    case 'question': return _routeQuestion(ctx);
    case 'task': return _routeTask(ctx);
    case 'auto': return _routeAuto(ctx);
  }
}

const DANGER_PATTERNS = ['promoteall', 'demoteall', 'kickall', 'kickall2', 'bomb'];

async function _routeCommand(ctx) {
  const { command, args, body, m } = ctx;
  if (DANGER_PATTERNS.includes(command?.toLowerCase())) {
    await m.reply('⚠️ Cette commande est dangereuse et a été désactivée pour protéger votre compte WhatsApp.');
    return;
  }
  const resolved = resolveCommand(command);
  if (!resolved) {
    await m.reply(`\u2753 Commande inconnue. \nTape *${PREFIX}menu* pour voir les ${commandCount()} commandes.`);
    return;
  }
  const { handler, meta } = resolved;
    const perm = await checkPermission(ctx.senderJid, meta, { isGroup: ctx.isGroup, isGroupAdmin: ctx.isGroupAdmin, botIsAdmin: ctx.botIsAdmin });
  if (!perm.allowed) { await m.reply(denyMessage(perm.reason)); return; }
  if (meta.cooldown > 0) {
    const cd = checkCommandCooldown(ctx.senderJid, command, meta.cooldown * 1000);
    if (!cd.allowed) { await m.reply(`\u23F3 Attends ${cd.retryAfter}s.`); return; }
  }
  try {
    await m.react('\u23F3');
    log.info(`CMD ${ctx.senderJid} \u2192 ${PREFIX}${command}`);
    const privilege = getPrivilege(ctx.senderJid);
    await handler(ctx.sock, m, { ...ctx, prefix: PREFIX, config, privilege, reply: m.reply.bind(m), sender: ctx.senderJid, isQuoted: m.isQuoted, quotedMsg: m.quotedMsg });
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
    const jid = ctx.senderJid;
    const groupJid = ctx.isGroup ? ctx.jid : null;
    const ultima = await _getUltima();
    let reply;
    if (ultima && ctx.cleanText.length > 20) {
      const context = { isGroup: ctx.isGroup, groupJid, senderJid: ctx.senderJid, recentMessages: ctx.cleanText };
      const result = await ultima.orchestrateIntent(jid, ctx.cleanText, context);
      reply = result.result?.summary || result.result?.response || null;
    }
    if (!reply) {
      const { brainChatWithContext, brainChat, groupManager } = await import('./brain.js');
      if (ctx.isGroup && groupManager.isGroupActivated(groupJid)) {
        const analysis = groupManager.analyzeMessage(ctx.cleanText, groupJid, ctx.senderJid);
        if (analysis.risk >= 70) {
          const meta = await ctx.sock.groupMetadata(groupJid).catch(() => null);
          const admins = meta?.participants?.filter(p => p.admin) || [];
          const adminMentions = admins.map(a => `@${a.id.split('@')[0]}`).join(' ');
          await ctx.sock.sendMessage(groupJid, {
            text: `🚨 *Alerte modération*\nRisque: ${analysis.risk}%\nRaison: ${analysis.reasons.join(', ')}\nDe: @${ctx.senderJid.split('@')[0]}\nMessage: ${ctx.cleanText.slice(0, 200)}\n\n${adminMentions}`,
            mentions: admins.map(a => a.id),
          });
          groupManager.updateTrustScore(groupJid, ctx.senderJid, -20);
          return;
        } else if (analysis.risk >= 40) {
          groupManager.updateTrustScore(groupJid, ctx.senderJid, -5);
        }
        reply = await brainChatWithContext(jid, ctx.cleanText, groupJid);
      } else {
        reply = await brainChat(jid, ctx.cleanText);
      }
    }
    await ctx.m.react('\u2705');
    await ctx.m.reply(reply);
  } catch (err) {
    log.error(`Question: ${err.message}`);
    const { agentAnswer } = await import('./agent.js');
    try { await agentAnswer(ctx); } catch {}
  }
}

async function _routeTask(ctx) {
  const ultima = await _getUltima();
  if (ultima) {
    try {
      await ctx.m.react('\u2699\uFE0F');
      const context = { isGroup: ctx.isGroup, senderJid: ctx.senderJid, recentMessages: ctx.cleanText };
      const result = await ultima.orchestrateIntent(ctx.senderJid, ctx.cleanText, context);
      const reply = result.result?.summary || result.result?.response || JSON.stringify(result.result);
      await ctx.m.react('\u2705');
      await ctx.m.reply(reply);
      return;
    } catch (err) {
      log.warn(`Ultima tâche: ${err.message}`);
    }
  }
  const { agentTask } = await import('./agent.js');
  try { await ctx.m.react('\u2699\uFE0F'); await agentTask(ctx); }
  catch (err) { await ctx.m.reply(`\u274C T\u00e2che: ${err.message}`); await ctx.m.react('\u274C'); }
}

function _detectFromText(text) {
  const t = text.toLowerCase().trim();
  if (/n'oublie|rappelle-moi|souviens-toi|rappel/i.test(t)) return { type: 'rappel', confidence: 0.8 };
  if (/avant\s+(\d{1,2})[\s/](\d{1,2})|deadline|échéance|limite/i.test(t)) return { type: 'deadline', confidence: 0.8 };
  if (/promets?|je (te )?jure|compte sur moi/i.test(t)) return { type: 'promesse', confidence: 0.7 };
  if (/je (vais )?(créer|faire|préparer|envoyer)/i.test(t) && /(dossier|doc|fichier|rapport)/i.test(t)) return { type: 'tache', confidence: 0.7 };
  if (t.includes('traduis') || t.includes('traduction') || t.includes('en français') || t.includes('en anglais')) return { type: 'traduction', confidence: 0.9 };
  if (t.length > 100 && t.includes('?')) return { type: 'resume', confidence: 0.5 };
  return null;
}

async function _routeAuto(ctx) {
  const detection = _detectFromText(ctx.cleanText);
  if (!_suggest) {
    const { getAutoSuggest } = await import('./auto-suggest.js');
    _suggest = getAutoSuggest();
  }
  if (detection) {
    detection.text = ctx.cleanText;
    const decision = await _suggest.evaluate(ctx.senderJid, detection);
    switch (decision.action) {
      case 'EXECUTE_SILENTLY':
        return;
      case 'SUGGEST':
        await ctx.m.reply(decision.message);
        return;
      case 'SILENCE':
        break;
    }
  }
  const { agentAuto } = await import('./agent.js');
  try { await agentAuto(ctx); } catch {}
}

async function checkChatbotTriggers(ctx) {
  try {
    const { default: db } = await import('../../infrastructure/database/database.js');
    const text = ctx.cleanText || ctx.text;
    if (!text) return;

    const flows = await db.all('SELECT id, name, match_logic FROM chatbot_flows WHERE active = 1');
    for (const flow of flows) {
      const triggers = await db.all('SELECT id, type, pattern, match_all FROM chatbot_triggers WHERE flow_id = ?', flow.id);
      if (!triggers.length) continue;

      let matched = false;
      let matchedCount = 0;
      for (const t of triggers) {
        let hit = false;
        const lowerText = text.toLowerCase();
        const lowerPattern = t.pattern.toLowerCase();
        switch (t.type) {
          case 'exact': hit = lowerText === lowerPattern; break;
          case 'contains': hit = lowerText.includes(lowerPattern); break;
          case 'keyword': hit = lowerText.split(/\s+/).some(w => w === lowerPattern); break;
          case 'regex': try { hit = new RegExp(t.pattern, 'i').test(text); } catch(e) {} break;
        }
        if (hit) {
          matchedCount++;
          if (flow.match_logic === 'all' && !t.match_all) continue;
          matched = true;
        }
      }
      if (flow.match_logic === 'all' && matchedCount < triggers.length) matched = false;
      if (flow.match_logic === 'any' && matchedCount === 0) matched = false;

      if (matched) {
        const responses = await db.all('SELECT id, type, content FROM chatbot_responses WHERE flow_id = ? ORDER BY priority DESC', flow.id);
        if (responses.length) {
          const response = responses[0];
          let replyText = response.content;
          try { const p = JSON.parse(response.content); replyText = p.text || p.body || response.content; } catch(e) {}
          if (replyText) {
            await ctx.sock.sendMessage(ctx.jid, { text: replyText });
            await db.run('INSERT INTO chatbot_logs (flow_id, trigger_id, jid, input, response, created_at) VALUES (?,?,?,?,?,?)', flow.id, triggers[0]?.id || null, ctx.jid, text, replyText, Date.now());
          }
        }
        ctx.aborted = true;
        return;
      }
    }
  } catch (e) {
    console.error('[Chatbot] Error:', e.message);
  }
}
