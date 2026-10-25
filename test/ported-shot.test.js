'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { registerPortedShot, buildThum, DEVICES } = require('../src/lib/ported-shot');

test('buildThum : URL et options correctement assemblées', () => {
  assert.equal(
    buildThum('https://exemple.com', { full: true }),
    'https://image.thum.io/get/fullpage/https://exemple.com');
  assert.equal(
    buildThum('https://exemple.com', { width: 1200 }),
    'https://image.thum.io/get/width/1200/https://exemple.com');
  /* les presets sont en minuscules : camelCase normalisé */
  assert.equal(
    buildThum('https://exemple.com', { device: 'iphoneX' }),
    'https://image.thum.io/get/width/375/crop/812/https://exemple.com');
  assert.equal(
    buildThum('https://exemple.com', { device: 'galaxys5' }),
    'https://image.thum.io/get/width/360/crop/640/https://exemple.com');
  assert.equal(Object.keys(DEVICES).length, 7);
});

test('commande screenshot enregistrée avec ses alias', () => {
  let vus = [];
  registerPortedShot((...a) => {
    const fn = a[a.length - 1];
    if (typeof fn === 'function') vus.push({ name: a[0], aliases: a[1] });
  }, { config: { prefix: '.' }, send: async () => {} });
  const cmd = vus.find((v) => v.name === 'screenshot');
  assert.ok(cmd, 'commande screenshot');
  assert.deepEqual(cmd.aliases, ['ss']);
});

test('parsing des options : full, width=, device', async () => {
  const reg = new Map();
  let envoye = null;
  registerPortedShot((...a) => {
    const fn = a[a.length - 1];
    if (typeof fn === 'function') reg.set(a[0], { fn });
  }, { config: { prefix: '.' }, send: async (s, j, content) => { envoye = content; } });
  const out = [];
  const c = {
    args: [], q: 'exemple.com full width=1200',
    from: '1@g.us', sender: '1@s.whatsapp.net', sock: {}, msg: { key: {}, message: {} },
    reply: async (t) => out.push(String(t)), error: async (l) => out.push('ERR: ' + (Array.isArray(l) ? l.join(' ') : l)),
  };
  await reg.get('screenshot').fn(c);
  assert.match(String(envoye?.image?.url), /^https:\/\/image\.thum\.io\/get\/width\/1200\/fullpage\/https:\/\/exemple\.com$/);
});

test('sans argument → aide d\'usage', async () => {
  const reg = new Map();
  registerPortedShot((...a) => {
    const fn = a[a.length - 1];
    if (typeof fn === 'function') reg.set(a[0], { fn });
  }, { config: { prefix: '.' }, send: async () => {} });
  const out = [];
  const c = {
    args: [], q: '', from: '1@g.us', sender: '1@s.whatsapp.net', sock: {}, msg: { key: {}, message: {} },
    reply: async (t) => out.push(String(t)), error: async (l) => out.push('ERR: ' + (Array.isArray(l) ? l.join(' ') : l)),
  };
  await reg.get('screenshot').fn(c);
  assert.match(out.join(' '), /URL MANQUANTE/);
  assert.match(out.join(' '), /Options\s*:/);
});

test('RÉEL — thum.io renvoie une vraie image d\'un site', async () => {
  const u = buildThum('https://example.com', { width: 1200 });
  const r = await fetch(u, { signal: AbortSignal.timeout(45000) });
  assert.equal(r.status, 200);
  const b = Buffer.from(await r.arrayBuffer());
  assert.ok(b.length > 2000, `trop petite: ${b.length}`);
  const isPng = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const isJpg = b[0] === 0xff && b[1] === 0xd8;
  const isWebp = b.slice(8, 12).toString() === 'WEBP';
  assert.ok(isPng || isJpg || isWebp, 'signature image non reconnue');
}, 90000);
