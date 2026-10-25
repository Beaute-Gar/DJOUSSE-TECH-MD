'use strict';
/* Vrais tests node:test — lib/ported-fun.js (commandes portées TEDDY-XMD). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { registerPortedFun, ANIMS, WEEB, playAnim } = require('../src/lib/ported-fun');

test('les 22 commandes fun/réactions sont enregistrées (nikal/hand exclus)', () => {
  const reg = new Map();
  const mod = require('../src/lib/ported-fun');
  mod.registerPortedFun((...a) => {
    const fn = a[a.length - 1];
    if (typeof fn === 'function') reg.set(a[0], fn);
  }, { config: { prefix: '.' }, send: async () => {} });
  const attendues = [...Object.keys(mod.ANIMS), ...mod.REACTIONS.map((n) => `a${n}`)];
  const miss = attendues.filter((n) => !reg.has(n));
  assert.deepEqual(miss, [], `absentes: ${miss.join(', ')}`);
  assert.equal(attendues.length, 22);
  assert.equal(reg.has('nikal'), false, 'nikal exclu (vulgaire)');
  assert.equal(reg.has('hand'), false, 'hand exclu (contenu sexuel)');
  assert.equal(reg.has('waifu'), false, 'API waifu.pics morte, remplacee');
});

test('playAnim : éditions protocolMessage type 14 sur le bon message', async () => {
  const edits = [];
  const sentMessages = [];
  const sock = {
    relayMessage: async (jid, msg) => { edits.push({ jid, type: msg.protocolMessage.type, key: msg.protocolMessage.key }); },
  };
  const mod = require('../src/lib/ported-fun');
  /* injection du send via le register (comme en production) */
  mod.registerPortedFun(() => {}, {
    config: { prefix: '.' },
    send: async (s, jid, content) => { sentMessages.push({ jid, content }); return { key: { remoteJid: jid, id: 'MSG1', fromMe: true } }; },
  });
  process.env.PORTED_ANIM_MS = '1';
  await mod.playAnim(sock, 'grp@g.us', ['A', 'B', 'C'], 'TEST');
  assert.equal(sentMessages.length, 1, 'message initial envoye via lib/wa-send');
  assert.equal(edits.length, 3, 'une edition par frame');
  assert.ok(edits.every((e) => e.type === 14 && e.key.id === 'MSG1' && e.jid === 'grp@g.us'));
});

test('appel reseau reel : otakugifs renvoie un GIF anime SFW', async () => {
  const r = await fetch('https://api.otakugifs.xyz/gif?reaction=hug', { signal: AbortSignal.timeout(15000) });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.match(String(d.url), /otakugifs\.xyz\/gifs\/hug\/.+\.gif$/);
});
