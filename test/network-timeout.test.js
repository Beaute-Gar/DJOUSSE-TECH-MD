'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { withNetworkTimeout } = require('../lib/network-timeout');

test('returns a completed network operation result', async () => {
  const result = await withNetworkTimeout(async (signal) => {
    assert.equal(signal.aborted, false);
    return 'ok';
  }, 100, 'test');
  assert.equal(result, 'ok');
});

test('aborts and rejects a stalled network operation with a useful message', async () => {
  await assert.rejects(
    withNetworkTimeout((signal) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }), 10, 'Test API'),
    /Test API : délai dépassé \(10 ms\)\./
  );
});

test('rejects invalid timeout configuration', async () => {
  await assert.rejects(withNetworkTimeout(async () => {}, 0), /timeoutMs doit être un nombre positif/);
});
