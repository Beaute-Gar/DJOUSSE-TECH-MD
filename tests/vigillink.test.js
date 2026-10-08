'use strict';
/**
 * Pont système ⇄ Vigil (lib/vigilLink.js) — la « vie » du bot sur le site.
 *
 * Rien ne touche au réseau : `global.fetch` est remplacé par un faux
 * Vigil, et la config est pilotée en mémoire (config.js est lu une
 * seule fois au chargement).
 *
 * Ce qu'on verrouille, dans l'ordre des garanties du module :
 *   1. pont inert tant que VIGIL_* n'est pas renseigné (zéro requête)
 *   2. aller-retour nominal : état + journal envoyés, commandes reçues
 *   3. RIEN n'est perdu : un 500 laisse les files intactes (rejouées)
 *   4. cookie expirée → UNE reconnexion, pas de boucle
 *   5. jamais d'exception : un handler qui casse produit « failed »
 *   6. le journal est borné (200 lignes, 50 par cycle)
 */
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const rootConfig = require('../config');
const { createLink, NODE_NAME, LOG_TAIL, LOG_PER_SYNC } = require('../lib/vigilLink');

/** La config réelle, mutée en place — même technique que tests/vigil.test.js. */
const vconf = rootConfig.guard.vigil;
const ORIGINAL = { ...vconf };
const realFetch = global.fetch;

let calls = [];
let logins = 0;
let link = null;

function configure(over = {}) {
  Object.assign(vconf, ORIGINAL, {
    url: 'http://vigil.test',
    email: 'demo@vigil.app',
    password: 'secret',
    timeoutMs: 500,
  }, over);
}

const resp = (status, body, headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: {
    getSetCookie: () => (headers['set-cookie'] ? [headers['set-cookie']] : []),
    get: (k) => headers[k] || null,
  },
  json: async () => body,
});

/**
 * Faux Vigil : login d'abord, puis /api/bot/sync qui exige un cookie,
 * comme le vrai. `sync` décide du sort de CHAQUE appel sync :
 *   { commands }  → 200 avec ces commandes (UNE seule fois, comme le vrai :
 *                   une commande livrée passe en « running »)
 *   { status }    → réponse d'erreur imposée
 *   { first401 }  → 401 sur le premier appel seulement
 *   { throwSync } → rejet réseau
 */
function fakeVigil(sync = {}) {
  calls = [];
  logins = 0;
  let syncCalls = 0;
  let delivered = false;

  global.fetch = async (url, opts = {}) => {
    const u = String(url);
    calls.push({
      u,
      body: opts.body ? JSON.parse(opts.body) : null,
      cookie: opts.headers ? opts.headers.Cookie : null,
    });

    if (u.endsWith('/api/auth/login')) {
      logins++;
      return resp(200, { ok: true }, { 'set-cookie': 'vigil_session=tok1; Path=/; HttpOnly' });
    }

    // Le vrai serveur refuse tout appel sans session.
    if (!opts.headers || !opts.headers.Cookie) return resp(401, { error: 'Non authentifié.' });

    syncCalls++;
    if (sync.first401 && syncCalls === 1) return resp(401, { error: 'Non authentifié.' });
    if (sync.status) return resp(sync.status, { error: 'panne' });
    if (sync.throwSync) throw sync.throwSync;

    const commands = sync.commands && !delivered ? sync.commands : [];
    if (sync.commands) delivered = true;
    return resp(200, { ok: true, commands });
  };
}

function makeLink(over = {}) {
  link = createLink({
    intervalMs: 60000,          // jamais auto : on appelle syncOnce() à la main
    offlineMs: 0,               // pas de cooldown : testable cycle par cycle
    getState: () => ({ connected: true, commands: 309, connectMethod: 'pairing' }),
    onCommand: (kind, payload) => `ok:${kind}${payload ? ':' + payload : ''}`,
    log: () => {},
    ...over,
  });
  return link;
}

const syncCalls = () => calls.filter((c) => c.u.endsWith('/api/bot/sync'));

beforeEach(() => {
  configure();
});

afterEach(() => {
  global.fetch = realFetch;
  if (link) link.reset();
  link = null;
  Object.keys(ORIGINAL).forEach((k) => { vconf[k] = ORIGINAL[k]; });
});

/* ── 1. inert ─────────────────────────────────────────────── */

test('inerte tant que VIGIL_URL / identifiants manquent', async () => {
  Object.assign(vconf, ORIGINAL, { url: '', email: '', password: '' });
  fakeVigil();
  const l = makeLink();
  assert.equal(l.enabled(), false);
  const s = await l.syncOnce();
  assert.equal(s.ok, false);
  assert.equal(calls.length, 0, 'aucune requête ne doit partir');
});

test('démarrage sans config : avertissement unique, aucun timer', () => {
  Object.assign(vconf, ORIGINAL, { url: '', email: '', password: '' });
  const l = makeLink();
  l.start();
  l.start();            // idempotent
  l.stop();
  assert.equal(l.enabled(), false);
});

/* ── 2. aller-retour nominal ──────────────────────────────── */

test('publie l’état + le journal et repart avec les commandes', async () => {
  fakeVigil({
    commands: [{ id: 'c1', kind: 'pairing', payload: '237693978044' }],
  });
  const l = makeLink();
  l.pushLog('[SOCKET] ✅ CONNECTÉ — 237652746693:20');

  const s = await l.syncOnce();

  assert.equal(s.ok, true, 'cycle nominal');
  assert.equal(logins, 1, 'login avant le premier envoi');
  assert.equal(calls[0].u.endsWith('/api/auth/login'), true, 'login en tout premier');

  const body = syncCalls()[0].body;
  assert.equal(body.name, NODE_NAME);
  assert.equal(body.status.connected, true);
  assert.equal(body.status.commands, 309);
  assert.equal(body.status.connectMethod, 'pairing');
  assert.equal(body.logs[0].line, '[SOCKET] ✅ CONNECTÉ — 237652746693:20');
  assert.equal(s.sentLogs, 1);
  assert.equal(l._state().queuedLogs, 0, 'accusé reçu → journal purgé');
  assert.equal(s.commands, 1, 'commande livrée');

  // Retour de la commande : envoyé AU CYCLE SUIVANT (jamais perdu, jamais
  // perdu deux fois).
  const s2 = await l.syncOnce();
  assert.equal(s2.sentResults, 1);
  assert.deepEqual(syncCalls()[1].body.results, [
    { id: 'c1', status: 'done', result: 'ok:pairing:237693978044' },
  ]);
  assert.equal(syncCalls()[1].body.logs, undefined, 'journal vide → pas de clé');
});

test('cookie présente → aucun re-login superflu', async () => {
  fakeVigil();
  const l = makeLink();
  await l.syncOnce();
  await l.syncOnce();
  await l.syncOnce();
  assert.equal(logins, 1, 'un seul login sur trois cycles');
});

/* ── 3. rien n’est perdu ──────────────────────────────────── */

test('500 serveur → les files restent intactes et sont rejouées', async () => {
  fakeVigil({ status: 503 });
  const l = makeLink();
  l.pushLog('ligne critique');

  const s = await l.syncOnce();
  assert.equal(s.ok, false);
  assert.equal(l._state().queuedLogs, 1, 'PAS purgé sur échec');

  // Vigil revient : la même ligne part et n'est comptée qu'une fois.
  fakeVigil();
  const s2 = await l.syncOnce();
  assert.equal(s2.ok, true);
  assert.equal(s2.sentLogs, 1);
  assert.equal(l._state().queuedLogs, 0);
});

test('réseau qui jette → jamais d’exception, cooldown armé', async () => {
  fakeVigil({ throwSync: new Error('ECONNREFUSED') });
  const l = makeLink();
  const s = await l.syncOnce();
  assert.equal(s.ok, false, 'échec signalé, pas levé');
  assert.ok(l._state().warned.includes('offline'), 'avertissement unique émis');
});

/* ── 4. cookie expirée ────────────────────────────────────── */

test('401 → UNE reconnexion puis reprise, pas de boucle', async () => {
  fakeVigil({ first401: true });
  const l = makeLink();
  l.pushLog('après coupure');

  const s = await l.syncOnce();
  assert.equal(s.ok, true, 'repris après relogin');
  assert.equal(logins, 2, 'exactement une reconnexion');
  assert.equal(syncCalls().length, 2, 'une seule relance du sync');
  assert.equal(s.sentLogs, 1, 'journal perdu par la coupure ? non : il est parti');
});

/* ── 5. jamais d’exception ────────────────────────────────── */

test('onCommand qui casse → retour « failed », pas de rejet', async () => {
  fakeVigil({ commands: [{ id: 'c9', kind: 'raw', payload: '.ping' }] });
  const l = makeLink({ onCommand: () => { throw new Error('bot déconnecté'); } });

  const s = await l.syncOnce();
  assert.equal(s.ok, true, 'le pont survit à la commande');

  await l.syncOnce();
  assert.deepEqual(syncCalls()[1].body.results, [
    { id: 'c9', status: 'failed', result: 'bot déconnecté' },
  ]);
});

test('getState qui lève → le cycle continue quand même', async () => {
  fakeVigil();
  const l = makeLink({ getState: () => { throw new Error('sock muet'); } });
  const s = await l.syncOnce();
  assert.equal(s.ok, true);
  assert.equal(syncCalls()[0].body.status, undefined, 'pas de statut, mais pas de crash');
});

test('commande sans onCommand → retour explicite « non prise en charge »', async () => {
  fakeVigil({ commands: [{ id: 'cx', kind: 'stop', payload: '' }] });
  const l = makeLink({ onCommand: undefined });
  await l.syncOnce();
  await l.syncOnce();
  assert.equal(syncCalls()[1].body.results[0].status, 'done');
  assert.match(syncCalls()[1].body.results[0].result, /non prise en charge/);
});

/* ── 6. bornes ────────────────────────────────────────────── */

test('journal borné à 200 lignes, 50 par cycle', async () => {
  fakeVigil();
  const l = makeLink();
  for (let i = 0; i < LOG_TAIL + 60; i++) l.pushLog(`ligne ${i}`);

  assert.equal(l._state().queuedLogs, LOG_TAIL, 'tampon local borné');
  const s = await l.syncOnce();
  assert.equal(s.sentLogs, LOG_PER_SYNC, 'un cycle n’emporte jamais plus de 50');
  assert.equal(l._state().queuedLogs, LOG_TAIL - LOG_PER_SYNC, 'le reste attend son tour');

  // Une ligne vide ou nulle n’emplit jamais le tampon.
  l.pushLog('   ');
  l.pushLog(null);
  assert.equal(l._state().queuedLogs, LOG_TAIL - LOG_PER_SYNC);
});

test('ligne trop longue tronquée à 400 caractères', async () => {
  fakeVigil();
  const l = makeLink();
  l.pushLog('x'.repeat(4000));
  const s = await l.syncOnce();
  assert.equal(s.sentLogs, 1);
  assert.equal(syncCalls()[0].body.logs[0].line.length, 400, 'jamais plus de 400 par ligne');
});

test('retours et commandes : bornes et typage défensif', async () => {
  fakeVigil();
  const l = makeLink();
  for (let i = 0; i < LOG_TAIL + 10; i++) l.pushResult(`id${i}`, i % 2 ? 'failed' : 'done', 'r');
  assert.equal(l._state().queuedResults, LOG_TAIL, 'file de retours bornée');

  l.pushResult('', 'done', 'x');
  assert.equal(l._state().queuedResults, LOG_TAIL, 'id vide ignoré');
});

/* ── 7. reprise immédiate (pont face à un coup de réseau) ──── */

test('coup de réseau : la reprise évite le cooldown — le cycle aboutit', async () => {
  calls = [];
  logins = 0;
  let n = 0;
  global.fetch = async (url, opts = {}) => {
    const u = String(url);
    calls.push({ u, body: opts.body ? JSON.parse(opts.body) : null, cookie: opts.headers ? opts.headers.Cookie : null });
    if (u.endsWith('/api/auth/login')) {
      logins++;
      return resp(200, { ok: true }, { 'set-cookie': 'vigil_session=tok1; Path=/; HttpOnly' });
    }
    n++;
    if (n === 1) throw Object.assign(new Error('fetch failed'), { name: 'TypeError' });
    return resp(200, { ok: true, commands: [] });
  };

  const l = makeLink({ retryMs: 0 });
  l.pushLog('ligne critique');
  const s = await l.syncOnce();

  assert.equal(s.ok, true, 'la reprise doit aboutir sans passer hors ligne');
  assert.equal(syncCalls().length, 2, 'exactement 2 tentatives : 1 echec + 1 reprise');
  assert.equal(s.sentLogs, 1, 'le journal part quand meme');
  assert.equal(l._state().queuedLogs, 0, 'accuse recu -> journal purge');
});

test('deux echecs de suite : le cycle echoue, sans boucle infinie', async () => {
  calls = [];
  logins = 0;
  global.fetch = async (url, opts = {}) => {
    const u = String(url);
    calls.push({ u, body: opts.body ? JSON.parse(opts.body) : null, cookie: opts.headers ? opts.headers.Cookie : null });
    if (u.endsWith('/api/auth/login')) {
      logins++;
      return resp(200, { ok: true }, { 'set-cookie': 'vigil_session=tok1; Path=/; HttpOnly' });
    }
    throw Object.assign(new Error('fetch failed'), { name: 'TypeError' });
  };

  const l = makeLink({ retryMs: 0 });
  l.pushLog('ligne a conserver');
  const s = await l.syncOnce();

  assert.equal(s.ok, false, 'echec assume apres la reprise');
  assert.equal(syncCalls().length, 2, 'une seule reprise : pas de boucle');
  assert.equal(l._state().queuedLogs, 1, "rien n'est perdu sur un double echec");
});

/* ── 8. cooldown adaptatif ─────────────────────────────────── */

test('timeout : le pont ne se fige pas 15 s pour un coup de reseau', async () => {
  fakeVigil({ throwSync: Object.assign(new Error('operation aborted due to timeout'), { name: 'TimeoutError' }) });
  const l = makeLink({ offlineMs: 16000, retryMs: 0 });

  const s = await l.syncOnce();
  assert.equal(s.ok, false);

  const restant = l._state().offlineUntil - Date.now();
  assert.ok(restant > 0, 'un cooldown est bien arme');
  assert.ok(restant <= 6000, `cooldown de timeout tres inferieur au normal (${restant} ms)`);
});

test('erreur HTTP : le cooldown complet est conserve', async () => {
  fakeVigil({ status: 503 });
  const l = makeLink({ offlineMs: 16000, retryMs: 0 });

  const s = await l.syncOnce();
  assert.equal(s.ok, false);

  const restant = l._state().offlineUntil - Date.now();
  assert.ok(restant >= 12000, `panne serveur = pas de complaisance (${restant} ms)`);
});
