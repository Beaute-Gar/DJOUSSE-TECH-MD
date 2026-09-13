// lib/ai.cjs — Moteur IA DJOUSSE TECH (Groq) — modèles officiels
// Chat/raisonnement: llama3-70b-8192 · Rapide: llama3-8b-8192
// Multilingue: mixtral-8x7b-32768 · Vision: llava-v1.5-7b-4096
// STT: whisper-large-v3 · TTS: Google (fr)
const axios = require('axios');
const { buildSystemPrompt } = require('./knowledge.cjs');

const GROQ_URL = 'https://api.groq.com/openai/v1';
/* Identité sûre du bot — toutes les réponses IA passent par ce filtre :
   réponses fiables sur DJOUSSE TECH + son créateur, sans jamais démasquer
   d'informations privées (numéro, mot de passe, secrets, API keys...). */
const DJOUSSE_PERSONA = buildSystemPrompt();
const MODELS = {
  chat: 'llama3-70b-8192',
  chatFast: 'llama3-8b-8192',
  reasoning: 'llama3-70b-8192',
  vision: 'llava-v1.5-7b-4096',
  multilingual: 'mixtral-8x7b-32768',
  safety: 'llama3-8b-8192',
  stt: 'whisper-large-v3'
};

/* ══ Retry & Error Handling ══ */
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY = 2000;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function classifyError(err) {
  const status = err?.response?.status || err?.status || 0;
  const msg = String(err?.message || err?.response?.data?.error?.message || '').toLowerCase();
  if (status === 429 || msg.includes('rate limit') || msg.includes('too many requests')) {
    return { type: 'rate_limit', retryable: true, userMsg: '⏳ Limite de requêtes atteinte. Réessaie dans quelques secondes.' };
  }
  if (msg.includes('quota') || msg.includes('billing') || msg.includes('payment')) {
    return { type: 'quota', retryable: false, userMsg: '💳 Quota IA épuisé. Contacte le propriétaire du bot.' };
  }
  if (status === 401 || msg.includes('invalid api key') || msg.includes('unauthorized')) {
    return { type: 'auth', retryable: false, userMsg: '🔑 Clé API invalide. Contacte le propriétaire.' };
  }
  if (status >= 500 || msg.includes('server error') || msg.includes('overloaded')) {
    return { type: 'server', retryable: true, userMsg: '🔧 Serveur IA temporairement indisponible. Réessaie bientôt.' };
  }
  if (msg.includes('timeout') || msg.includes('econnreset') || msg.includes('econnrefused')) {
    return { type: 'network', retryable: true, userMsg: '🌐 Erreur réseau. Vérifie ta connexion et réessaie.' };
  }
  if (msg.includes('context length') || msg.includes('maximum context') || msg.includes('token limit')) {
    return { type: 'context', retryable: false, userMsg: '📝 Message trop long. Raccourcis ta demande.' };
  }
  return { type: 'unknown', retryable: false, userMsg: '❌ Erreur IA inconnue. Réessaie plus tard.' };
}

function key() {
  return process.env.GROQ_API_KEY || process.env.AI_API_KEY || '';
}

async function groq(messages, { model, temperature = 0.7, maxTokens = 2048, json = false, timeout = 40000 } = {}) {
  const k = key();
  if (!k) throw new Error('GROQ_API_KEY manquante');

  const body = {
    model: model || MODELS.chat,
    messages,
    temperature,
    max_completion_tokens: maxTokens,
    top_p: 1,
    stream: false,
    stop: null
  };
  if (/reasoning/i.test(body.model)) body.reasoning_effort = 'medium';
  if (json) body.response_format = { type: 'json_object' };

  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const r = await axios.post(GROQ_URL + '/chat/completions', body, {
        headers: { Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' },
        timeout
      });
      const content = r.data?.choices?.[0]?.message?.content;
      return content ? String(content).trim() : '';
    } catch (err) {
      lastErr = err;
      const classified = classifyError(err);
      if (!classified.retryable || attempt === MAX_RETRIES) {
        err.userMessage = classified.userMsg;
        err.errorType = classified.type;
        throw err;
      }
      const retryAfter = parseInt(err?.response?.headers?.['retry-after'] || '0', 10) * 1000;
      const delay = retryAfter || BASE_RETRY_DELAY * Math.pow(2, attempt - 1);
      console.log(`⏳ Groq ${classified.type} (tentative ${attempt}/${MAX_RETRIES}), retry dans ${delay}ms...`);
      await sleep(delay);
    }
  }
  throw lastErr;
}

/** Chat principal — llama3-70b-8192 avec repli automatique (8b → mixtral → pollinations → prexzy) */
async function chat(text, { system, temperature, context } = {}) {
  const r = await freeChat(text, { system, temperature, context });
  if (r) return r;
  throw new Error('Tous les fournisseurs IA ont échoué. Réessaie dans quelques minutes.');
}

function pollinations(text) {
  return axios.get('https://text.pollinations.ai/' + encodeURIComponent(String(text || '').slice(0, 2000)), { timeout: 45000 })
    .then(r => String(r.data).trim())
    .catch(() => null);
}

/** Chaîne IA : GROQ → prexzy (gratuit) */
async function freeChat(text, { system, temperature, context } = {}) {
  const messages = [];
  messages.push({ role: 'system', content: system ? DJOUSSE_PERSONA + '\nDirectives spécifiques : ' + system : DJOUSSE_PERSONA });
  
  // Injecter l'historique de conversation si disponible
  if (Array.isArray(context) && context.length > 0) {
    for (const msg of context) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }
  
  messages.push({ role: 'user', content: String(text || '') });

  const errors = [];
  for (const model of [MODELS.chat, MODELS.chatFast, MODELS.multilingual]) {
    try {
      const r = await groq(messages, { model, temperature });
      if (r && r.length) return r;
    } catch (err) {
      errors.push({ model, type: err.errorType || 'unknown', msg: err.userMessage || err.message });
      if (err.errorType === 'quota' || err.errorType === 'auth') break;
    }
  }
  try {
    const pz = require('./prexzy.cjs');
    const r = await pz.chat(system ? system + '\n\n' + String(text) : String(text));
    if (r && r.length) return r;
  } catch { /* fournisseur suivant */ }

  if (errors.length) {
    const lastErr = errors[errors.length - 1];
    if (lastErr.type === 'quota') return null;
    if (lastErr.type === 'rate_limit') return null;
  }
  return null;
}

/** Réponse avec contexte système (jeu, créateur, etc.) */
async function chatSystem(system, text, opts = {}) {
  return chat(text, { system, temperature: opts.temperature });
}

/** Vision — llava-v1.5-7b-4096 (image + question) */
async function describeImage(base64, prompt, { system } = {}) {
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  else messages.push({ role: 'system', content: DJOUSSE_PERSONA });
  messages.push({
    role: 'user',
    content: [
      { type: 'text', text: String(prompt || 'Décris cette image en français, en détail.') },
      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + base64 } }
    ]
  });
  return groq(messages, { model: MODELS.vision, maxTokens: 1024 });
}

/** Transcription vocale — whisper-large-v3 (mp3, m4a, ogg, wav, webm...) */
async function transcribe(audioBuffer, { filename = 'audio.mp3', language } = {}) {
  const k = key();
  if (!k) throw new Error('GROQ_API_KEY manquante');
  const FormData = require('form-data');
  const fd = new FormData();
  fd.append('model', MODELS.stt);
  fd.append('file', Buffer.isBuffer(audioBuffer) ? audioBuffer : Buffer.from(audioBuffer), { filename, contentType: 'audio/mpeg' });
  fd.append('response_format', 'verbose_json');
  fd.append('temperature', '0');
  if (language) fd.append('language', language);

  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const r = await axios.post(GROQ_URL + '/audio/transcriptions', fd, {
        headers: { Authorization: 'Bearer ' + k, ...fd.getHeaders() },
        timeout: 60000,
        maxBodyLength: 25 * 1024 * 1024
      });
      const d = r.data || {};
      return { text: (d.text || '').trim(), segments: d.segments || [], duration: d.duration || 0, language: d.language || '' };
    } catch (err) {
      lastErr = err;
      const classified = classifyError(err);
      if (!classified.retryable || attempt === MAX_RETRIES) {
        err.userMessage = classified.userMsg;
        throw err;
      }
      const delay = BASE_RETRY_DELAY * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }
  throw lastErr;
}

/** Modération IA — llama3-8b-8192 */
async function moderate(text, { contentTypes } = {}) {
  const safe = contentTypes || ['hate speech', 'insultes', 'arnaque', 'escroquerie', 'contenu illégal', 'violence', 'contenu sexuel'];
  const system = 'Tu es un modérateur de contenu WhatsApp. Analyse le message et réponds UNIQUEMENT en JSON valide : {"unsafe":true/false,"categories":["..."],"reason":"..."}. Tu ne signales comme unsafe QUE si le message viole clairement: ' + safe.join(', ') + '. Ignore l\'argot banal et l\'humour inoffensif.';
  const raw = await groq(
    [{ role: 'system', content: system }, { role: 'user', content: String(text || '').slice(0, 1000) }],
    { model: MODELS.safety, temperature: 0, maxTokens: 300 }
  ).catch(() => '');
  if (!raw) return null;
  try {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0) return null;
    const slice = raw.slice(start, end + 1);
    try { return JSON.parse(slice); }
    catch { return JSON.parse(slice.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']')); }
  } catch { return null; }
}

module.exports = { MODELS, chat, chatSystem, describeImage, transcribe, moderate, groq, freeChat, pollinations, DJOUSSE_PERSONA, classifyError };
