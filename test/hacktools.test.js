'use strict';
/* Vrais tests — lib/hacktools.js : menu protégé, hors menus, armes neutralisées. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

function boot(pwd) {
  const reg = new Map();
  const env = { ...process.env };
  if (pwd === null) delete process.env.HACKTOOLS_PASSWORD;
  else process.env.HACKTOOLS_PASSWORD = pwd;
  const { registerHackTools } = require('../src/lib/hacktools');
  registerHackTools((...a) => {
    const fn = a[a.length - 1];
    if (typeof fn === 'function') reg.set(a[0], { meta: a[1], fn });
  }, {
    config: { prefix: '.' },
    send: async () => {},
    buildFrame: (t, l) => [t, ...l].join('\n'),
    bullet: (k, v) => `${k}: ${v}`,
    note: (s) => s,
  });
  return { reg, restore: () => { process.env = env; } };
}

function mkC(args) {
  const out = [];
  const c = {
    args, q: args.join(' '), from: '1@g.us', sender: '111@s.whatsapp.net', sock: {}, msg: { key: {}, message: {} },
    reply: async (t) => out.push(String(t)),
    error: async (l) => out.push('ERR: ' + (Array.isArray(l) ? l.join(' ') : l)),
    success: async (l) => out.push('OK: ' + (Array.isArray(l) ? l.join(' ') : l)),
  };
  c._out = out;
  return c;
}

test('toutes les commandes hacktools sont en catégorie fantôme 99 (invisible des menus)', () => {
  const b = boot('test-pwd');
  const noms = ['hacktools', 'imdb', 'stickersearch', 'paste', 'technews', 'emomix', 'videodoc'];
  for (const n of noms) {
    assert.ok(b.reg.has(n), `${n} enregistrée`);
    const cat = b.reg.get(n).meta.cat;
    assert.equal(cat, 99, `${n} doit être en cat 99`);
    assert.ok(cat < 1 || cat > 11, `cat ${cat} absente de CATEGORIES(1..11) → invisible`);
  }
  b.restore();
});

test('sans mot de passe dans .env → section désactivée', async () => {
  const b = boot(null);
  const c = mkC(['nimporte']);
  await b.reg.get('hacktools').fn(c);
  assert.match(c._out.join(' '), /SECTION VERROUILLÉE/);
  b.restore();
});

test('mauvais mot de passe → accès refusé', async () => {
  const b = boot('bon-mot-de-passe');
  const c = mkC(['mauvais']);
  await b.reg.get('hacktools').fn(c);
  assert.match(c._out.join(' '), /MOT DE PASSE INCORRECT/);
  b.restore();
});

test('bon mot de passe → menu affiché par catégorie avec avertissements', async () => {
  const b = boot('bon-mot-de-passe');
  const c = mkC(['bon-mot-de-passe']);
  await b.reg.get('hacktools').fn(c);
  const t = c._out.join('\n');
  assert.match(t, /ARMES ANTI-COMPTE/);
  assert.match(t, /CONTENU SEXUEL/);
  assert.match(t, /SECRET EN DUR/);
  assert.match(t, /NEUTRALISÉE/);
  assert.match(t, /PORTÉE/);
  /* les 11 armes et les 9 contenus adultes sont bien listés */
  for (const n of ['loccrash', 'crashbug', 'amountbug', 'pmbug', 'delaybug', 'docubug', 'unlimitedbug', 'bombug', 'lagbug', 'trollybug', 'terminate']) {
    assert.ok(t.includes(n), `${n} listé`);
  }
  for (const n of ['nikal', 'hand', 'hentai', 'hwaifu', 'trap', 'hneko', 'hentaivid', 'blowjobs', 'waifues']) {
    assert.ok(t.includes(n), `${n} listé`);
  }
  b.restore();
});

test('sans argument → demande du mot de passe', async () => {
  const b = boot('x');
  const c = mkC([]);
  await b.reg.get('hacktools').fn(c);
  assert.match(c._out.join(' '), /MOT DE PASSE REQUIS/);
  b.restore();
});

test('imdb sans clé → message clair (pas de secret en dur)', async () => {
  const b = boot('x');
  delete process.env.OMDB_API_KEY;
  const c = mkC(['Dune']);
  await b.reg.get('imdb').fn(c);
  assert.match(c._out.join(' '), /CLÉ REQUISE/);
  assert.match(c._out.join(' '), /OMDB_API_KEY/);
  b.restore();
});

test('vérification : aucune clé API en dur dans le code source', () => {
  const fs = require('fs');
  const src = fs.readFileSync(require.resolve('../src/lib/hacktools'), 'utf8');
  /* pas de longue clé hexadécimale codée (style OMDB/Tenor/Telegraph) */
  const suspect = src.match(/['"`][a-f0-9]{24,}['"`]/g);
  assert.equal(suspect, null, `clé en dur trouvée : ${suspect}`);
  /* pas de jeton telegrapher codé */
  assert.ok(!/access_token=[a-f0-9]{20,}/.test(src), 'jeton en dur');
});
