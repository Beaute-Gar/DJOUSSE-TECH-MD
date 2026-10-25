'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { registerPortedFoot, COMPS, DONNEES, appelApi, getKey } = require('../src/lib/ported-foot');

function boot() {
  const reg = new Map();
  registerPortedFoot((...a) => {
    const fn = a[a.length - 1];
    if (typeof fn === 'function') reg.set(a[0], { fn });
  }, {
    config: { prefix: '.' },
    send: async () => {},
    buildFrame: (t, l) => [t, ...l].join('\n'),
    bullet: (k, v) => `${k}: ${v}`,
  });
  return reg;
}

function mkC(reg, q) {
  const out = [];
  const c = {
    args: (q || '').split(' ').filter(Boolean), q: q || '',
    from: '1@g.us', sender: '1@s.whatsapp.net', sock: {}, msg: { key: {}, message: {} },
    reply: async (t) => out.push(String(t)),
    error: async (l) => out.push('ERR: ' + (Array.isArray(l) ? l.join(' ') : l)),
  };
  c._out = out;
  return c;
}

test('les 37 commandes football sont generees (9 ligues x 4 + football)', () => {
  const reg = boot();
  const attendus = [];
  for (const ligue of Object.keys(COMPS)) for (const s of Object.keys(DONNEES)) attendus.push(`${ligue}_${s}`);
  attendus.push('football');
  const miss = attendus.filter((n) => !reg.has(n));
  assert.deepEqual(miss, [], `absentes: ${miss.join(', ')}`);
  assert.equal(attendus.filter((n) => n !== 'football').length, 36);
});

test('sans FOOTBALL_API_KEY → message clair, jamais de crash', async () => {
  const ancien = process.env.FOOTBALL_API_KEY;
  delete process.env.FOOTBALL_API_KEY;
  const reg = boot();
  const c = mkC(reg);
  await reg.get('laliga_table').fn(c);
  assert.match(c._out.join(' '), /CLÉ API REQUISE/);
  assert.match(c._out.join(' '), /FOOTBALL_API_KEY/);
  if (ancien !== undefined) process.env.FOOTBALL_API_KEY = ancien;
});

test('avec une clé bidon → erreur propre de l\'API (pas de plantage)', async () => {
  process.env.FOOTBALL_API_KEY = 'cle-invalide-pour-test';
  const reg = boot();
  const c = mkC(reg);
  await reg.get('epl_table').fn(c);
  /* soit l'API refuse (403/400), soit le quota : dans tous les cas un
     message d'erreur explicite, jamais un THROW */
  assert.ok(c._out.join(' ').length > 0, 'une reponse est produite');
  assert.ok(!c._out.join(' ').includes('undefined'), 'pas de undefined');
  delete process.env.FOOTBALL_API_KEY;
});

test('football (aide) affiche l\'etat de la cle et les ligues', async () => {
  const reg = boot();
  const c = mkC(reg);
  await reg.get('football').fn(c);
  assert.match(c._out.join(' '), /FOOTBALL LIVE/);
  assert.match(c._out.join(' '), /bundesliga/);
});

test('appelApi: url correcte et en-tete X-Auth-Token', async () => {
  const capture = [];
  const origFetch = global.fetch;
  global.fetch = async (url, opts) => {
    capture.push({ url: String(url), token: opts?.headers?.['X-Auth-Token'] });
    return { ok: true, status: 200, json: async () => ({ standings: [] }) };
  };
  process.env.FOOTBALL_API_KEY = 'test-token';
  try {
    await appelApi('/PD/standings');
    assert.equal(capture[0].url, 'https://api.football-data.org/v4/competitions/PD/standings');
    assert.equal(capture[0].token, 'test-token');
  } finally { global.fetch = origFetch; }
});
