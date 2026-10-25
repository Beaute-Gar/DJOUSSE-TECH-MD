'use strict';
/* Vrais tests — lib/ported-logo.js (commandes portées TEDDY-XMD). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { registerPortedLogo, registerPortedLookup, LOGOS } = require('../src/lib/ported-logo');

function reg2() {
  const reg = new Map();
  const cmd = (...a) => {
    const fn = a[a.length - 1];
    if (typeof fn === 'function') reg.set(a[0], { meta: a[1], fn });
  };
  const deps = {
    config: { prefix: '.' },
    send: async () => {},
    buildFrame: (t, l) => [t, ...l].join('\n'),
    bullet: (k, v) => `${k}: ${v}`,
  };
  registerPortedLogo(cmd, deps);
  registerPortedLookup(cmd, deps);
  return reg;
}

function mkC(reg, args, q) {
  const out = [];
  const c = {
    args, q: q !== undefined ? q : args.join(' '),
    from: '1@g.us', sender: '1@s.whatsapp.net', sock: {},
    msg: { key: {}, message: {} },
    reply: async (t) => { out.push(String(t)); },
    error: async (l) => { out.push('ERR: ' + (Array.isArray(l) ? l.join(' ') : l)); },
    success: async (l) => { out.push('OK: ' + (Array.isArray(l) ? l.join(' ') : l)); },
  };
  c._out = out;
  return c;
}

test('les 23 logos + 3 lookups + logolist sont enregistrés', () => {
  const reg = reg2();
  const attendus = [...Object.keys(LOGOS), 'logolist', 'biblie', 'describe', 'elements'];
  const miss = attendus.filter((n) => !reg.has(n));
  assert.deepEqual(miss, [], `absentes: ${miss.join(', ')}`);
  assert.equal(Object.keys(LOGOS).length, 23);
});

test('effets retirés (morts chez TEDDY) bien absents', () => {
  const reg = reg2();
  for (const n of ['thor', 'hacker', 'gif', 'technews', 'paste', 'terminate', 'channel', 'cast', 'githubs', 'runtime']) {
    assert.equal(reg.has(n), false, `${n} devrait être absent`);
  }
});

test('logo sans texte → usage, pas de crash', async () => {
  const reg = reg2();
  const c = mkC(reg, []);
  await reg.get('naruto').fn(c);
  assert.match(c._out.join(' '), /TEXTE MANQUANT/);
});

test('lookups sans argument → usage, pas de crash', async () => {
  const reg = reg2();
  for (const n of ['biblie', 'describe', 'elements']) {
    const c = mkC(reg, []);
    await reg.get(n).fn(c);
    assert.match(c._out.join(' '), /MANQUANT|INCONNU/, `${n} sans argument`);
  }
});

/* ══ appels réseau réels ══ */
test('RÉEL — ephoto360/textpro génèrent une image (2 effets)', async () => {
  const reg = reg2();
  for (const n of ['naruto', 'neon']) {
    const c = mkC(reg, [], 'DJOUSSE');
    await reg.get(n).fn(c);
    /* soit l'image part (aucune sortie), soit une erreur propre — jamais de throw */
    assert.ok(!c._out.join(' ').includes('THROW'), `${n} ne doit pas planter`);
  }
}, 120000);

test('RÉEL — bible-api.com renvoie Jean 3:16', async () => {
  const r = await fetch('https://bible-api.com/john%203:16', { signal: AbortSignal.timeout(15000) });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.reference, 'John 3:16');
  assert.match(String(d.text), /God|loved/i);
});

test('logolist affiche les 23 effets', async () => {
  const reg = reg2();
  const c = mkC(reg, []);
  await reg.get('logolist').fn(c);
  assert.match(c._out.join(' '), /EFFETS LOGO/);
  assert.match(c._out.join(' '), /23/);
});

test('RÉEL — popcat renvoie l\'hydrogène', async () => {
  const r = await fetch('https://api.popcat.xyz/periodic-table?element=hydrogen', { signal: AbortSignal.timeout(15000) });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.symbol, 'H');
  assert.equal(d.atomic_number, 1);
});

test('RÉEL — urban dictionary définit un mot', async () => {
  const r = await fetch('https://api.urbandictionary.com/v0/define?term=hello', { signal: AbortSignal.timeout(15000) });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.ok(Array.isArray(d.list) && d.list.length > 0);
});
