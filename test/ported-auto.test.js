'use strict';
/* Vrais tests node:test — lib/ported-auto.js (commandes portées TEDDY-XMD).
   On mesure les VRAIS appels Baileys via des sockets espions. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const mod = require('../src/lib/ported-auto');

const NOMS = ['alwaysonline', 'autotyping', 'autorecord', 'autobio',
  'autodlstatus', 'autoreply', 'pmpermit', 'autosettings'];

/* socket espion : enregistre chaque appel sendPresenceUpdate / updateProfileStatus */
function sockSpy() {
  const calls = [];
  return {
    calls,
    sendPresenceUpdate: async (type, jid) => { calls.push({ m: 'presence', type, jid }); },
    updateProfileStatus: async (t) => { calls.push({ m: 'bio', text: String(t) }); },
  };
}

function boot(initial = {}, sent = []) {
  const reg = new Map();
  const cmd = (...a) => {
    const fn = a[a.length - 1];
    if (typeof fn !== 'function') return;
    reg.set(a[0], { meta: a[1], fn });
  };
  let settings = { ...mod.DEFAULT, ...initial };
  let saves = 0;
  mod.registerPortedAuto(cmd, {
    config: { prefix: '.' },
    send: async (sock, jid, content) => { sent.push({ jid, content }); },
    saveState: () => { saves += 1; },
    getSettings: () => settings,
    setSettings: (s) => { settings = s; },
    buildFrame: (t, l) => [t, ...l].join('\n'),
    bullet: (k, v) => `${k}: ${v}`,
  });
  return { reg, get settings() { return settings; }, get saves() { return saves; } };
}

function mkC(args, q, sock) {
  const out = [];
  const c = {
    args, q: q !== undefined ? q : args.join(' '),
    from: '123@g.us', sender: '229@s.whatsapp.net', sock: sock || sockSpy(),
    msg: { key: {}, message: {} },
    reply: async (t) => { out.push(String(t)); },
    error: async (l) => { out.push('ERR: ' + (Array.isArray(l) ? l.join(' ') : l)); },
    success: async (l) => { out.push('OK: ' + (Array.isArray(l) ? l.join(' ') : l)); },
    info: async (l) => { out.push('INFO: ' + (Array.isArray(l) ? l.join(' ') : l)); },
  };
  c._out = out;
  return c;
}

test('les 8 commandes auto sont enregistrées', () => {
  const b = boot();
  const miss = NOMS.filter((n) => !b.reg.has(n));
  assert.deepEqual(miss, [], `absentes: ${miss.join(', ')}`);
});

test('alwaysonline on → présence "available" envoyée + état persisté', async () => {
  const sock = sockSpy();
  const b = boot();
  const c = mkC(['on'], undefined, sock);
  await b.reg.get('alwaysonline').fn(c);
  assert.match(c._out.join(' '), /OK|EN LIGNE/);
  assert.equal(b.settings.alwaysonline, true);
  assert.ok(b.saves >= 1, 'saveState appelé');
  assert.ok(sock.calls.some((x) => x.m === 'presence' && x.type === 'available'), 'présence available envoyée');
  mod.stopOnlineTimer(); // nettoie le timer du test
});

test('alwaysonline off → timer arrêté, état persisté', async () => {
  const b = boot({ alwaysonline: true });
  await b.reg.get('alwaysonline').fn(mkC(['off']));
  assert.equal(b.settings.alwaysonline, false);
});

test('autotyping on et autorecord off (présences exclusives)', async () => {
  const b = boot();
  await b.reg.get('autotyping').fn(mkC(['on']));
  assert.equal(b.settings.autotyping, true);
  await b.reg.get('autorecord').fn(mkC(['on']));
  assert.equal(b.settings.autorecord, true);
  assert.equal(b.settings.autotyping, false, 'autotyping doit être désactivé');
});

test('autobio <texte> → updateProfileStatus appelé avec le texte', async () => {
  const sock = sockSpy();
  const b = boot();
  const c = mkC([], 'DJOUSSE TECH', sock);
  await b.reg.get('autobio').fn(c);
  assert.match(c._out.join(' '), /BIO MISE À JOUR|OK/);
  assert.equal(b.settings.autobio, true);
  assert.equal(b.settings.autobioText, 'DJOUSSE TECH');
  assert.ok(sock.calls.some((x) => x.m === 'bio' && x.text === 'DJOUSSE TECH'), 'bio envoyée');
});

test('onMessage autotyping actif → présence "composing" sur le bon jid', async () => {
  const sock = sockSpy();
  await mod.onMessage({
    sock, from: '229@s.whatsapp.net', sender: '229@s.whatsapp.net', senderNum: '229',
    isGroup: false, fromMe: false, isCommand: false, isOwner: false,
    settings: { ...mod.DEFAULT, autotyping: true },
  });
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(sock.calls.some((x) => x.m === 'presence' && x.type === 'composing' && x.jid === '229@s.whatsapp.net'));
});

test('onMessage autoreply actif (MP, non commande) → message envoyé', async () => {
  const sent = [];
  boot({ autoreply: true, autoreplyText: 'ABSENT' }, sent);
  await mod.onMessage({
    sock: sockSpy(), from: '229@s.whatsapp.net', sender: '229@s.whatsapp.net',
    isGroup: false, fromMe: false, isCommand: false, isOwner: false,
    settings: { ...mod.DEFAULT, autoreply: true, autoreplyText: 'ABSENT' },
  });
  assert.equal(sent.length, 1, 'un message auto envoyé');
  assert.equal(sent[0].content.text, 'ABSENT');
  assert.equal(sent[0].jid, '229@s.whatsapp.net');
});

test('onMessage : aucune commande pas d\'effet parasite quand tout est off', async () => {
  const sock = sockSpy();
  await mod.onMessage({
    sock, from: '229@s.whatsapp.net', sender: '229@s.whatsapp.net', senderNum: '229',
    isGroup: false, fromMe: false, isCommand: false, isOwner: false,
    settings: { ...mod.DEFAULT },
  });
  assert.equal(sock.calls.length, 0, 'aucune présence envoyée');
});

test('autosettings affiche le récapitulatif', async () => {
  const b = boot({ alwaysonline: true });
  const c = mkC([]);
  await b.reg.get('autosettings').fn(c);
  assert.match(c._out.join(' '), /RÉGLAGES AUTO/);
  assert.match(c._out.join(' '), /TOUJOURS EN LIGNE/);
});

test('usages incorrects → message d\'erreur, pas de crash', async () => {
  const b = boot();
  for (const n of ['alwaysonline', 'autotyping', 'autorecord', 'pmpermit', 'autodlstatus']) {
    const c = mkC([]);
    await b.reg.get(n).fn(c);
    assert.match(c._out.join(' '), /ERR|USAGE/, `${n} sans argument`);
  }
});
