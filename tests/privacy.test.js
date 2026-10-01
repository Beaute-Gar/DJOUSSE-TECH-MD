'use strict';
/**
 * Lot B13 — table privacy (setters Baileys), durées éphémères partagées
 * et extraction de codes d'invitation. Fichiers purs (aucun helpers).
 */
const test = require('node:test');
const assert = require('node:assert');
const { SETTERS, parseSet } = require('../lib/privacy');
const { EPHEMERAL_SECONDS, parseEphemeral } = require('../lib/ephemeral');
const { extractInviteCode } = require('../lib/invite');

test('privacy : 9 setters, chacun pointe une méthode update* de Baileys', () => {
  assert.strictEqual(Object.keys(SETTERS).length, 9);
  for (const [key, entry] of Object.entries(SETTERS)) {
    assert.ok(entry.fn.startsWith('update'), `${key} → ${entry.fn}`);
    assert.ok(entry.values.length >= 2, `${key} : au moins 2 valeurs`);
  }
  // valeurs conformes aux types Chat.d.ts (voir lib/privacy.js)
  assert.deepStrictEqual(SETTERS.lastseen.values, ['all', 'contacts', 'contact_blacklist', 'none']);
  assert.deepStrictEqual(SETTERS.online.values, ['all', 'match_last_seen']);
  assert.deepStrictEqual(SETTERS.readreceipts.values, ['all', 'none']);
  assert.deepStrictEqual(SETTERS.calls.values, ['all', 'known']);
  assert.deepStrictEqual(SETTERS.groupadd.values, ['all', 'contacts', 'contact_blacklist']);
});

test('privacy : parseSet valide / manquante / clé inconnue / valeur refusée', () => {
  const ok = parseSet(['lastseen', 'ALL']);
  assert.strictEqual(ok.ok, true);
  assert.strictEqual(ok.arg, 'all');
  assert.strictEqual(ok.key, 'lastseen');

  assert.strictEqual(parseSet([]).error, 'MISSING');
  assert.strictEqual(parseSet(['lastseen']).error, 'MISSING');

  const badKey = parseSet(['toto', 'all']);
  assert.strictEqual(badKey.error, 'KEY');
  assert.ok(badKey.allowed.includes('lastseen'), 'liste des clés renvoyée');

  const badVal = parseSet(['lastseen', 'jamais']);
  assert.strictEqual(badVal.error, 'VALUE');
  assert.deepStrictEqual(badVal.allowed, SETTERS.lastseen.values);
});

test('privacy : linkpreviews on/off → booléen isPreviewsDisabled inversé', () => {
  assert.strictEqual(parseSet(['linkpreviews', 'off']).arg, true);
  assert.strictEqual(parseSet(['linkpreviews', 'on']).arg, false);
});

test('ephemeral : durées en secondes + alias + inconnu → null', () => {
  assert.strictEqual(Object.keys(EPHEMERAL_SECONDS).length, 11);
  assert.strictEqual(parseEphemeral('off'), 0);
  assert.strictEqual(parseEphemeral('0'), 0);
  assert.strictEqual(parseEphemeral('24H'), 86400);
  assert.strictEqual(parseEphemeral('1d'), 86400);
  assert.strictEqual(parseEphemeral('7j'), 604800);
  assert.strictEqual(parseEphemeral('semaine'), 604800);
  assert.strictEqual(parseEphemeral('90d'), 7776000);
  assert.strictEqual(parseEphemeral('13h'), null);
  assert.strictEqual(parseEphemeral(''), null);
});

test('invite : lien officiel, code brut, invalide → null', () => {
  assert.strictEqual(extractInviteCode('https://chat.whatsapp.com/AbCdEfGh123'), 'AbCdEfGh123');
  assert.strictEqual(extractInviteCode('chat.whatsapp.com/invite/ZzYyXxWw99'), 'ZzYyXxWw99');
  assert.strictEqual(extractInviteCode('  AbCdEfGh123  '), 'AbCdEfGh123');
  assert.strictEqual(extractInviteCode('court'), null, 'code trop court');
  assert.strictEqual(extractInviteCode('https://evil.com/x'), null);
  assert.strictEqual(extractInviteCode(''), null);
  assert.strictEqual(extractInviteCode(null), null);
});
