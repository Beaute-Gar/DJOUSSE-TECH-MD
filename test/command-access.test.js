'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { commandAccess } = require('../lib/command-access');

const context = (overrides = {}) => ({
  isOwner: false,
  fromMe: false,
  isGroup: false,
  isAdmin: false,
  isBotAdmin: false,
  ...overrides,
});

test('allows public commands for an authorized user', () => {
  assert.deepEqual(
    commandAccess({}, context(), { canRun: true }),
    { allowed: true }
  );
});

test('blocks private commands for unauthorized users', () => {
  assert.deepEqual(
    commandAccess({}, context(), { canRun: false }),
    { allowed: false, reason: 'PRIVATE' }
  );
});

test('self mode is silent for non-owner messages but keeps owner and fromMe access', () => {
  let checkedAccess = false;
  assert.deepEqual(
    commandAccess({}, context(), {
      selfMode: true,
      canRun: () => { checkedAccess = true; return true; },
    }),
    { allowed: false, silent: true }
  );
  assert.equal(checkedAccess, false);
  assert.deepEqual(
    commandAccess({}, context({ isOwner: true }), { selfMode: true, canRun: true }),
    { allowed: true }
  );
  assert.deepEqual(
    commandAccess({}, context({ fromMe: true }), {
      selfMode: true,
      canRun: () => { checkedAccess = true; return false; },
    }),
    { allowed: true }
  );
  assert.equal(checkedAccess, false);
});

test('accepted users cannot run owner-only commands', () => {
  assert.deepEqual(
    commandAccess({ owner: true }, context(), { canRun: true }),
    { allowed: false, reason: 'OWNER' }
  );
  assert.deepEqual(
    commandAccess({ owner: true }, context({ isOwner: true }), { canRun: true }),
    { allowed: true }
  );
});

test('group, admin and bot-admin restrictions only apply in their intended context', () => {
  assert.deepEqual(
    commandAccess({ group: true }, context(), { canRun: true }),
    { allowed: false, reason: 'GROUP' }
  );
  assert.deepEqual(
    commandAccess({ admin: true }, context({ isGroup: true }), { canRun: true }),
    { allowed: false, reason: 'ADMIN' }
  );
  assert.deepEqual(
    commandAccess({ admin: true }, context({ isGroup: true, isAdmin: true }), { canRun: true }),
    { allowed: true }
  );
  assert.deepEqual(
    commandAccess({ botAdmin: true }, context({ isGroup: true }), { canRun: true }),
    { allowed: false, reason: 'BOT_ADMIN' }
  );
  assert.deepEqual(
    commandAccess({ botAdmin: true }, context({ isGroup: true, isBotAdmin: true }), { canRun: true }),
    { allowed: true }
  );
});
