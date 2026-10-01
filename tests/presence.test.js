'use strict';
/**
 * Lot B13 — lib/presence.js : presence.subscribe → presence.update.
 * Fichier pur (aucun helpers) : ni socket, ni commandes chargées.
 */
const test = require('node:test');
const assert = require('node:assert');
const presence = require('../lib/presence');

test('presence : clé normalisée (server + suffixe appareil ignorés)', () => {
  assert.strictEqual(presence.norm('237699000000@s.whatsapp.net'), '237699000000');
  assert.strictEqual(presence.norm('237699000000:12@s.whatsapp.net'), '237699000000');
  assert.strictEqual(presence.norm('123456789@g.us'), '123456789');
  assert.strictEqual(presence.norm(''), '');
});

test('presence : handle résout la demande en attente (clé avec appareil)', async () => {
  const waiter = presence.track('237699000001@s.whatsapp.net', 1000);
  const matched = presence.handle({
    id: '120363@g.us',
    presences: { '237699000001:7@s.whatsapp.net': { lastKnownPresence: 'composing' } },
  });
  assert.strictEqual(matched, true);
  const state = await waiter;
  assert.strictEqual(state.lastKnownPresence, 'composing');
  assert.strictEqual(presence._pending.size, 0, 'demande purgée après résolution');
});

test('presence : timeout → null et demande purgée', async () => {
  const state = await presence.track('237699000002@s.whatsapp.net', 30);
  assert.strictEqual(state, null);
  assert.strictEqual(presence._pending.size, 0);
});

test('presence : handle sans demande correspondante → false', () => {
  assert.strictEqual(
    presence.handle({ presences: { '237699000003@s.whatsapp.net': { lastKnownPresence: 'available' } } }),
    false
  );
  assert.strictEqual(presence.handle({}), false);
  assert.strictEqual(presence.handle(null), false);
  assert.strictEqual(presence._pending.size, 0);
});

test('presence : drop annule proprement (→ null) et remplace la demande', async () => {
  const first = presence.track('237699000004@s.whatsapp.net', 500);
  presence.drop('237699000004@s.whatsapp.net');
  assert.strictEqual(presence._pending.size, 0);
  assert.strictEqual(await first, null, 'demande annulée → résolue null');
  // une arrivée tardive ne réveille personne
  assert.strictEqual(
    presence.handle({ presences: { '237699000004@s.whatsapp.net': { lastKnownPresence: 'available' } } }),
    false
  );
});

test('presence : label() traduit les états Baileys', () => {
  assert.strictEqual(presence.label({ lastKnownPresence: 'available' }), 'EN LIGNE');
  assert.strictEqual(presence.label({ lastKnownPresence: 'unavailable' }), 'HORS LIGNE');
  assert.strictEqual(presence.label({ lastKnownPresence: 'composing' }), 'ÉCRIT…');
  assert.strictEqual(presence.label('recording'), 'ENREGISTRE…');
  assert.strictEqual(presence.label({}), 'INCONNU');
});
