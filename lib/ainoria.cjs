/**
 * lib/ainoria.cjs — Cerveau Central AINORIA
 *
 * Point d'entrée unique pour tout appel IA du bot.
 * L'identité DJOUSSE TECH est injectée automatiquement dans chaque requête LLM.
 *
 * Architecture :
 *   Plugin → AINORIA → Identité Canonicque → AI Router → Modèle
 *
 * Aucun plugin ne doit appeler directement Groq/Gemini/Pollinations.
 */
const axios = require('axios');
const { buildSystemPrompt, buildAgentContext } = require('./knowledge.cjs');

/* ══ Config ══ */
const GROQ_URL = 'https://api.groq.com/openai/v1';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

const MODELS = {
  groq: {
    chat: 'llama3-70b-8192',
    fast: 'llama3-8b-8192',
    multilingual: 'mixtral-8x7b-32768',
    vision: 'llava-v1.5-7b-4096',
    safety: 'llama3-8b-8192',
    stt: 'whisper-large-v3',
  },
  gemini: {
    chat: 'gemini-2.0-flash',
    fast: 'gemini-2.0-flash-lite',
  }
};

/**
 * PERSONA = identité canonicque injectée dans CHAQUE appel LLM.
 * Construite une seule fois au démarrage, héritée par tous les modèles.
 */
const PERSONA = buildSystemPrompt();

const MAX_RETRIES = 2;
const RETRY_DELAY = 1500;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* ══ Keys ══ */
function groqKey() { return process.env.GROQ_API_KEY || ''; }
function geminiKey() { return process.env.GEMINI_API_KEY || ''; }

/* ══ Error Classifier ══ */
function classify(err) {
  const s = err?.response?.status || 0;
  const m = String(err?.message || err?.response?.data?.error?.message || '').toLowerCase();
  if (s === 429 || m.includes('rate limit')) return { type: 'rate_limit', retry: true };
  if (m.includes('quota') || m.includes('billing')) return { type: 'quota', retry: false };
  if (s === 401 || m.includes('invalid api key')) return { type: 'auth', retry: false };
  if (s >= 500 || m.includes('overloaded')) return { type: 'server', retry: true };
  if (m.includes('timeout') || m.includes('econnreset')) return { type: 'network', retry: true };
  return { type: 'unknown', retry: false };
}

/* ══ Groq Direct ══ */
async function groqChat(messages, { model, temperature = 0.7, maxTokens = 2048, json = false } = {}) {
  const k = groqKey();
  if (!k) throw new Error('GROQ_API_KEY manquante');
  const body = {
    model: model || MODELS.groq.chat,
    messages,
    temperature,
    max_completion_tokens: maxTokens,
    top_p: 1,
    stream: false,
    stop: null,
  };
  if (json) body.response_format = { type: 'json_object' };

  let lastErr;
  for (let i = 1; i <= MAX_RETRIES; i++) {
    try {
      const r = await axios.post(GROQ_URL + '/chat/completions', body, {
        headers: { Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' },
        timeout: 40000,
      });
      const content = r.data?.choices?.[0]?.message?.content;
      return content ? String(content).trim() : '';
    } catch (err) {
      lastErr = err;
      const c = classify(err);
      if (!c.retry || i === MAX_RETRIES) throw err;
      await sleep(RETRY_DELAY * Math.pow(2, i - 1));
    }
  }
  throw lastErr;
}

/* ══ Gemini Direct ══ */
async function geminiChat(prompt, { system, model, temperature = 0.7 } = {}) {
  const k = geminiKey();
  if (!k) throw new Error('GEMINI_API_KEY manquante');
  const mdl = model || MODELS.gemini.chat;

  // Injecter l'identité canonicque comme premier message système
  const identityPrefix = system ? PERSONA + '\n\n' + system : PERSONA;
  const contents = [
    { role: 'user', parts: [{ text: identityPrefix }] },
    { role: 'model', parts: [{ text: 'Compris. Je suis AINORIA, le cerveau de DJOUSSE TECH. Je suis prêt.' }] },
    { parts: [{ text: String(prompt || '') }] },
  ];

  const r = await axios.post(
    `${GEMINI_URL}/${mdl}:generateContent?key=${k}`,
    { contents, generationConfig: { temperature, maxOutputTokens: 2048 } },
    { timeout: 30000 }
  );
  const text = r.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return text ? String(text).trim() : '';
}

/* ══════════════════════════════════════════════════════════════════
   CHAT CENTRAL — TOUTE identité injectée ici
   ══════════════════════════════════════════════════════════════════ */

/**
 * Chat principal — identité DJOUSSE TECH automatiquement injectée.
 * Fallback : Groq → Gemini → Prexzy → null
 *
 * @param {string} text - La question/demande de l'utilisateur
 * @param {object} opts - { system, temperature, context }
 *   - system: directives supplémentaires (ex: "Tu es un expert en debate")
 *   - temperature: créativité (0-1)
 *   - context: historique [{role, content}]
 * @returns {string|null} la réponse ou null
 */
async function chat(text, { system, temperature = 0.7, context } = {}) {
  // Construire les messages avec identité canonicque
  const messages = [];
  messages.push({ role: 'system', content: system ? PERSONA + '\n\nDirectives spécifiques : ' + system : PERSONA });
  if (Array.isArray(context)) {
    for (const msg of context) messages.push({ role: msg.role, content: msg.content });
  }
  messages.push({ role: 'user', content: String(text || '') });

  // 1) Groq cascade — même identité pour chaque modèle
  for (const model of [MODELS.groq.chat, MODELS.groq.fast, MODELS.groq.multilingual]) {
    try {
      const r = await groqChat(messages, { model, temperature });
      if (r) return r;
    } catch (err) {
      const c = classify(err);
      if (c.type === 'quota' || c.type === 'auth') break;
    }
  }

  // 2) Gemini fallback — même identité injectée
  if (geminiKey()) {
    try {
      const r = await geminiChat(text, { system: system || undefined, temperature });
      if (r) return r;
    } catch { /* continue */ }
  }

  // 3) Prexzy fallback
  try {
    const pz = require('./prexzy.cjs');
    const r = await pz.chat(system ? system + '\n\n' + text : text);
    if (r) return r;
  } catch { /* continue */ }

  return null;
}

/* ══ Chat avec contexte système custom ══ */
async function chatSystem(system, text, opts = {}) {
  return chat(text, { system, temperature: opts.temperature });
}

/* ══ Vision — Groq llava ══ */
async function describeImage(base64, prompt) {
  const k = groqKey();
  if (!k) throw new Error('GROQ_API_KEY manquante');
  const messages = [
    { role: 'system', content: PERSONA },
    {
      role: 'user',
      content: [
        { type: 'text', text: String(prompt || 'Décris cette image en français.') },
        { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + base64 } },
      ],
    },
  ];
  return groqChat(messages, { model: MODELS.groq.vision, maxTokens: 1024 });
}

/* ══ STT — Groq Whisper ══ */
async function transcribe(audioBuffer, { filename = 'audio.mp3', language } = {}) {
  const k = groqKey();
  if (!k) throw new Error('GROQ_API_KEY manquante');
  const FormData = require('form-data');
  const fd = new FormData();
  fd.append('model', MODELS.groq.stt);
  fd.append('file', Buffer.isBuffer(audioBuffer) ? audioBuffer : Buffer.from(audioBuffer), { filename, contentType: 'audio/mpeg' });
  fd.append('response_format', 'verbose_json');
  fd.append('temperature', '0');
  if (language) fd.append('language', language);

  let lastErr;
  for (let i = 1; i <= MAX_RETRIES; i++) {
    try {
      const r = await axios.post(GROQ_URL + '/audio/transcriptions', fd, {
        headers: { Authorization: 'Bearer ' + k, ...fd.getHeaders() },
        timeout: 60000,
        maxBodyLength: 25 * 1024 * 1024,
      });
      const d = r.data || {};
      return { text: (d.text || '').trim(), segments: d.segments || [], duration: d.duration || 0, language: d.language || '' };
    } catch (err) {
      lastErr = err;
      const c = classify(err);
      if (!c.retry || i === MAX_RETRIES) throw err;
      await sleep(RETRY_DELAY * Math.pow(2, i - 1));
    }
  }
  throw lastErr;
}

/* ══ Language Detection ══ */
async function detectLanguage(text) {
  try {
    const r = await groqChat([
      { role: 'system', content: buildAgentContext() + '\nReply ONLY with the ISO 639-1 code (fr, en, es...). Nothing else.' },
      { role: 'user', content: text },
    ], { model: MODELS.groq.fast, maxTokens: 10, temperature: 0 });
    const lang = r.toLowerCase().slice(0, 2);
    return /^[a-z]{2}$/.test(lang) ? lang : 'en';
  } catch { return 'en'; }
}

/* ══ Translation ══ */
async function translate(text, targetLang, { sourceLang } = {}) {
  const LANG_MAP = {
    fr: 'Français', en: 'English', es: 'Español', de: 'Deutsch', pt: 'Português',
    it: 'Italiano', nl: 'Nederlands', ru: 'Русский', ja: '日本語', ko: '한국어',
    zh: '中文', ar: 'العربية', hi: 'हिन्दी', tr: 'Türkçe', pl: 'Polski',
    vi: 'Tiếng Việt', th: 'ไทย', id: 'Bahasa Indonesia', ms: 'Bahasa Melayu',
    sw: 'Kiswahili', ha: 'Hausa', yo: 'Yorùbá', ig: 'Igbo',
  };
  const langName = LANG_MAP[targetLang] || targetLang;
  const srcLabel = sourceLang ? ` from ${LANG_MAP[sourceLang] || sourceLang}` : '';
  const sys = `You are a professional translator. Translate to ${langName}${srcLabel}. Reply ONLY with the translation. Keep the same tone and meaning. If already in ${langName}, reply with the original.`;
  return chat(text, { system: sys, temperature: 0.3 });
}

/* ══ Moderation ══ */
async function moderate(text) {
  const sys = 'Reply ONLY in JSON: {"unsafe":true/false,"categories":["..."],"reason":"..."}. Flag only: hate speech, insults, scams, illegal content, violence, sexual content.';
  const raw = await groqChat([
    { role: 'system', content: buildAgentContext() + '\n' + sys },
    { role: 'user', content: String(text || '').slice(0, 1000) },
  ], { model: MODELS.groq.safety, temperature: 0, maxTokens: 300 }).catch(() => '');
  if (!raw) return null;
  try {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0) return null;
    return JSON.parse(raw.slice(start, end + 1));
  } catch { return null; }
}

/* ══ Export ══ */
module.exports = {
  MODELS,
  PERSONA,
  chat,
  chatSystem,
  describeImage,
  transcribe,
  detectLanguage,
  translate,
  moderate,
  groqChat,
  geminiChat,
  buildSystemContext: buildSystemPrompt,
  buildAgentContext,
};
