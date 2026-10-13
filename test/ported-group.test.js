'use strict';
/* Vrais tests node:test — lib/ported-group.js (commandes portées TEDDY-XMD). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const mod = require('../lib/ported-group');

const NOMS = ['antibot', 'automute', 'autounmute', 'groupcron', 'tagadmin'];

function sockSpy() {
  const calls = [];
  return {
    calls,
    groupParticipantsUpdate: async (jid, parts, action) => { calls.push({ m: 'part', jid, parts, action }); },
    groupSettingUpdate: async (jid, mode) => { calls.push({ m: 'setting', jid, mode }); },
    groupMetadata: async (jid) => ({
      subject: 'Test', id: jid,
      participants: [
        { id: '111@s.whatsapp.net', admin: 'admin' },
        { id: '222@s.whatsapp.net', admin: null },
      ],
    }),
  };
}

function boot(initial = {}) {
  const reg = new Map();
  const cmd = (...a) => {
    const fn = a[a.length - 1];
    if (typeof fn !== 'function') return;
    reg.set(a[0], { meta: a[1], fn });
  };
  let settings = { ...mod.DEFAULT, ...initial };
  let saves = 0;
  const sent = [];
  mod.registerPortedGroup(cmd, {
    config: { prefix: '.' },
    saveState: () => { saves += 1; },
    getSettings: () => settings,
    setSettings: (s) => { settings = s; },
    buildFrame: (t, l) => [t, ...l].join('\n'),
    bullet: (k, v) => `${k}: ${v}`,
    send: async (sock, jid, content) => { sent.push({ jid, content }); },
  });
  return { reg, get settings() { return settings; }, get saves() { return saves; }, sent };
}

function mkC(args, q, sock) {
  const out = [];
  const c = {
    args, q: q !== undefined ? q : args.join(' '),
    from: 'grp@g.us', sender: '111@s.whatsapp.net', sock: sock || sockSpy(),
    msg: { key: {}, message: {} },
    reply: async (t) => { out.push(String(t)); },
    error: async (l) => { out.push('ERR: ' + (Array.isArray(l) ? l.join(' ') : l)); },
    success: async (l) => { out.push('OK: ' + (Array.isArray(l) ? l.join(' ') : l)); },
    info: async (l) => { out.push('INFO: ' + (Array.isArray(l) ? l.join(' ') : l)); },
  };
  c._out = out;
  return c;
}

test('les 5 commandes groupe sont enregistrées', () => {
  const b = boot();
  const miss = NOMS.filter((n) => !b.reg.has(n));
  assert.deepEqual(miss, [], `absentes: ${miss.join(', ')}`);
});

test('antibot on/off → état persisté par groupe', async () => {
  const b = boot();
  await b.reg.get('antibot').fn(mkC(['on']));
  assert.equal(b.settings.antibot['grp@g.us'], 'on');
  assert.ok(b.saves >= 1);
  await b.reg.get('antibot').fn(mkC(['off']));
  assert.equal(b.settings.antibot['grp@g.us'], 'off');
});

test('antibot action/warn → action mémorisée', async () => {
  const b = boot();
  await b.reg.get('antibot').fn(mkC(['action', 'warn']));
  assert.equal(b.settings.antibotAction['grp@g.us'], 'warn');
  const c = mkC(['action', 'super-invalide']);
  await b.reg.get('antibot').fn(c);
  assert.match(c._out.join(' '), /ACTION INCONNUE/);
});

test('automute 21:30 → heure normalisée + cron actif ; del → retirée', async () => {
  mod.stopCron();
  const b = boot();
  await b.reg.get('antibot'); /* warm */
  const c = mkC(['9:30']);
  await b.reg.get('automute').fn(c);
  assert.equal(b.settings.muteAt['grp@g.us'], '09:30', 'normalisé HH:MM');
  mod.stopCron();
  await b.reg.get('automute').fn(mkC(['del']));
  assert.equal(b.settings.muteAt['grp@g.us'], undefined);
});

test('automute heure invalide → erreur propre', async () => {
  const b = boot();
  const c = mkC(['25:99']);
  await b.reg.get('automute').fn(c);
  assert.match(c._out.join(' '), /HEURE INVALIDE/);
});

test('onParticipantAdd : bot détecté + antibot ON → expulsion réelle', async () => {
  const sock = sockSpy();
  const n = await mod.onParticipantAdd(sock, 'grp@g.us', ['bot12345@s.whatsapp.net'], {
    ...mod.DEFAULT, antibot: { 'grp@g.us': 'on' }, antibotAction: { 'grp@g.us': 'remove' },
  });
  assert.equal(n, 1, 'un suspect');
  assert.ok(sock.calls.some((x) => x.m === 'part' && x.action === 'remove' && x.parts[0] === 'bot12345@s.whatsapp.net'));
});

test('onParticipantAdd : antibot OFF → aucune action', async () => {
  const sock = sockSpy();
  const n = await mod.onParticipantAdd(sock, 'grp@g.us', ['bot12345@s.whatsapp.net'], { ...mod.DEFAULT });
  assert.equal(n, undefined, 'rien fait');
  assert.equal(sock.calls.length, 0);
});

test('onParticipantAdd : humain normal → aucune action', async () => {
  const sock = sockSpy();
  const n = await mod.onParticipantAdd(sock, 'grp@g.us', ['229123456789@s.whatsapp.net'], {
    ...mod.DEFAULT, antibot: { 'grp@g.us': 'on' },
  });
  assert.equal(n, undefined);
  assert.equal(sock.calls.length, 0);
});

test('tagadmin → mentionne les admins du groupe', async () => {
  const sock = sockSpy();
  const b = boot();
  const c = mkC(['Message', 'pour', 'les', 'admins'], 'Message pour les admins', sock);
  await b.reg.get('tagadmin').fn(c);
  assert.equal(b.sent.length, 1, 'un message envoyé');
  assert.deepEqual(b.sent[0].content.mentions, ['111@s.whatsapp.net']);
  assert.match(b.sent[0].content.text, /APPEL AUX ADMINS/);
});

test('groupcron affiche la programmation', async () => {
  const b = boot({ antibot: { 'grp@g.us': 'on' }, muteAt: { 'grp@g.us': '21:30' } });
  const c = mkC([]);
  await b.reg.get('groupcron').fn(c);
  assert.match(c._out.join(' '), /PROGRAMMATION/);
  assert.match(c._out.join(' '), /21:30/);
});
