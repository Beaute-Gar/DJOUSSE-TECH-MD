import { parseCommand } from '../security/validator.js';
import { resolveCommand } from './loader.js';
import { createLogger } from './logger.js';
import { getPlugin } from './loader.js';

const log = createLogger('AGENT');
const PREFIX = process.env.PREFIX || '.';
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;

const convMemory = new Map();
const MAX_HISTORY = 10;

function getHistory(jid) {
  if (!convMemory.has(jid)) convMemory.set(jid, []);
  return convMemory.get(jid);
}

export function clearMemory(jid) { convMemory.delete(jid); }

async function geminiRequest(body) {
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY non configurée');
  const { default: axios } = await import('axios');
  const res = await axios.post(GEMINI_URL, body, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 15_000,
  });
  return res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '(pas de réponse)';
}

export async function geminiQuery(prompt) {
  return geminiRequest({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 800, temperature: 0.7 },
  });
}

export async function geminiChat(jid, message) {
  const history = getHistory(jid);
  history.push({ role: 'user', parts: [{ text: message }] });
  const body = {
    contents: [
      { role: 'user', parts: [{ text: 'Tu es DTE Bot, assistant WhatsApp créé par DJOUSSE TECH EVOLUTION au Cameroun. Réponds en français, concis (< 600 car.).' }] },
      ...history.slice(-MAX_HISTORY),
    ],
    generationConfig: { maxOutputTokens: 600, temperature: 0.7 },
  };
  const reply = await geminiRequest(body);
  history.push({ role: 'model', parts: [{ text: reply }] });
  if (history.length > MAX_HISTORY * 2) convMemory.set(jid, history.slice(-MAX_HISTORY));
  return reply;
}

export async function detectIntent(ctx, prefix = PREFIX) {
  if (!ctx.cleanText || ctx.aborted) { ctx.intent = 'ignore'; return; }
  if (ctx.cleanText.startsWith(prefix)) {
    const parsed = parseCommand(ctx.cleanText, prefix);
    if (parsed) { ctx.intent = 'command'; ctx.command = parsed.command; ctx.args = parsed.args; ctx.body = parsed.text; return; }
  }
  if (ctx.isGroup && !ctx.cleanText.startsWith(prefix)) { ctx.intent = 'ignore'; return; }
  if (GEMINI_KEY && !ctx.isGroup) {
    try {
      const lower = ctx.cleanText.toLowerCase();
      if (/^(salut|bonjour|hey|coucou|merci|quoi|qui|comment|pourquoi|combien|peux-tu|aide)/.test(lower)) {
        ctx.intent = 'question'; return;
      }
    } catch {}
  }
  ctx.intent = ctx.isGroup ? 'ignore' : (GEMINI_KEY ? 'question' : 'ignore');
}

export async function agentAnswer(ctx) {
  const { m } = ctx;
  try {
    await m.react('🤔');
    const reply = await geminiChat(ctx.senderJid, ctx.cleanText);
    await m.react('✅');
    await m.reply(`🤖 *DTE AI*\n\n${reply}`);
  } catch (err) {
    await m.react('❌');
    await m.reply(`❌ Erreur : ${err.message}`);
  }
}

export async function agentTask(ctx) {
  const { m } = ctx;
  try {
    await m.react('⚙️');
    if (!GEMINI_KEY) {
      await m.reply('❌ Clé Gemini requise pour le mode tâche.');
      return;
    }
    const prompt = `Décompose cette tâche en étapes simples:\n"${ctx.cleanText}"\n\nRéponds en français en 3-5 étapes, chaque étape commençant par "- ".`;
    const plan = await geminiQuery(prompt);
    const toolMatch = plan.match(/\[OUTIL:\s*(\w+)\]/g);
    let result = `📋 *Plan de tâche*\n\n${plan}`;
    if (toolMatch) {
      for (const match of toolMatch) {
        const cmdName = match.replace(/\[OUTIL:\s*(\w+)\]/, '$1');
        const resolved = resolveCommand(cmdName);
        if (resolved) result += `\n\n✅ OUTIL \`${cmdName}\` disponible`;
        else result += `\n\n❌ OUTIL \`${cmdName}\` inconnu`;
      }
    }
    await m.reply(result);
  } catch (err) {
    await m.react('❌');
    await m.reply(`❌ Tâche échouée : ${err.message}`);
  }
}

export async function agentAuto(ctx) {
  log.info(`Auto agent pour ${ctx.senderJid}: "${ctx.cleanText.substring(0, 100)}"`);
}
