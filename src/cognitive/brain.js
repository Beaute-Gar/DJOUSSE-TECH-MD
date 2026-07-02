import { createLogger } from '../core/logger.js';
import { bus, EVENTS } from './event-bus.js';

const log = createLogger('BRAIN');

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama3-8b-8192';

const MAX_HISTORY = 10;
const convMemory = new Map();

function getHistory(jid) {
  if (!convMemory.has(jid)) convMemory.set(jid, []);
  return convMemory.get(jid);
}

function addToHistory(jid, role, content) {
  const h = getHistory(jid);
  h.push({ role, content });
  if (h.length > MAX_HISTORY * 2) h.splice(0, 2);
}

export function clearMemory(jid) {
  convMemory.delete(jid);
}

export function getAllMemoryStats() {
  return {
    conversations: convMemory.size,
    totalMessages: [...convMemory.values()].reduce((a, h) => a + h.length, 0),
  };
}

export const ASSISTANT_PROMPT = process.env.BRAIN_PROMPT ||
  `Tu es DJOUSSE TECH Cognitive OS, un assistant IA intelligent integré a WhatsApp.
Cree par DJOUSSE TECH pour aider les utilisateurs africains.
Reponds TOUJOURS en francais, concis (max 3 paragraphes).
Tu peux analyser, conseiller, rediger, resumer, traduire, calculer.
Tu gardes le contexte de la conversation.
Termine parfois par une question ou suggestion pertinente.
Utilise les emojis avec moderation.`;

export const SUMMARY_PROMPT =
  `Tu es DJOUSSE TECH Cognitive OS, specialise dans l'analyse de conversations WhatsApp.
Analyse le dump de conversation fourni et produis un resume structure en francais avec :
- Les sujets principaux abordes
- Les decisions prises (si applicable)
- Les actions a suivre / taches mentionnees
- L'ambiance generale du groupe
Sois concis et factuel. Format : texte clair avec emojis.`;

function groqUrl() {
  return `https://api.groq.com/openai/v1/chat/completions`;
}

export async function askGroq(systemPrompt, userMessage, history = []) {
  if (!GROQ_API_KEY) {
    return '⚠️ Cle GROQ_API_KEY manquante dans .env\nClé gratuite sur https://console.groq.com';
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userMessage },
  ];

  try {
    const { default: axios } = await import('axios');
    const res = await axios.post(GROQ_URL, {
      model: GROQ_MODEL,
      messages,
      max_tokens: 1024,
      temperature: 0.7,
    }, {
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 15_000,
    });

    const data = res.data;
    return data.choices?.[0]?.message?.content?.trim() || '🤖 Pas de reponse.';
  } catch (e) {
    log.error('Groq error: ' + e.message);
    return '🤖 Le moteur IA est temporairement indisponible.';
  }
}

export async function brainChat(jid, message) {
  const history = getHistory(jid);
  addToHistory(jid, 'user', message);
  const reply = await askGroq(ASSISTANT_PROMPT, message, history.slice(-MAX_HISTORY * 2));
  addToHistory(jid, 'assistant', reply);
  return reply;
}

export async function brainSummarize(jid, rawMessages) {
  const text = rawMessages.join('\n');
  if (!text) return '📭 Pas assez de messages pour un resume.';
  return await askGroq(SUMMARY_PROMPT, `Voici les messages recents :\n${text}`);
}

export function activateBrain(sock) {
  log.info('🧠 Cognitive OS IA active — Moteur : Groq Llama 3');
  bus.emit('brain:activated', { provider: 'groq', model: GROQ_MODEL });
}
