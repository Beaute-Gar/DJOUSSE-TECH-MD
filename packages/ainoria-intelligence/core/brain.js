import { createLogger } from '../../infrastructure/logger.js';
import * as gm from '../../capabilities/groups/group-manager.js';

const log = createLogger('BRAIN');

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'openai/gpt-oss-120b';

const MAX_TOKENS_MEMORY = 8000;
const MAX_REPLY_TOKENS = 1024;
const MAX_RETRY = 5;
const BASE_RETRY_DELAY = 3000;

const convMemory = new Map();

function estimateTokens(text = '') {
  return Math.ceil(text.length / 4);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function getHistory(jid) {
  if (!convMemory.has(jid)) convMemory.set(jid, []);
  return convMemory.get(jid);
}

function addToHistory(jid, role, content) {
  const h = getHistory(jid);
  h.push({ role, content });
  let total = h.reduce((sum, m) => sum + estimateTokens(m.content), 0);
  while (total > MAX_TOKENS_MEMORY && h.length > 2) {
    const removed = h.shift();
    total -= estimateTokens(removed.content);
  }
}

export function clearMemory(jid) {
  convMemory.delete(jid);
}

export function getMemoryForJid(jid) {
  const h = getHistory(jid);
  return {
    messages: h.length,
    tokens: h.reduce((s, m) => s + estimateTokens(m.content), 0),
    maxTokens: MAX_TOKENS_MEMORY,
  };
}

export function getAllMemoryStats() {
  const totalTokens = [...convMemory.values()]
    .flat()
    .reduce((s, m) => s + estimateTokens(m.content), 0);
  return {
    conversations: convMemory.size,
    totalMessages: [...convMemory.values()].reduce((a, h) => a + h.length, 0),
    totalTokens,
    maxMemoryTokens: MAX_TOKENS_MEMORY,
  };
}

export const ASSISTANT_PROMPT = process.env.BRAIN_PROMPT ||
  `Tu es DJOUSSE TECH, un pote hyper enthousiaste, drole et energyque qui discute sur WhatsApp.
Tu reponds TOUJOURS avec humour, bonne humeur et plein d'energie.
Ta personnalite : chaleureux, blagueur, taquin, toujours positif.
Tu utilises de l'argot (mdr, ptdr, tkt, wesh, bg, sah) et des emojis.
Tu es bref et percutant : max 3-4 phrases, toujours pertinent.
Tu aides les autres : conseils, analyse, redaction, calcul, traduction, tout.
Tu gardes le contexte de la conversation en memoire.
REGLES ABSOLUES :
- Ne dis JAMAIS que tu es une IA, un bot, un assistant ou un modele.
- Si on te demande qui tu es, dis que tu es DJOUSSE TECH, un ami.
- Ne dis JAMAIS que tu es un modele Llama, Groq, ou autre.
- N'ecris JAMAIS "Je n'ai pas grand chose a dire" — trouve toujours quelque chose.
- Tu es un humain, point final.
Termine parfois par une question ou une vanne pour relancer.`;

export const SUMMARY_PROMPT =
  `Analyse cette conversation WhatsApp et produis un resume structure en francais avec :
- Les sujets principaux abordes
- Les decisions prises si applicable
- Les actions a suivre / taches mentionnees
- L ambiance generale du groupe
Sois concis et factuel. Ne dis pas que tu es une IA ou un bot.`;

async function askGroqStream(systemPrompt, userMessage, history = [], attempt = 1) {
  if (!GROQ_API_KEY) {
    return 'Configuration incomplete, contacte l administrateur.';
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userMessage },
  ];

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: 1,
        max_completion_tokens: MAX_REPLY_TOKENS,
        top_p: 1,
        stream: true,
        stop: null,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();

      if (res.status === 429 && attempt <= MAX_RETRY) {
        const retryAfter = parseInt(res.headers.get('retry-after') || '0') * 1000;
        const delay = retryAfter || BASE_RETRY_DELAY * Math.pow(2, attempt - 1);
        log.warn(`Rate limit — attente ${delay}ms (${attempt}/${MAX_RETRY})`);
        await sleep(delay);
        return askGroqStream(systemPrompt, userMessage, history, attempt + 1);
      }

      if (res.status >= 500 && attempt <= MAX_RETRY) {
        const delay = BASE_RETRY_DELAY * attempt;
        log.warn(`Serveur down — retry dans ${delay}ms`);
        await sleep(delay);
        return askGroqStream(systemPrompt, userMessage, history, attempt + 1);
      }

      log.error(`Erreur Groq ${res.status}: ${errText}`);
      return `Je suis un peu fatigue la, reessaie dans un instant.`;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const json = JSON.parse(trimmed.slice(6));
          const delta = json.choices?.[0]?.delta?.content || '';
          fullResponse += delta;
        } catch (_) {}
      }
    }

    return fullResponse.trim() || 'Je n ai pas pu repondre, reessaie.';
  } catch (e) {
    if (attempt <= MAX_RETRY) {
      const delay = BASE_RETRY_DELAY * attempt;
      log.warn(`Erreur réseau — retry ${attempt}/${MAX_RETRY} dans ${delay}ms : ${e.message}`);
      await sleep(delay);
      return askGroqStream(systemPrompt, userMessage, history, attempt + 1);
    }
    log.error(`Échec définitif après ${MAX_RETRY} tentatives: ${e.message}`);
    return 'Je n arrive pas a repondre pour le moment, reessaie plus tard.';
  }
}

export async function askGroq(systemPrompt, userMessage, history = []) {
  return askGroqStream(systemPrompt, userMessage, history);
}

const personalityMode = { current: 'eq' };

const SENTIMENT_CACHE = new Map();

export async function analyzeSentimentML(text) {
  if (!text || text.length < 3) return { sentiment: 'neutral', score: 50, label: 'Neutre' };
  const key = text.slice(0, 100);
  const cached = SENTIMENT_CACHE.get(key);
  if (cached && Date.now() - cached.ts < 300000) return cached.value;
  if (!GROQ_API_KEY) {
    const s = { sentiment: 'neutral', score: 50, label: 'Neutre' };
    SENTIMENT_CACHE.set(key, { value: s, ts: Date.now() });
    return s;
  }
  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: 'Analyse le sentiment du message. Réponds UNIQUEMENT par un JSON: {"sentiment":"positif|negatif|neutre","score":0-100,"label":"court résumé"}. Pas d\'autres texte.' },
          { role: 'user', content: text.slice(0, 500) },
        ],
        temperature: 0.1,
        max_completion_tokens: 100,
      }),
    });
    if (!res.ok) return { sentiment: 'neutral', score: 50, label: 'Neutre' };
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(reply.replace(/```json|```/g, '').trim());
    const result = {
      sentiment: parsed.sentiment || 'neutral',
      score: Math.max(0, Math.min(100, parsed.score || 50)),
      label: parsed.label || 'Neutre',
    };
    SENTIMENT_CACHE.set(key, { value: result, ts: Date.now() });
    return result;
  } catch {
    return { sentiment: 'neutral', score: 50, label: 'Neutre' };
  }
}

export function setPersonalityMode(mode) {
  const modes = ['eq','energie','doux','humour','formel','poete'];
  if (!modes.includes(mode)) return false;
  personalityMode.current = mode;
  return true;
}

export function getPersonalityMode() { return personalityMode.current; }

const PERSONALITY_PROMPTS = {
  eq:      '',
  energie: '\nPersonnalite actuelle : ENERGIQUE — Reponds avec enthousiasme, dynamisme, phrases courtes et percutantes, beaucoup d\'emojis.',
  doux:    '\nPersonnalite actuelle : DOUX — Reponds avec douceur, bienveillance et empathie. Sois rassurant et chaleureux.',
  humour:  '\nPersonnalite actuelle : HUMOUR — Reponds avec humour, legerete et jeux de mots. Fais rire le destinataire.',
  formel:  '\nPersonnalite actuelle : FORMEL — Reponds de facon formelle, structuree et precise. Langage soutenu.',
  poete:   '\nPersonnalite actuelle : POETE — Reponds de facon poetique et lyrique. Utilise des metaphores.',
};

function buildPrompt() {
  return ASSISTANT_PROMPT + (PERSONALITY_PROMPTS[personalityMode.current] || '');
}

export async function brainChat(jid, message) {
  const history = getHistory(jid);
  addToHistory(jid, 'user', message);
  const reply = await askGroqStream(buildPrompt(), message, history.slice());
  addToHistory(jid, 'assistant', reply);
  return reply;
}

export async function brainChatWithContext(jid, message, groupJid) {
  const isActive = gm.isGroupActivated(groupJid);
  let systemPrompt = buildPrompt();

  if (isActive && groupJid) {
    const info = gm.getGroupInfo(groupJid);
    if (info && info.prompt) {
      systemPrompt = info.prompt + (PERSONALITY_PROMPTS[personalityMode.current] || '');
    }
  }

  const history = getHistory(jid);
  addToHistory(jid, 'user', message);
  const reply = await askGroqStream(systemPrompt, message, history.slice());
  addToHistory(jid, 'assistant', reply);

  if (isActive && groupJid) {
    gm.updateTrustScore(groupJid, jid, 1);
  }

  return reply;
}

export async function brainSummarize(jid, rawMessages) {
  const messages = rawMessages?.length ? rawMessages : getHistory(jid).filter(m => m.role === 'user').map(m => m.content);
  const text = messages.slice(-30).join('\n');
  if (!text) return '📭 Pas assez de messages en memoire pour un resume (minimum 5).';
  return await askGroqStream(SUMMARY_PROMPT, `Messages recents :\n${text}`);
}

export function activateBrain(sock) {
  log.info(`🧠 Systeme actif — ${MAX_RETRY} retry | ${MAX_TOKENS_MEMORY} tokens memoire | group-manager charge`);
}

export { gm as groupManager };
