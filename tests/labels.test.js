'use strict';
/**
 * Lot B14 — lib/labels.js : cache des étiquettes Business.
 * Fichier pur (aucun helpers) : events labels.edit / labels.association
 * consommés par `.label list` (lib/missing.js).
 */
const test = require('node:test');
const assert = require('node:assert');
const labels = require('../lib/labels');

test('labels : définitions via labels.edit (création, renommage, suppression)', () => {
  labels._defs.clear(); labels._chats.clear();
  assert.strictEqual(labels.onEdit({ id: '42', name: 'Client VIP', color: 5 }), true);
  assert.strictEqual(labels._defs.get('42').name, 'Client VIP');
  labels.onEdit({ id: '42', name: 'VIP Or', color: 6 });
  assert.strictEqual(labels._defs.get('42').name, 'VIP Or', 'renommage pris en compte');
  // suppression : la définition tombe et chaque chat la perd
  labels.onAssociation({ association: { type: 'label_jid', chatId: 'a@s.whatsapp.net', labelId: '42' }, type: 'add' });
  labels.onEdit({ id: '42', deleted: true });
  assert.strictEqual(labels._defs.has('42'), false, 'définition purgée');
  assert.deepStrictEqual(labels.listFor('a@s.whatsapp.net'), [], 'association purgée avec la définition');
  assert.strictEqual(labels.onEdit({}), false, 'entrée sans id ignorée');
  assert.strictEqual(labels.onEdit(null), false, 'entrée nulle ignorée');
});

test('labels : associations chat add / remove (label_jid uniquement)', () => {
  labels._defs.clear(); labels._chats.clear();
  labels.onEdit({ id: '7', name: 'Urgent', color: 1 });
  assert.strictEqual(
    labels.onAssociation({ association: { type: 'label_jid', chatId: 'b@s.whatsapp.net', labelId: '7' }, type: 'add' }),
    true
  );
  assert.deepStrictEqual(labels.listFor('b@s.whatsapp.net'), [{ id: '7', name: 'Urgent' }]);
  // re-add idempotent
  labels.onAssociation({ association: { type: 'label_jid', chatId: 'b@s.whatsapp.net', labelId: '7' }, type: 'add' });
  assert.strictEqual(labels._chats.get('b@s.whatsapp.net').size, 1, 'pas de doublon');
  labels.onAssociation({ association: { type: 'label_jid', chatId: 'b@s.whatsapp.net', labelId: '7' }, type: 'remove' });
  assert.deepStrictEqual(labels.listFor('b@s.whatsapp.net'), [], 'retirée du chat');
  // associations MESSAGE : hors cache (la commande lit les étiquettes de chat)
  assert.strictEqual(
    labels.onAssociation({ association: { type: 'label_message', chatId: 'b@s.whatsapp.net', messageId: 'M1', labelId: '7' }, type: 'add' }),
    false, 'label_message ignoré'
  );
  assert.strictEqual(labels.onAssociation({}), false, 'payload vide ignoré');
});

test('labels : listFor — chat inconnu → [], définition inconnue → #id', () => {
  labels._defs.clear(); labels._chats.clear();
  assert.deepStrictEqual(labels.listFor('inconnu@s.whatsapp.net'), []);
  assert.deepStrictEqual(labels.listFor(''), []);
  labels.onAssociation({ association: { type: 'label_jid', chatId: 'c@s.whatsapp.net', labelId: '99' }, type: 'add' });
  assert.deepStrictEqual(labels.listFor('c@s.whatsapp.net'), [{ id: '99', name: '#99' }], 'fallback #id sans labels.edit');
});
