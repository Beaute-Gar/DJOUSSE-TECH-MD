'use strict';
/* Vrai test — menu ARCHIVES (cat.12) : sous-menu 2A (non-owner) / 2B (owner),
   4 sections, neutralisation crash+NSFW (AFFICHAGE SEUL), API réparées (clés .env).
   SÉCURITÉ : les commandes « armes » et « adulte » ne sont JAMAIS exécutables. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
process.env.HACKTOOLS_PASSWORD = 'test-archives';
const h = require('../src/handlers/handler');
const { toUnicode } = require('../src/config/style');

const owner = { isOwner: true };
const user = { isOwner: false };

test('catégorie 12 ARCHIVES présente dans CATEGORIES', () => {
  const c = h.CATEGORIES.find((x) => x.n === 12);
  assert.ok(c, 'cat.12 existe');
  assert.equal(c.label, 'ARCHIVES');
  assert.equal(c.emoji, '🔐');
});

test('menu principal affiche la ligne 12 ARCHIVES', () => {
  const m = h.renderMainMenu(owner);
  assert.ok(m.includes(toUnicode('ARCHIVES')), 'ARCHIVES au menu principal');
  // même un non-owner voit la catégorie 12 (elle est toujours visible)
  assert.ok(h.renderMainMenu(user).includes(toUnicode('ARCHIVES')));
});

test('sous-menu 2B (owner) affiche les 4 sections', () => {
  const s = h.renderArchives(owner);
  assert.ok(s.includes('👑 PROPRIÉTAIRE'), 'accès owner');
  for (const lbl of ['ARMES ANTI-COMPTE', 'CONTENU ADULTE', 'API RÉPARÉES', 'HACKTOOLS']) {
    assert.ok(s.includes(toUnicode(lbl)), `${lbl} visible pour owner`);
  }
});

test('sous-menu 2A (non-owner) n’affiche QUE l’API', () => {
  const s = h.renderArchives(user);
  assert.ok(s.includes(toUnicode('API RÉPARÉES')), 'API visible');
  assert.ok(!s.includes(toUnicode('ARMES ANTI-COMPTE')), 'armes cachées');
  assert.ok(!s.includes(toUnicode('CONTENU ADULTE')), 'adulte caché');
  assert.ok(!s.includes(toUnicode('HACKTOOLS')), 'hacktools caché');
  assert.ok(s.includes('⚠️ CONTENU SENSIBLE'), 'mention contenu sensible');
});

test('section 01 armes : NEUTRALISÉE, barre de risque 8/10, liste ⛔', () => {
  const s = h.renderArchiveSection(owner, 'anti');
  assert.ok(s.includes('NEUTRALISÉE'), 'statut NEUTRALISÉE');
  assert.ok(s.includes('████████░░'), 'barre de risque 8/10');
  assert.ok(s.includes('⛔'), 'marqueur ⛔');
  assert.ok(s.includes(toUnicode('.LOCCRASH')), 'loccrash listée');
  assert.ok(s.includes(toUnicode('.TERMINATE')), 'terminate listée');
});

test('section 02 adulte : NEUTRALISÉE, 9 commandes, mention mineurs', () => {
  const s = h.renderArchiveSection(owner, 'nsfw');
  assert.ok(s.includes('NEUTRALISÉE'), 'statut NEUTRALISÉE');
  assert.ok(s.includes('MINEURS'), 'mention mineurs');
  assert.ok(s.includes('█████████░'), 'barre de risque 9/10');
  assert.ok(s.includes(toUnicode('.HENTAI')), 'hentai listée');
});

test('section 03 API : 6 commandes avec clé .env visible (public)', () => {
  const s = h.renderArchiveSection(user, 'api');
  assert.ok(s.includes('OMDB_API_KEY'), 'clé OMDB affichée');
  assert.ok(s.includes('TENOR_API_KEY'), 'clé Tenor affichée');
  assert.ok(s.includes('🔑'), 'indicateur 🔑');
  assert.ok(s.includes(toUnicode('.IMDB')), 'imdb listée');
  assert.ok(s.includes(toUnicode('.VIDEODOC')), 'videodoc listée');
});

test('section 04 HACKTOOLS : métadonnées d’accès, AUCUNE commande listée', () => {
  const s = h.renderArchiveSection(owner, 'hack');
  assert.ok(s.includes(toUnicode('HACKTOOLS')), 'titre');
  assert.ok(s.includes('mot de passe'), 'entrée .hacktools');
  assert.ok(s.includes('10 MINUTES'), 'session 10 min');
  assert.ok(!s.includes(toUnicode('.IMDB')), 'aucune commande listée');
});

test('.archives enregistrée (cat.12) — sections neutralisées NON exécutables', () => {
  const a = h.commands.get('archives');
  assert.ok(a, '.archives enregistrée');
  assert.equal(a.cat, 12);
  assert.equal(a.owner, false, '.archives consultable par tous');
  /* SÉCURITÉ : les commandes crash / NSFW ne sont PAS des commandes exécutables */
  for (const n of ['loccrash', 'crashbug', 'amountbug', 'terminate', 'hentai', 'hwaifu', 'blowjobs', 'nikal']) {
    assert.ok(!h.commands.get(n), `${n} ne doit PAS être exécutable`);
  }
});
