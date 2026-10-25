'use strict';
/**
 * MODULE 4 — IA (Gemini + OpenRouter) : preuves par test.
 * Aucune requête réseau réelle ici (fetch injecté) ; le test réseau réel
 * avec les clés du .env est exécuté séparément lors de la recette.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { askAI, hasAIKey, aiUserMessage, AIError, MSG_NO_KEY, MSG_DOWN } = require('../src/lib/ai');

/* Les échecs prévus loggent en console : on garde une sortie de test lisible. */
const realError = console.error;
console.error = () => {};
process.on('exit', () => { console.error = realError; });

const KEY_G = 'test-gemini-key-SUPER-SECRET';
const KEY_O = 'test-openrouter-key-SUPER-SECRET';

const ok = (body) => ({ ok: true, status: 200, json: async () => body });
const fail = (body, status = 500) => ({ ok: false, status, json: async () => body });
const GEMINI_OK = { candidates: [{ content: { parts: [{ text: 'Bonjour !' }] } }] };
const OR_OK = { choices: [{ message: { content: 'Réponse OpenRouter' } }] };

test('Gemini répond → texte retourné, OpenRouter jamais appelé', async () => {
  const urls = [];
  const out = await askAI('salut', null, {
    fetch: async (url) => { urls.push(url); return ok(GEMINI_OK); },
    geminiKey: KEY_G,
    openrouterKey: KEY_O,
  });
  assert.equal(out, 'Bonjour !');
  assert.equal(urls.length, 1);
  assert.match(urls[0], /generativelanguage\.googleapis\.com/);
});

test('Gemini en échec → repli automatique OpenRouter', async () => {
  const urls = [];
  const out = await askAI('salut', null, {
    fetch: async (url) => {
      urls.push(url);
      if (urls.length === 1) return fail({ error: { message: 'server overloaded' } }, 503);
      return ok(OR_OK);
    },
    geminiKey: KEY_G,
    openrouterKey: KEY_O,
  });
  assert.equal(out, 'Réponse OpenRouter');
  assert.equal(urls.length, 2);
  assert.match(urls[1], /openrouter\.ai/);
});

test('sans clé Gemini → OpenRouter seul est sollicité', async () => {
  const urls = [];
  const out = await askAI('salut', null, {
    fetch: async (url) => { urls.push(url); return ok(OR_OK); },
    geminiKey: '',
    openrouterKey: KEY_O,
  });
  assert.equal(out, 'Réponse OpenRouter');
  assert.equal(urls.length, 1);
});

test('les deux fournisseurs en échec → AIError au message élégant (aucun détail technique)', async () => {
  const boom = async () => { throw new Error('ECONNREFUSED 127.0.0.1:443 (getaddrinfo)'); };
  let err;
  try {
    await askAI('salut', null, { fetch: boom, geminiKey: KEY_G, openrouterKey: KEY_O });
  } catch (e) { err = e; }
  assert.ok(err instanceof AIError, 'AIError attendu');
  assert.equal(err.userMessage, MSG_DOWN);
  assert.ok(!/(ECONN|443|fetch|getaddrinfo|HTTP)/i.test(err.userMessage), 'zéro détail technique côté utilisateur');
  assert.ok(err.technical.includes('ECONNREFUSED'), 'le détail technique reste dispo pour la console');
  assert.ok(!err.userMessage.includes(KEY_G) && !err.userMessage.includes(KEY_O), 'jamais de clé dans un message');
});

test('aucune clé configurée → message « clé manquante », sans exception muette', async () => {
  let err;
  try {
    await askAI('salut', null, { fetch: async () => ok({}), geminiKey: '', openrouterKey: '' });
  } catch (e) { err = e; }
  assert.ok(err instanceof AIError);
  assert.equal(err.userMessage, MSG_NO_KEY);
});

test('hasAIKey reflète la présence des deux clés', () => {
  assert.equal(hasAIKey({ geminiKey: '', openrouterKey: '' }), false);
  assert.equal(hasAIKey({ geminiKey: KEY_G, openrouterKey: '' }), true);
  assert.equal(hasAIKey({ geminiKey: '', openrouterKey: KEY_O }), true);
  assert.equal(hasAIKey({ geminiKey: KEY_G, openrouterKey: KEY_O }), true);
});

test('aiUserMessage : erreur inattendue → message doux (jamais la pile)', () => {
  assert.equal(aiUserMessage(new TypeError('Cannot read properties of undefined')), MSG_DOWN);
  assert.equal(aiUserMessage(new AIError('Message doux', 'détail technique')), 'Message doux');
});

test('média image → OpenRouter reçoit une data-URI (commande .analyse)', async () => {
  let body;
  const out = await askAI('décris cette image', { mime: 'image/png', data: Buffer.from('89504e47', 'hex') }, {
    fetch: async (url, opts) => { body = JSON.parse(opts.body); return ok(OR_OK); },
    geminiKey: '',
    openrouterKey: KEY_O,
  });
  assert.equal(out, 'Réponse OpenRouter');
  const parts = body.messages[0].content;
  assert.equal(parts[0].type, 'text');
  assert.match(parts[1].image_url.url, /^data:image\/png;base64,/);
});

test('réponse vide du provider → bascule puis AIError élégante', async () => {
  let calls = 0;
  let err;
  try {
    await askAI('salut', null, {
      fetch: async () => { calls += 1; return ok({}); }, // corps vide des deux côtés
      geminiKey: KEY_G,
      openrouterKey: KEY_O,
      model: 'test/mono-modele', // un seul modèle : le compte d'appels est net
    });
  } catch (e) { err = e; }
  assert.equal(calls, 2, 'les deux providers ont été essayés');
  assert.ok(err instanceof AIError);
  assert.equal(err.userMessage, MSG_DOWN);
});

test('OpenRouter : premier modèle saturé (429) → modèle suivant essayé automatiquement', async () => {
  const bodies = [];
  const out = await askAI('salut', null, {
    fetch: async (url, opts) => {
      bodies.push(JSON.parse(opts.body).model);
      if (bodies.length === 1) return fail({ error: { message: 'rate-limited upstream' } }, 429);
      return ok(OR_OK);
    },
    geminiKey: '',
    openrouterKey: KEY_O,
    model: ['nvidia/model-a:free', 'google/model-b:free'],
  });
  assert.equal(out, 'Réponse OpenRouter');
  assert.deepEqual(bodies, ['nvidia/model-a:free', 'google/model-b:free'], 'le 2e modèle prend le relais');
});

test('OpenRouter : tous les modèles saturés → AIError élégante (message « réessaie »)', async () => {
  let err;
  try {
    await askAI('salut', null, {
      fetch: async () => fail({ error: { message: 'Provider returned error' } }, 429),
      geminiKey: '',
      openrouterKey: KEY_O,
      model: ['a:free', 'b:free'],
    });
  } catch (e) { err = e; }
  assert.ok(err instanceof AIError);
  assert.equal(err.userMessage, MSG_DOWN);
  assert.match(err.userMessage, /Réessaie/);
});
