'use strict';
/* Vrai test : les commandes hacktools ne doivent apparaître dans AUCUN
   rendu de menu (principal, sous-menus, .list), seulement via .hacktools. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
process.env.HACKTOOLS_PASSWORD = 'test-menu';
const h = require('../src/handlers/handler');

const NOMS = ['hacktools', 'imdb', 'stickersearch', 'paste', 'technews', 'emomix', 'videodoc'];

test('catégorie 99 absente de CATEGORIES → invisible des menus', () => {
  const cats = h.CATEGORIES.map((c) => c.n);
  assert.ok(!cats.includes(99));
  for (const n of NOMS) {
    const entry = h.commands.get(n);
    assert.ok(entry, `${n} enregistrée`);
    assert.ok(!cats.includes(entry.cat), `${n} cat=${entry.cat} hors menus`);
  }
});

test('aucun rendu de menu ne contient ces noms', async () => {
  const base = { isOwner: true, isAdmin: true };
  const rendus = [];
  rendus.push(h.renderMainMenu(base));
  for (const c of h.CATEGORIES) rendus.push(h.renderCategory(c.n, base));
  const tout = rendus.join('\n');
  for (const n of NOMS) {
    assert.ok(!tout.includes(n), `${n} ne doit pas apparaître dans les menus`);
  }
});
