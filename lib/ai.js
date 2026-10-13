'use strict';
/**
 * lib/ai.js — MODULE 4 DU CAHIER DES CHARGES : IA (Gemini + OpenRouter)
 * ────────────────────────────────────────────────────────────────────
 * Point d'entrée unique des commandes IA (.ai, .summarize, .analyse) :
 *
 *   const { askAI, hasAIKey, aiUserMessage, MSG_NO_KEY } = require('./lib/ai');
 *   try { const r = await askAI(prompt); } catch (e) { ctx.reply(aiUserMessage(e)); }
 *
 * Garanties du module :
 *   - CHAÎNE DE SECOURS : Gemini d'abord, OpenRouter en repli AUTOMATIQUE
 *     si Gemini échoue (ou s'il n'y a pas de clé Gemini) ;
 *   - TRY/CATCH STRICT par fournisseur : la panne d'un provider n'annule
 *     jamais l'appel, chaque échec est journalisé en console [AI] ;
 *   - MESSAGE UTILISATEUR TOUJOURS ÉLÉGANT : le détail technique (HTTP,
 *     exception réseau, provider, réponse vide) part en console —
 *     l'utilisateur ne voit ni stack, ni code, ni nom de fournisseur ;
 *   - AUCUN SECRET EN DUR : clés lues via config.js (process.env), la clé
 *     ne quitte jamais la requête (en-tête Authorization / paramètre key).
 *
 * Réglages .env :
 *   GEMINI_KEY / GEMINI_API_KEY   provider principal (Google AI Studio)
 *   OPENROUTER_API_KEY            secours (openrouter.ai)
 *   OPENROUTER_MODEL              liste ordonnée de modèles « a, b, c »
 *                                 (réessayés l'un après l'autre à chaque
 *                                 panne : les pools gratuits saturent vite)
 */

const config = require('../config');
const { withNetworkTimeout } = require('./network-timeout');

/** Délai max par requête IA (sc cold start + file d'attente du provider). */
const TIMEOUT_MS = 30000;

/* Messages utilisateur — les SEULS textes IA montrés dans WhatsApp. */
const MSG_NO_KEY =
  '🔑 Clé IA manquante : ajoute GEMINI_KEY ou OPENROUTER_API_KEY dans le fichier .env puis relance le bot.';
const MSG_DOWN = '⏳ L’IA est momentanément indisponible. Réessaie dans quelques instants.';

/**
 * Erreur IA : message doux pour l'utilisateur, détail technique pour
 * la console. Seul `userMessage` a le droit d'être envoyé sur WhatsApp.
 */
class AIError extends Error {
  constructor(userMessage, technical = '') {
    super(userMessage);
    this.name = 'AIError';
    this.userMessage = userMessage;
    this.technical = technical;
  }
}

/** Vrai si au moins une clé IA est configurée (testable avec des clés explicites). */
function hasAIKey(keys = {}) {
  const g = keys.geminiKey !== undefined ? keys.geminiKey : config.geminiKey;
  const o = keys.openrouterKey !== undefined ? keys.openrouterKey : config.openrouterKey;
  return Boolean(g || o);
}

/** Décode la réponse JSON d'une HTTP call ; hors ligne / corps vide → erreur propre. */
async function readJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

/* ── Provider 1 : Google Gemini ─────────────────────────────────── */
async function callGemini(prompt, media, key, fetchImpl) {
  /* gemini-flash-latest : alias maintenu par Google (gemini-2.0-flash retiré) */
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${key}`;
  const parts = [{ text: prompt }];
  if (media?.data?.length) {
    parts.push({ inline_data: { mime_type: media.mime, data: media.data.toString('base64') } });
  }
  const json = await withNetworkTimeout(async (signal) => {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts }] }),
      signal,
    });
    const data = await readJson(res);
    if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
    return data;
  }, TIMEOUT_MS, 'Gemini');
  const text = json?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim();
  if (!text) throw new Error(json?.error?.message || 'Réponse IA vide');
  return text;
}

/* ── Provider 2 : OpenRouter (secours automatique) ──────────────── */
async function callOpenRouter(prompt, media, key, model, fetchImpl) {
  const url = 'https://openrouter.ai/api/v1/chat/completions';
  let content = prompt;
  if (media?.data?.length) {
    content = [
      { type: 'text', text: prompt },
      {
        type: 'image_url',
        image_url: { url: `data:${media.mime || 'application/octet-stream'};base64,${media.data.toString('base64')}` },
      },
    ];
  }
  const json = await withNetworkTimeout(async (signal) => {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        'X-Title': 'DJOUSSE TECH MD',
      },
      body: JSON.stringify({ model, messages: [{ role: 'user', content }] }),
      signal,
    });
    const data = await readJson(res);
    if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
    return data;
  }, TIMEOUT_MS, 'OpenRouter');
  const text = String(json?.choices?.[0]?.message?.content || '').trim();
  if (!text) throw new Error(json?.error?.message || 'Réponse IA vide');
  return text;
}

/**
 * Demande IA : Gemini → repli OpenRouter → échec = AIError élégant.
 *
 * @param {string}   prompt   consigne textuelle
 * @param {object}   media    { mime, data:Buffer } optionnel (images)
 * @param {object}   deps     injection pour les tests :
 *                            { fetch, geminiKey, openrouterKey, model }
 * @returns {Promise<string>} réponse texte (jamais vide)
 * @throws {AIError} message doux côté utilisateur, technical en console
 */
async function askAI(prompt, media = null, deps = {}) {
  const fetchImpl = deps.fetch || globalThis.fetch;
  const geminiKey = deps.geminiKey !== undefined ? deps.geminiKey : config.geminiKey;
  const openrouterKey = deps.openrouterKey !== undefined ? deps.openrouterKey : config.openrouterKey;
  /* Modèle(s) OpenRouter : chaîne unique ou liste « a, b » — chaque
     essai a sa propre pool gratuite, on les essaye tous dans l'ordre. */
  const rawModels = deps.model || (config.openrouterModels || []).join(', ');
  const models = (Array.isArray(rawModels) ? rawModels : String(rawModels).split(','))
    .map((s) => String(s).trim())
    .filter(Boolean);

  if (!geminiKey && !openrouterKey) throw new AIError(MSG_NO_KEY, 'aucune clé IA configurée');
  if (typeof fetchImpl !== 'function') throw new AIError(MSG_DOWN, 'fetch indisponible sur cette plateforme');

  const providers = [];
  if (geminiKey) providers.push(['Gemini', () => callGemini(prompt, media, geminiKey, fetchImpl)]);
  if (openrouterKey) {
    providers.push(['OpenRouter', async () => {
      if (!models.length) throw new Error('aucun modèle configuré (OPENROUTER_MODEL)');
      /* Chaque modèle gratuit a sa propre pool : on essaie la liste
         ordonnée jusqu'au premier qui répond (429 = pool saturée). */
      const failures = [];
      for (const model of models) {
        try {
          return await callOpenRouter(prompt, media, openrouterKey, model, fetchImpl);
        } catch (e) {
          failures.push(`${model} : ${e.message}`);
          console.error(`[AI] OpenRouter(${model}) en échec :`, e.message);
        }
      }
      throw new Error(failures.join(' | '));
    }]);
  }

  const failures = [];
  for (const [name, run] of providers) {
    try {
      return await run();
    } catch (e) {
      failures.push(`${name} : ${e.message}`);
      console.error(`[AI] ${name} en échec :`, e.message);
    }
  }
  throw new AIError(MSG_DOWN, failures.join(' | '));
}

/**
 * Traduit n'importe quelle erreur en message WhatsApp sûr :
 * AIError → son message doux ; toute autre erreur → message générique.
 * Le détail technique part toujours en console, jamais à l'utilisateur.
 */
function aiUserMessage(e) {
  if (e instanceof AIError) {
    if (e.technical) console.error('[AI]', e.technical);
    return e.userMessage;
  }
  console.error('[AI]', e && e.stack ? e.stack : e);
  return MSG_DOWN;
}

module.exports = { askAI, hasAIKey, aiUserMessage, AIError, MSG_NO_KEY, MSG_DOWN };
