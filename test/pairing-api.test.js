'use strict';
/**
 * Tests de lib/pairing-api.js — VRAIES requêtes HTTP contre le vrai serveur
 * (port éphémère, loopback). La socket WhatsApp est simulée par un objet
 * minimal { requestPairingCode } — tout le reste (serveur, routage, CORS,
 * rate-limit, garde-fous, statique) est réel.
 */
const test = require('node:test');
const assert = require('node:assert');
const { startPairingApi, RATE_MAX, resetRateForTests } = require('../lib/pairing-api');

/** Démarre une API sur un port éphémère avec des callbacks contrôlés. */
function boot(opts = {}) {
  const calls = [];
  const server = startPairingApi({
    getSocket: 'socket' in opts
      ? opts.socket
      : () => ({
        requestPairingCode: async (num) => {
          calls.push(num);
          return 'AbCd1234';
        },
      }),
    isRegistered: opts.isRegistered || (() => false),
    isConnected: opts.isConnected || (() => false),
    status: () => 'EN ATTENTE',
    token: opts.token || '',
    port: 0,
    serveSite: !!opts.serveSite,
    log: () => {},
  });
  return new Promise((resolve, reject) => {
    server.once('listening', () => resolve({
      server,
      port: server.address().port,
      calls,
      base: `http://127.0.0.1:${server.address().port}`,
      close: () => new Promise((r) => {
        // Force close all connections to avoid keep-alive hanging
        try { server.closeAllConnections?.(); } catch {}
        server.close(() => { r(); });
      }),
    }));
    server.once('error', reject);
  });
}

test('GET /status — état du bot au format attendu par le site', async () => {
  const b = await boot();
  try {
    const r = await fetch(`${b.base}/status`);
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.ok, true);
    assert.strictEqual(j.connected, false);
    assert.strictEqual(j.connection, 'EN ATTENTE');
    assert.strictEqual(j.sessions, 0);
    assert.strictEqual(j.active, 0);
  } finally { await b.close(); }
});

test('GET /status — connecté → sessions actives à 1', async () => {
  const b = await boot({ isConnected: () => true });
  try {
    const j = await (await fetch(`${b.base}/status`)).json();
    assert.strictEqual(j.connected, true);
    assert.strictEqual(j.sessions, 1);
    assert.strictEqual(j.active, 1);
  } finally { await b.close(); }
});

test('POST /pair — numéro valide → code 8 caractères, chiffres transmis nus', async () => {
  const b = await boot();
  try {
    const r = await fetch(`${b.base}/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: '+237 659 80 97 51' }),
    });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.code, 'ABCD1234');
    assert.strictEqual(j.code.length, 8);
    assert.deepStrictEqual(b.calls, ['237659809751']);
  } finally { await b.close(); }
});

test('POST /pair — numéro trop court → 400', async () => {
  const b = await boot();
  try {
    const r = await fetch(`${b.base}/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: '123' }),
    });
    assert.strictEqual(r.status, 400);
    const j = await r.json();
    assert.match(j.error, /Numéro invalide/);
    assert.strictEqual(b.calls.length, 0);
  } finally { await b.close(); }
});

test('POST /pair — corps non-JSON → 400 propre', async () => {
  const b = await boot();
  try {
    const r = await fetch(`${b.base}/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'pas du json',
    });
    assert.strictEqual(r.status, 400);
  } finally { await b.close(); }
});

test('PROTECTION — session déjà enregistrée → 409, socket JAMAIS appelée', async () => {
  const b = await boot({ isRegistered: () => true });
  try {
    const r = await fetch(`${b.base}/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: '+237659809751' }),
    });
    assert.strictEqual(r.status, 409);
    const j = await r.json();
    assert.match(j.error, /session est déjà enregistrée/);
    assert.strictEqual(b.calls.length, 0);
  } finally { await b.close(); }
});

test('Socket absente → 503 (réessaie plus tard)', async () => {
  const b = await boot({ socket: null });
  try {
    const r = await fetch(`${b.base}/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: '+237659809751' }),
    });
    assert.strictEqual(r.status, 503);
  } finally { await b.close(); }
});

test('Token — sans en-tête → 401, avec x-api-token → 200', async () => {
  const b = await boot({ token: 'secret-de-test' });
  try {
    const sans = await fetch(`${b.base}/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: '+237659809751' }),
    });
    assert.strictEqual(sans.status, 401);
    assert.strictEqual(b.calls.length, 0);

    const avec = await fetch(`${b.base}/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Token': 'secret-de-test' },
      body: JSON.stringify({ number: '+237659809751' }),
    });
    assert.strictEqual(avec.status, 200);
    assert.strictEqual(b.calls.length, 1);
  } finally { await b.close(); }
});

test('Limitation de débit — plafond atteint → 429', async () => {
  resetRateForTests();
  const b = await boot();
  try {
    const one = () => fetch(`${b.base}/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: '+237659809751' }),
    });
    let last = 0;
    for (let i = 0; i < RATE_MAX + 2; i += 1) last = (await one()).status;
    assert.strictEqual(last, 429);
  } finally { await b.close(); }
});

test('CORS — prévol OPTIONS → 204 + en-têtes', async () => {
  const b = await boot();
  try {
    const r = await fetch(`${b.base}/pair`, { method: 'OPTIONS' });
    assert.strictEqual(r.status, 204);
    assert.strictEqual(r.headers.get('access-control-allow-origin'), '*');
    assert.match(r.headers.get('access-control-allow-methods') || '', /POST/);
  } finally { await b.close(); }
});

test('Route inconnue → 404 JSON avec la liste des routes', async () => {
  const b = await boot();
  try {
    const r = await fetch(`${b.base}/nimporte-quoi`);
    assert.strictEqual(r.status, 404);
    const j = await r.json();
    assert.ok(Array.isArray(j.routes));
  } finally { await b.close(); }
});

test('SERVE_SITE — site statique servi, traversée de chemins bloquée', async () => {
  const b = await boot({ serveSite: true });
  try {
    const home = await fetch(`${b.base}/`);
    assert.strictEqual(home.status, 200);
    assert.match(home.headers.get('content-type') || '', /text\/html/);
    assert.match(await home.text(), /DJOUSSE/);

    const man = await fetch(`${b.base}/manifest.json`);
    assert.strictEqual(man.status, 200);
    assert.match(man.headers.get('content-type') || '', /json/);

    // Tentative de traversée : la vraie config du bot ne doit JAMAIS sortir.
    const evil = await fetch(`${b.base}/../config.js`);
    const txt = await evil.text();
    assert.ok(!txt.includes('pairingApiPort'), 'la config interne a fuité !');
  } finally { await b.close(); }
});
