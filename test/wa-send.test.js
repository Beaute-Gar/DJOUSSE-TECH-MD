'use strict';

/**
 * test/wa-send.test.js — MODULE 2 : humanisation du transport
 * Délai humain sur le texte uniquement, présence « écrit… » idempotente,
 * robustesse socket. Style : node:test (aligné sur test/auth.test.js).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const waSend = require('../lib/wa-send');
const config = require('../config');

const savedAutoTyping = config.autoTyping;
const savedEnv = {
  HUMAN_DELAY: process.env.HUMAN_DELAY,
  HUMAN_DELAY_MIN: process.env.HUMAN_DELAY_MIN,
  HUMAN_DELAY_MAX: process.env.HUMAN_DELAY_MAX,
};

function clearEnv() {
  delete process.env.HUMAN_DELAY;
  delete process.env.HUMAN_DELAY_MIN;
  delete process.env.HUMAN_DELAY_MAX;
}

function restoreEnv() {
  clearEnv();
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  config.autoTyping = savedAutoTyping;
}

function makeSock() {
  const sends = [];
  const presences = [];
  return {
    sends,
    presences,
    sock: {
      sendMessage: async (jid, content, opts) => { sends.push({ jid, content, opts }); return { ok: 1 }; },
      sendPresenceUpdate: async (ev, jid) => { presences.push({ ev, jid }); },
    },
  };
}

test.beforeEach(() => {
  clearEnv();
  config.autoTyping = true; // on force la présence pour tester la branche active
});

test.after(restoreEnv);

test('texte : délai humain borné puis envoi (résultat Baileys transmis)', async () => {
  process.env.HUMAN_DELAY_MIN = '200';
  process.env.HUMAN_DELAY_MAX = '250';
  const { sock, sends } = makeSock();
  const t0 = Date.now();
  const res = await waSend.send(sock, 'a@s.whatsapp.net', { text: 'bonjour' });
  const elapsed = Date.now() - t0;
  assert.equal(res.ok, 1);
  assert.equal(sends.length, 1);
  assert.ok(elapsed >= 195, `délai humain attendu ≥200 ms, obtenu ${elapsed} ms`);
  assert.ok(elapsed <= 900, `délai plafonné, obtenu ${elapsed} ms`);
});

test('texte : présence composing ouverte UNE fois puis paused après envoi', async () => {
  process.env.HUMAN_DELAY_MIN = '1';
  process.env.HUMAN_DELAY_MAX = '2';
  const { sock, presences } = makeSock();
  waSend.typingOn(sock, 't@s.whatsapp.net');
  waSend.typingOn(sock, 't@s.whatsapp.net'); // doublon → no-op
  assert.equal(presences.filter((p) => p.ev === 'composing').length, 1);

  await waSend.send(sock, 't@s.whatsapp.net', { text: 'réponse' });
  assert.equal(presences.filter((p) => p.ev === 'composing').length, 1, 'pas de 2ᵉ composing');
  assert.equal(presences.filter((p) => p.ev === 'paused').length, 1, 'fermeture après envoi');

  waSend.typingOff(sock, 't@s.whatsapp.net'); // déjà fermé → no-op
  assert.equal(presences.filter((p) => p.ev === 'paused').length, 1, 'typingOff tardif idempotent');
});

test('autoTyping off : aucune présence, délai toujours actif', async () => {
  config.autoTyping = false;
  process.env.HUMAN_DELAY_MIN = '1';
  process.env.HUMAN_DELAY_MAX = '2';
  const { sock, presences } = makeSock();
  waSend.typingOn(sock, 't@s.whatsapp.net');
  await waSend.send(sock, 't@s.whatsapp.net', { text: 'réponse' });
  assert.equal(presences.length, 0);
});

test('contenu non-texte (réaction) : envoi immédiat, sans présence', async () => {
  process.env.HUMAN_DELAY_MIN = '250';
  process.env.HUMAN_DELAY_MAX = '300';
  const { sock, presences } = makeSock();
  const t0 = Date.now();
  await waSend.send(sock, 'b@s.whatsapp.net', { react: { text: '👍' } });
  const elapsed = Date.now() - t0;
  assert.ok(elapsed < 150, `réaction sans délai, obtenu ${elapsed} ms`);
  assert.equal(presences.length, 0);
});

test('HUMAN_DELAY=0 coupe le délai sur le texte', async () => {
  process.env.HUMAN_DELAY = '0';
  process.env.HUMAN_DELAY_MIN = '250';
  process.env.HUMAN_DELAY_MAX = '300';
  const { sock } = makeSock();
  const t0 = Date.now();
  await waSend.send(sock, 'c@s.whatsapp.net', { text: 'instantané' });
  const elapsed = Date.now() - t0;
  assert.ok(elapsed < 150, `délai coupé, obtenu ${elapsed} ms`);
});

test('socket absent ou incomplet → undefined (aucune TypeError)', async () => {
  assert.equal(await waSend.send(null, 'x@s.whatsapp.net', { text: 'y' }), undefined);
  assert.equal(await waSend.send({}, 'x@s.whatsapp.net', { text: 'y' }), undefined);
});

test('humanDelayMs : bornes respectées sur 25 tirages + coupure', () => {
  process.env.HUMAN_DELAY_MIN = '100';
  process.env.HUMAN_DELAY_MAX = '150';
  for (let i = 0; i < 25; i += 1) {
    const v = waSend.humanDelayMs();
    assert.ok(v >= 100 && v <= 150, `tirage ${v} hors bornes [100–150]`);
  }
  process.env.HUMAN_DELAY = '0';
  assert.equal(waSend.humanDelayMs(), 0);
});


test('file globale : les envois simultanés sont exécutés dans l’ordre', async () => {
  process.env.HUMAN_DELAY = '0';
  const order = [];
  let active = 0;
  let maxActive = 0;
  const sock = {
    sendMessage: async (_jid, content) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      order.push('start:' + content.text);
      await new Promise((resolve) => setTimeout(resolve, 15));
      order.push('end:' + content.text);
      active -= 1;
      return { text: content.text };
    },
    sendPresenceUpdate: async () => {},
  };
  const results = await Promise.all([
    waSend.send(sock, 'a@s.whatsapp.net', { text: 'un' }),
    waSend.send(sock, 'b@s.whatsapp.net', { text: 'deux' }),
    waSend.send(sock, 'c@s.whatsapp.net', { text: 'trois' }),
  ]);
  assert.deepEqual(results.map((x) => x.text), ['un', 'deux', 'trois']);
  assert.deepEqual(order, ['start:un', 'end:un', 'start:deux', 'end:deux', 'start:trois', 'end:trois']);
  assert.equal(maxActive, 1);
});

test('erreur d’un envoi : les suivants continuent à passer', async () => {
  process.env.HUMAN_DELAY = '0';
  const sent = [];
  const sock = {
    sendMessage: async (_jid, content) => {
      sent.push(content.text);
      if (content.text === 'échoue') throw new Error('erreur de test');
      return { ok: true };
    },
    sendPresenceUpdate: async () => {},
  };
  const first = waSend.send(sock, 'a@s.whatsapp.net', { text: 'échoue' });
  const second = waSend.send(sock, 'a@s.whatsapp.net', { text: 'après' });
  await assert.rejects(first, /erreur de test/);
  assert.deepEqual(await second, { ok: true });
  assert.deepEqual(sent, ['échoue', 'après']);
});

test('file pleine : rejet explicite, puis reprise après vidage', async () => {
  const oldMax = process.env.WA_SEND_QUEUE_MAX;
  process.env.WA_SEND_QUEUE_MAX = '1';
  process.env.HUMAN_DELAY = '0';
  let release;
  const sock = {
    sendMessage: async (_jid, content) => {
      if (content.text === 'bloqué') await new Promise((resolve) => { release = resolve; });
      return { ok: true };
    },
    sendPresenceUpdate: async () => {},
  };
  try {
    const first = waSend.send(sock, 'a@s.whatsapp.net', { text: 'bloqué' });
    await new Promise((resolve) => setImmediate(resolve));
    await assert.rejects(
      waSend.send(sock, 'a@s.whatsapp.net', { text: 'refusé' }),
      (error) => error.code === 'WA_SEND_QUEUE_FULL'
    );
    release();
    await first;
    assert.equal(waSend.getQueueState().pending, 0);
    assert.deepEqual(await waSend.send(sock, 'a@s.whatsapp.net', { text: 'repris' }), { ok: true });
  } finally {
    if (oldMax === undefined) delete process.env.WA_SEND_QUEUE_MAX;
    else process.env.WA_SEND_QUEUE_MAX = oldMax;
  }
});
