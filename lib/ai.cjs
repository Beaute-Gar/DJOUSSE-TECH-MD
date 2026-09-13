/**
 * lib/ai.cjs — Compatibilité — délègue à AINORIA
 *
 * Ce fichier est un wrapper de compatibilité.
 * TOUTES les fonctions IA passent maintenant par lib/ainoria.cjs,
 * qui injecte l'identité DJOUSSE TECH automatiquement.
 *
 * NE PAS ajouter de logique IA dans ce fichier.
 * Modifier lib/ainoria.cjs pour les changements.
 */
const ainoria = require('./ainoria.cjs');

/* ══ Export — compatibilité avec les plugins existants ══ */
const MODELS = ainoria.MODELS;

function classifyError(err) {
  const s = err?.response?.status || 0;
  const m = String(err?.message || '').toLowerCase();
  if (s === 429 || m.includes('rate limit')) return { type: 'rate_limit', retryable: true, userMsg: '⏳ Limite de requêtes atteinte.' };
  if (m.includes('quota') || m.includes('billing')) return { type: 'quota', retryable: false, userMsg: '💳 Quota IA épuisé.' };
  if (s === 401 || m.includes('invalid api key')) return { type: 'auth', retryable: false, userMsg: '🔑 Clé API invalide.' };
  if (s >= 500 || m.includes('overloaded')) return { type: 'server', retryable: true, userMsg: '🔧 Serveur indisponible.' };
  if (m.includes('timeout') || m.includes('econnreset')) return { type: 'network', retryable: true, userMsg: '🌐 Erreur réseau.' };
  return { type: 'unknown', retryable: false, userMsg: '❌ Erreur IA inconnue.' };
}

/** Chat principal — identité DJOUSSE TECH injectée automatiquement */
async function chat(text, opts = {}) {
  const r = await ainoria.chat(text, opts);
  if (r) return r;
  throw new Error('Tous les fournisseurs IA ont échoué. Réessaie dans quelques minutes.');
}

/** Chat avec contexte système custom */
async function chatSystem(system, text, opts = {}) {
  return chat(text, { system, temperature: opts.temperature });
}

/** Free chat — identité DJOUSSE TECH injectée */
async function freeChat(text, opts = {}) {
  return ainoria.chat(text, opts);
}

/** Groq direct — pour les plugins qui en ont besoin */
async function groq(messages, opts = {}) {
  return ainoria.groqChat(messages, opts);
}

/** Vision — identité DJOUSSE TECH injectée */
async function describeImage(base64, prompt, opts = {}) {
  return ainoria.describeImage(base64, prompt);
}

/** STT — identité DJOUSSE TECH injectée */
async function transcribe(audioBuffer, opts = {}) {
  return ainoria.transcribe(audioBuffer, opts);
}

/** Modération — identité DJOUSSE TECH injectée */
async function moderate(text, opts = {}) {
  return ainoria.moderate(text);
}

/** Personnalité AINORIA — utilisée par les plugins existants */
const DJOUSSE_PERSONA = ainoria.PERSONA;

module.exports = {
  MODELS,
  chat,
  chatSystem,
  freeChat,
  groq,
  describeImage,
  transcribe,
  moderate,
  DJOUSSE_PERSONA,
  classifyError,
  // Compatibilité : les plugins qui importent pollinations
  pollinations: async () => null,
};
