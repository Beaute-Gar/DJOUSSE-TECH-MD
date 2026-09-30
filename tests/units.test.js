'use strict';
const test = require('node:test');
const assert = require('node:assert');
require('./helpers');
const { findLinks } = require('../guard/src/utils/links');
const { parseDuration, formatDuration } = require('../guard/src/utils/time');
const { parse, unwrap } = require('../guard/src/utils/message');

test('liens : détecte tout, pas de faux positifs, whitelist', () => {
  for (const t of ['https://google.com', 'www.site.cm', 'chat.whatsapp.com/AbC', 'wa.me/237699999999', 't.me/canal', 'hxxps://evil[.]com/x', 'g\u200Boogle.com', 'boutique.shop/promo'])
    assert.ok(findLinks(t).length > 0, t);
  for (const t of ['salut', 'il est 10.30 ok', 'fichier index.js', "j'arrive, à toute", ''])
    assert.strictEqual(findLinks(t).length, 0, t);
  assert.strictEqual(findLinks('https://docs.monsite.cm/a', ['monsite.cm']).length, 0);
});

test('durées', () => {
  assert.strictEqual(parseDuration('30m'), 1800000);
  assert.strictEqual(parseDuration('2h'), 7200000);
  assert.strictEqual(parseDuration('x'), null);
  assert.strictEqual(formatDuration(3723000), '1h 2m 3s');
});

test('unwrap : simple (commandes) vs avec éditions (protections)', () => {
  const edit = { protocolMessage: { type: 14, editedMessage: { conversation: 'https://a.com' } } };
  assert.strictEqual(parse({ message: edit }).text, 'https://a.com');
  assert.strictEqual(parse({ message: edit }).isEdit, true);
  assert.ok(unwrap(edit).protocolMessage, 'unwrap simple ne suit pas les éditions');
});
