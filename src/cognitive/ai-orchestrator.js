import { createLogger } from '../core/logger.js';
import { bus, EVENTS } from './event-bus.js';
import { getContext } from './context-engine.js';
import { recallLongTerm } from './memory-engine.js';
import { getPerson } from './identity-engine.js';

const log = createLogger('ORCHESTRATOR');

const MODELS = {
  gemini: {
    name: 'gemini-2.0-flash',
    key: () => process.env.GEMINI_API_KEY,
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
    available: () => !!process.env.GEMINI_API_KEY,
  },
  openai: {
    name: 'gpt-4o-mini',
    key: () => process.env.OPENAI_API_KEY,
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    available: () => !!process.env.OPENAI_API_KEY,
  },
};

const TASK_ROUTING = {
  conversation: { model: 'gemini', priority: 1, systemPrompt: 'Assistant amical et concis.' },
  analysis:     { model: 'gemini', priority: 2, systemPrompt: 'Analyse en profondeur, reponse detaillee.' },
  reasoning:    { model: 'gemini', priority: 3, systemPrompt: 'Raisonnement logique etape par etape.' },
  vision:       { model: 'gemini', priority: 1, systemPrompt: 'Decris l image en details.' },
  translation:  { model: 'gemini', priority: 1, systemPrompt: 'Traduis fidelement le texte.' },
  summary:      { model: 'gemini', priority: 2, systemPrompt: 'Resume de facon concise.' },
  extraction:   { model: 'gemini', priority: 2, systemPrompt: 'Extrais les informations cle.' },
  code:         { model: 'gemini', priority: 3, systemPrompt: 'Assistant code, reponses techniques.' },
  planning:     { model: 'gemini', priority: 3, systemPrompt: 'Planifie et decompose les taches.' },
  creative:     { model: 'gemini', priority: 2, systemPrompt: 'Creatif et inspire.' },
};

const GENERATION_CONFIG = { maxOutputTokens: 800, temperature: 0.7 };

let activeRequests = 0;
const MAX_CONCURRENT = 5;
const requestQueue = [];

export async function query(taskType, prompt, opts = {}) {
  const routing = TASK_ROUTING[taskType] || TASK_ROUTING.conversation;
  const modelName = opts.model || routing.model;
  const model = MODELS[modelName];
  if (!model || !model.available()) {
    const fallback = Object.values(MODELS).find(m => m.available());
    if (!fallback) throw new Error('Aucun modele IA disponible');
    log.warn(`Modele ${modelName} indisponible, fallback vers ${fallback.name}`);
    return _executeQuery(fallback, routing.systemPrompt, prompt, opts);
  }
  return _executeQuery(model, routing.systemPrompt, prompt, opts);
}

async function _executeQuery(model, systemPrompt, prompt, opts) {
  if (activeRequests >= MAX_CONCURRENT) {
    return new Promise((resolve, reject) => {
      requestQueue.push({ model, systemPrompt, prompt, opts, resolve, reject });
    });
  }
  activeRequests++;
  try {
    const key = model.key();
    if (!key) throw new Error(`Cle API manquante pour ${model.name}`);
    const { default: axios } = await import('axios');
    const gc = opts.generationConfig || GENERATION_CONFIG;
    const res = await axios.post(
      `${model.baseUrl}?key=${key}`,
      {
        contents: [{ parts: [{ text: `${systemPrompt}\n\n${prompt}` }] }],
        generationConfig: { ...gc, maxOutputTokens: opts.maxTokens || gc.maxOutputTokens },
      },
      { headers: { 'Content-Type': 'application/json' }, timeout: opts.timeout || 20_000 }
    );
    bus.emit('ai:query', { model: model.name, taskType: opts.taskType || 'unknown', promptLength: prompt.length });
    return res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '(pas de reponse)';
  } finally {
    activeRequests--;
    if (requestQueue.length > 0) {
      const next = requestQueue.shift();
      _executeQuery(next.model, next.systemPrompt, next.prompt, next.opts).then(next.resolve).catch(next.reject);
    }
  }
}

export async function answerWithContext(jid, message) {
  const context = getContext(jid);
  const person = await getPerson(jid);
  const memories = recallLongTerm(jid, message, 3);
  let contextBlock = '';
  if (context) {
    const s = context.getSummary();
    contextBlock = `Contexte: sentiment=${s.sentiment}, messages=${s.messageCount}, sujet=${s.topic || 'divers'}`;
  }
  const personBlock = person ? `Personne: ${person.name}` : '';
  const memoryBlock = memories.length > 0 ? `Souvenirs: ${memories.map(m => m.content.slice(0, 100)).join(' | ')}` : '';
  const prompt = [
    personBlock,
    contextBlock,
    memoryBlock,
    `Message: ${message}`,
    'Reponds en francais, de facon naturelle et concise.',
  ].filter(Boolean).join('\n');
  return query('conversation', prompt);
}

export function getQueueStats() {
  return { activeRequests, queued: requestQueue.length };
}
