'use strict';
/**
 * test/build-info.test.js — la version affichée doit être vérifiable.
 * `.list` / `.menu` / `.info` montrent `4.0.0+<commit> · <date>` : on
 * s'assure que le libellé est toujours exploitable, même sans git.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const build = require('../src/lib/build-info');
const config = require('../src/config/config');

test('build : version sémantique et libellé compact', () => {
  assert.match(build.version, /^\d+\.\d+\.\d+/);
  assert.match(build.label, /^\d+\.\d+\.\d+(\+[0-9a-f]{7,40})?$/i);
  assert.ok(build.dateLabel.length > 0, 'date de build affichable');
  assert.ok(build.infoLine.includes(build.version));
});

test('config expose build (utilisé par .info / .list / .menu)', () => {
  assert.equal(config.build.label, build.label);
  assert.equal(config.version, build.version);
});
