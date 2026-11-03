'use strict';

/**
 * test/wa-modules.test.js — couche anti-détection
 * Vérifie les modules SANS réseau ni vrai socket :
 *   - délais / normalisation JID ;
 *   - découpage en bursts ;
 *   - file sérialisée par JID (compteurs réels, QUEUE_FULL) ;
 *   - WaSecure via sendFn injecté (aucun appel direct au socket) ;
 *   - présence probabiliste + accusé de lecture différé ;
 *   - identité persistée ;
 *   - rotation/blacklist proxy.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  computeDelay,
  normalizeJid,
  sleep,
} = require('../src/lib/wa-delay');
const {
  JidQueue,
  WaSecure,
  splitBursts,
} = require('../src/lib/wa-secure');
const { PresenceManager } = require('../src/lib/wa-presence');
const { SessionIdentity } = require('../src/lib/wa-identity');
const { ProxyManager } = require('../src/lib/wa-proxy');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'djousse-wa-'));
}

function fakeSock() {
  return {
    ws: { isOpen: true },
    sendMessage() {
      throw new Error('WaSecure ne doit jamais appeler sock.sendMessage directement');
    },
    sendPresenceUpdate: async () => {},
    readMessages: async () => {},
  };
}

/* ─── Délais & JID ─────────────────────────────────────────────── */

test('normalizeJid : numéro nu, suffixe appareil, groupes/statuts intacts', () => {
  assert.equal(normalizeJid('237690000000'), '237690000000@s.whatsapp.net');
  assert.equal(normalizeJid('237690000000:12@s.whatsapp.net'), '237690000000@s.whatsapp.net');
  assert.equal(normalizeJid('1203630@g.us'), '1203630@g.us');
  assert.equal(normalizeJid('status@broadcast'), 'status@broadcast');
  assert.equal(normalizeJid('123@newsletter'), '123@newsletter');
  assert.equal(normalizeJid('123@lid'), '123@lid');
});

test('computeDelay : bornes respectées et groupe plus rapide que DM', () => {
  const cfg = { MIN_DELAY_MS: 800, MAX_DELAY_MS: 25000, BASE_THINK_MS: 1200, JITTER: 0 };
  const dm = computeDelay({ incoming: 'bonjour', outgoing: 'réponse', jid: 'a@s.whatsapp.net', cfg });
  const group = computeDelay({ incoming: 'bonjour', outgoing: 'réponse', jid: '1@g.us', cfg });
  assert.ok(dm >= 800 && dm <= 25000);
  assert.ok(group < dm, `groupe ${group} devrait être < DM ${dm}`);
});

test('splitBursts : reconstruit le texte et produit plusieurs segments', () => {
  const text = 'Premier paragraphe. Deuxième phrase assez longue, avec une virgule ; et une fin.';
  const parts = splitBursts(text, 3);
  assert.ok(parts.length >= 2);
  assert.equal(parts.join(''), text);
  assert.ok(parts.every((p) => p.length > 0));
});

/* ─── File par JID ────────────────────────────────────────────── */

test('JidQueue : envois du même JID strictement sérialisés', async () => {
  const queue = new JidQueue({ QUEUE_ENABLED: true, QUEUE_MAX_PER_JID: 10, QUEUE_TIMEOUT_MS: 0 });
  const order = [];

  const first = queue.enqueue('a@s.whatsapp.net', async () => {
    order.push('a-start');
    await sleep(20);
    order.push('a-end');
  });
  const second = queue.enqueue('a@s.whatsapp.net', async () => {
    order.push('b');
  });

  assert.equal(queue.pendingTotal, 2);
  await Promise.all([first, second]);
  assert.deepEqual(order, ['a-start', 'a-end', 'b']);
  assert.equal(queue.pendingTotal, 0);
});

test('JidQueue : QUEUE_FULL réel et compteurs remis à zéro', async () => {
  const queue = new JidQueue({ QUEUE_ENABLED: true, QUEUE_MAX_PER_JID: 1, QUEUE_TIMEOUT_MS: 0 });
  let release;
  const gate = new Promise((resolve) => { release = resolve; });

  const first = queue.enqueue('a@s.whatsapp.net', async () => { await gate; });
  await assert.rejects(
    queue.enqueue('a@s.whatsapp.net', async () => {}),
    /QUEUE_FULL/,
  );
  release();
  await first;
  assert.equal(queue.pendingTotal, 0);
});

/* ─── WaSecure ────────────────────────────────────────────────── */

test('WaSecure : passe par sendFn (jamais par le socket) et normalise le JID', async () => {
  const calls = [];
  const secure = new WaSecure(fakeSock(), {}, {
    sendFn: async (sock, jid, payload, opts) => { calls.push({ jid, payload, opts }); return { ok: true }; },
    cfg: {
      QUEUE_ENABLED: false,
      WARMUP_ENABLED: false,
      BURST_ENABLED: false,
      MAX_RETRIES: 1,
      VERBOSE: false,
    },
  });

  const result = await secure.reply('237690000000', null, 'bonjour', { skipDelay: true, skipTyping: true });
  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].jid, '237690000000@s.whatsapp.net');
  assert.equal(calls[0].payload.text, 'bonjour');
  secure.stop();
});

test('WaSecure : blacklist et quota minute', async () => {
  const secure = new WaSecure(fakeSock(), {}, {
    sendFn: async () => ({ ok: true }),
    cfg: {
      QUEUE_ENABLED: false,
      WARMUP_ENABLED: false,
      BURST_ENABLED: false,
      MAX_RETRIES: 1,
      PER_MINUTE: 1,
      BLACKLIST: ['bad@s.whatsapp.net'],
    },
  });

  await assert.rejects(
    secure.reply('bad@s.whatsapp.net', null, 'x', { skipDelay: true, skipTyping: true }),
    /BLOCKED_JID/,
  );

  await secure.reply('good@s.whatsapp.net', null, 'un', { skipDelay: true, skipTyping: true });
  await assert.rejects(
    secure.reply('good@s.whatsapp.net', null, 'deux', { skipDelay: true, skipTyping: true }),
    (e) => e.code === 'RATE_MINUTE',
  );
  secure.stop();
});

/* ─── Présence ────────────────────────────────────────────────── */

test('PresenceManager : lecture probabiliste, délai et hors-ligne', async () => {
  const dir = tempDir();
  const originalRandom = Math.random;
  Math.random = () => 0;

  try {
    const presence = new PresenceManager({
      cfg: {
        PERSIST_FILE: path.join(dir, 'presence.json'),
        OFFLINE_CHUNKS: 0,
        RESPECT_PERSONA: false,
        READ_PROBABILITY: 1,
        MIN_READ_DELAY_MS: 0,
        MAX_READ_DELAY_MS: 0,
        VERBOSE: false,
      },
    });

    const msg = {
      key: { id: '1', remoteJid: 'a@s.whatsapp.net' },
      messageTimestamp: Math.floor(Date.now() / 1000) - 10,
    };

    let reads = 0;
    const sock = { readMessages: async () => { reads += 1; } };
    assert.equal(presence.shouldRead(msg, 'texte court'), true);
    assert.equal(presence.scheduleRead(sock, msg, 'texte court'), true);
    await sleep(20);
    assert.equal(reads, 1);

    presence.cfg.READ_PROBABILITY = 0;
    assert.equal(presence.shouldRead(msg, 'texte court'), false);
    presence.stop();
  } finally {
    Math.random = originalRandom;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/* ─── Identité ────────────────────────────────────────────────── */

test('SessionIdentity : identité identique après rechargement du fichier', () => {
  const dir = tempDir();
  try {
    const file = path.join(dir, 'identity.json');
    const first = new SessionIdentity({ stateFile: file, verbose: false });
    const before = first.info();
    const second = new SessionIdentity({ stateFile: file, verbose: false });
    const after = second.info();

    assert.equal(after.browser, before.browser);
    assert.equal(after.persona, before.persona);
    assert.equal(after.typingCps, before.typingCps);
    assert.equal(first.socketOptions().browser.length, 3);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/* ─── Proxy ───────────────────────────────────────────────────── */

test('ProxyManager : round-robin, exclusion après échecs et persistance', () => {
  const dir = tempDir();
  try {
    const stateFile = path.join(dir, 'proxy.json');
    const manager = new ProxyManager({
      proxies: ['socks5://127.0.0.1:1080', 'http://127.0.0.1:8080'],
      strategy: 'round_robin',
      stateFile,
      failThreshold: 2,
      verbose: false,
    });

    const first = manager.pick(true);
    const second = manager.pick(true);
    assert.notEqual(first.url, second.url);

    manager.markFailure('socks5://127.0.0.1:1080');
    manager.markFailure('socks5://127.0.0.1:1080');
    assert.equal(manager.isBlocked('socks5://127.0.0.1:1080'), true);
    assert.equal(manager.available.length, 1);

    const reloaded = new ProxyManager({ proxies: ['socks5://127.0.0.1:1080'], stateFile });
    assert.equal(reloaded.isBlocked('socks5://127.0.0.1:1080'), true, 'état de santé persisté');

    manager.stop();
    reloaded.stop();
    assert.deepEqual(new ProxyManager({ proxies: [] }).getSocketAgents(), {});
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
