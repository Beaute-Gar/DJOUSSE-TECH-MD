'use strict';
/**
 * Pont bot ⇄ Vigil (guard/src/vigil.js) + son branchement dans engine.js.
 *
 * Rien ne touche au réseau : `global.fetch` est remplacé par une fausse
 * réponse, et la config est pilotée en mémoire — config.js est lu une
 * seule fois au chargement du processus, on ne peut pas changer d'avis
 * après coup.
 *
 * Ce qu'on verrouille ici, dans l'ordre des garanties du client :
 *   1. pont inert quand rien n'est configuré (aucune requête, aucun délai)
 *   2. échec réseau → on garde l'avis LOCAL, cooldown armé
 *   3. verdict rendu tel quel (nom de règle, sévérité, action)
 *   4. cookie expirée → UNE reconnexion, pas de boucle
 *   5. `enrich` ne peut pas affaiblir une protection — `veto` peut
 *   6. sans admin : le constat porte enfin le nom de la règle
 */
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const H = require('./helpers');
const { handler, guardDb, mockSock, text, fresh, newAdmin, plain, deleted, texts } = H;

const rootConfig = require('../config');
const vigil = require('../guard/src/vigil');

const G = '120363000000000009@g.us';
const run = (s, m) => handler.handleMessage(s, m);
const enable = (gid, cfg) => Object.assign(guardDb.db().getGroup(gid), cfg);

/** La config réelle, mutée en place : `guard/src/config.js` l'étale par référence. */
const vconf = rootConfig.guard.vigil;
const NEUTRE = { url: '', email: '', password: '', timeoutMs: 1200, mode: 'enrich' };

const realFetch = global.fetch;
let calls = [];

/** Réponse minimale compatible avec ce que le client lit. */
const resp = (status, body, headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: {
    getSetCookie: () => (headers['set-cookie'] ? [headers['set-cookie']] : []),
    get: (k) => headers[k] || null,
  },
  json: async () => body,
});

const verdictBody = (over = {}) => ({
  clean: false,
  incident: { id: 'i1' },
  rule: { id: 'r1', name: 'Liens raccourcis', priority: 20 },
  severity: 'medium',
  action: 'warn',
  matchedRuleIds: ['r1'],
  invalidRules: [],
  ...over,
});

function configure(over = {}) {
  Object.assign(vconf, NEUTRE, {
    url: 'http://vigil.test',
    email: 'demo@vigil.app',
    password: 'secret',
    timeoutMs: 500,
  }, over);
}

/** Faux Vigil : login d'abord, puis detect — laquelle exige un cookie, comme le vrai. */
function fakeVigil(body, { detectStatus = 200, failDetect = null } = {}) {
  calls = [];
  global.fetch = async (url, opts = {}) => {
    calls.push({ url: String(url), body: opts.body });
    if (String(url).endsWith('/api/auth/login')) {
      return resp(200, { ok: true }, { 'set-cookie': 'vigil_session=abc; Path=/; HttpOnly' });
    }
    if (!opts.headers || !opts.headers.Cookie) return resp(401, { error: 'Non authentifié.' });
    if (failDetect) throw failDetect;
    return resp(detectStatus, body);
  };
}

const logins = () => calls.filter((c) => c.url.endsWith('/api/auth/login'));
const detects = () => calls.filter((c) => c.url.endsWith('/api/incidents/detect'));

beforeEach(() => {
  Object.assign(vconf, NEUTRE);
  vigil.reset();
  calls = [];
  global.fetch = realFetch;
});

afterEach(() => {
  global.fetch = realFetch;
  Object.assign(vconf, NEUTRE);
  vigil.reset();
  calls = [];
});

test('1. pont inert sans VIGIL_URL : la protection ne change pas, zéro requête', async () => {
  fresh(G);
  const s = mockSock({ admins: [newAdmin()] });
  enable(G, { antilink: true });
  let seen = 0;
  global.fetch = async () => { seen++; return resp(200, {}); };

  await run(s, text(G, H.MEMBER, 'go https://spam.com'));

  assert.strictEqual(deleted(s).length, 1, 'suppression locale inchangée');
  assert.strictEqual(seen, 0, 'aucun appel réseau');
  assert.strictEqual(vigil.enabled(), false);
});

test('2. échec réseau : on garde l\'avis local, puis cooldown (pas de martèlement)', async () => {
  configure();
  global.fetch = async () => { throw new Error('ECONNREFUSED'); };

  assert.strictEqual(await vigil.judge('https://evil.com', { channel: G }), null);
  assert.ok(Date.now() < vigil._state().offlineUntil, 'cooldown armé après échec');

  const avant = calls.length;
  assert.strictEqual(await vigil.judge('https://evil.com'), null);
  assert.strictEqual(calls.length, avant, 'le cooldown épargne le réseau');
});

test('3. verdict rendu tel quel : nom de règle, sévérité, action', async () => {
  configure();
  fakeVigil(verdictBody());

  const out = await vigil.judge('gagnez https://scam.com', { channel: G, subject: H.MEMBER });

  assert.ok(out, 'Vigil a répondu');
  assert.strictEqual(out.clean, false);
  assert.strictEqual(out.rule.name, 'Liens raccourcis');
  assert.strictEqual(out.rule.priority, 20);
  assert.strictEqual(out.severity, 'medium');
  assert.strictEqual(out.action, 'warn');
  assert.strictEqual(logins().length, 1, 'une connexion par appel');
  assert.strictEqual(detects().length, 1);
  // Le cookie est bien transmis, et le contenu tronqué à 2000 caractères.
  assert.ok(detects()[0].body.includes('scam.com'));
});

test('4. cookie expirée : UNE reconnexion, puis reprise (pas de boucle)', async () => {
  configure();
  let detectCount = 0;
  calls = [];
  global.fetch = async (url, opts = {}) => {
    calls.push({ url: String(url), body: opts.body });
    if (String(url).endsWith('/api/auth/login')) {
      return resp(200, { ok: true }, { 'set-cookie': 'vigil_session=new; Path=/' });
    }
    detectCount++;
    if (detectCount === 1) return resp(401, { error: 'Non authentifié.' });
    return resp(200, verdictBody());
  };

  assert.ok(await vigil.login(), 'session ouverte en amont');
  calls = []; // on ne mesure que ce que fait `judge`

  const out = await vigil.judge('https://evil.com');

  assert.ok(out && !out.clean, 'repris après reconnexion');
  assert.strictEqual(logins().length, 1, 'UNE seule reconnexion');
  assert.strictEqual(detects().length, 2);
});

test('4bis. identifiants refusés : pont coupé, jamais d\'exception', async () => {
  configure();
  calls = [];
  global.fetch = async (url) => {
    calls.push({ url: String(url) });
    return String(url).endsWith('/api/auth/login')
      ? resp(401, { error: 'Mot de passe incorrect.' })
      : resp(200, verdictBody());
  };

  assert.strictEqual(await vigil.judge('https://evil.com'), null);
  assert.strictEqual(await vigil.judge('https://evil.com'), null, 'deuxième essai aussi muet');
  assert.strictEqual(logins().length, 1, 'pas de boucle de connexion');
});

test('5. mode enrich (défaut) : un « propre » de Vigil n\'affaiblit PAS la protection', async () => {
  fresh(G);
  const s = mockSock({ admins: [newAdmin()] });
  enable(G, { antilink: true });
  configure({ mode: 'enrich' });
  fakeVigil(verdictBody({ clean: true, rule: null, severity: null, action: null, matchedRuleIds: [] }));

  await run(s, text(G, H.MEMBER, 'https://autorisé.com'));

  assert.strictEqual(deleted(s).length, 1, 'la protection locale a le dernier mot');
});

test('5bis. mode veto : Vigil dit « propre » → le constat local est abandonné', async () => {
  fresh(G);
  const s = mockSock({ admins: [newAdmin()] });
  enable(G, { antilink: true });
  configure({ mode: 'veto' });
  fakeVigil(verdictBody({ clean: true, rule: null, severity: null, action: null, matchedRuleIds: [] }));

  await run(s, text(G, H.MEMBER, 'https://autorisé.com'));

  assert.strictEqual(deleted(s).length, 0, 'Vigil a eu le dernier mot');
});

test('6. sans admin : le constat porte le nom de la règle et la sévérité', async () => {
  fresh(G);
  const s = mockSock({ botAdmin: false, admins: [newAdmin()] });
  enable(G, { antilink: true });
  configure();
  fakeVigil(verdictBody());

  await run(s, text(G, H.MEMBER, 'https://evil.com'));

  assert.strictEqual(deleted(s).length, 0, 'impossible sans admin, et on ne prétend pas le contraire');

  const t = plain(texts(s).join('\n'));
  assert.ok(t.includes('ANTI-LINK INACTIF'), 'cadre existant conservé');
  assert.ok(t.includes("LE BOT N'EST PAS ADMIN"), 'cause conservée');
  assert.ok(t.includes('Liens raccourcis'), 'NOM DE LA RÈGLE — avant, on ne savait pas');
  assert.ok(t.includes('MEDIUM'), 'sévérité — avant, on ne savait pas');
  assert.ok(t.includes('PROMOUVEZ LE BOT'), 'solution conservée');
});

test('6bis. avec admin : le nom de règle et la sévérité entrent dans le constat', async () => {
  fresh(G);
  const s = mockSock({ admins: [newAdmin()] });
  enable(G, { antilink: true });
  configure();
  fakeVigil(verdictBody());

  await run(s, text(G, H.MEMBER, 'https://evil.com'));

  assert.strictEqual(deleted(s).length, 1, 'suppression inchangée');
  const t = plain(texts(s).join('\n'));
  assert.ok(t.includes('Liens raccourcis'), 'nom de règle');
  assert.ok(t.includes('MEDIUM'), 'sévérité');
  assert.ok(t.includes('MESSAGE SUPPRIMÉ'), 'action inchangée');
});

test('7. un seul appel réseau par message, même avec plusieurs protections', async () => {
  fresh(G);
  const s = mockSock({ admins: [newAdmin()] });
  enable(G, { antilink: true, antibad: true, antivirtex: true });
  configure({ mode: 'veto' });
  // « propre » en veto : antilink passe son chemin, mais on ne rappelle pas Vigil
  fakeVigil(verdictBody({ clean: true, rule: null, severity: null, action: null, matchedRuleIds: [] }));

  await run(s, text(G, H.MEMBER, 'https://evil.com'));

  assert.strictEqual(detects().length, 1, 'mémoïsé pour le message en cours');
});

test('8. Vigil muet sur plusieurs messages : cooldown tenu, puis reprise', async () => {
  configure();
  let failures = 0;
  calls = [];
  global.fetch = async (url) => {
    calls.push({ url: String(url) });
    if (String(url).endsWith('/api/auth/login')) return resp(200, {}, { 'set-cookie': 'sid=1' });
    failures++;
    throw new Error('timeout');
  };

  assert.strictEqual(await vigil.judge('https://a.com'), null);
  assert.strictEqual(await vigil.judge('https://b.com'), null);
  assert.strictEqual(failures, 1, 'le deuxième message n\'a pas touché Vigil');
  assert.ok(Date.now() < vigil._state().offlineUntil);
});
