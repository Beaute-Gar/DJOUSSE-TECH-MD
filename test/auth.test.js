'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const auth = require('../lib/auth');
const config = require('../config');

const savedOwners = config.ownerNumber;
const savedSudo = process.env.SUDO_NUMBER;
let state;
let saves;

test.beforeEach(() => {
  config.ownerNumber = ['237690000001'];
  process.env.SUDO_NUMBER = '237690000002';
  state = { settings: { sudo: [], accepted: [] } };
  saves = 0;
  auth.bind(state, () => { saves++; });
});

test.after(() => {
  config.ownerNumber = savedOwners;
  if (savedSudo === undefined) delete process.env.SUDO_NUMBER;
  else process.env.SUDO_NUMBER = savedSudo;
  auth.bind(null, null);
});

test('normalizes WhatsApp JIDs and compares owner numbers exactly', () => {
  assert.equal(auth.normalize('+237 690 000 001:4@s.whatsapp.net'), '237690000001');
  assert.equal(auth.isOwner('237690000001@s.whatsapp.net'), true);
  assert.equal(auth.isOwner('1237690000001@s.whatsapp.net'), false);
});

test('recognizes sudo numbers from the environment and persisted state', () => {
  assert.equal(auth.isSudo('237690000002@s.whatsapp.net'), true);
  state.settings.sudo.push('237690000003');
  assert.equal(auth.isSudo('237690000003:2@s.whatsapp.net'), true);
});

test('accepts, expires and revokes access with persistence', () => {
  assert.equal(auth.canRun('237690000004@s.whatsapp.net'), false);
  assert.equal(auth.accept('237690000004', 60000).ok, true);
  assert.equal(auth.canRun('237690000004@s.whatsapp.net'), true);
  assert.equal(saves, 1);

  state.settings.accepted[0].until = Date.now() - 1;
  assert.equal(auth.isAccepted('237690000004'), false);
  assert.equal(saves, 2);

  assert.equal(auth.accept('237690000004').ok, true);
  assert.equal(auth.unaccept('237690000004').ok, true);
  assert.equal(auth.canRun('237690000004'), false);
});
