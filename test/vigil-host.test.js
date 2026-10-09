'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { childSystemEnv } = require('../scripts/vigil-host');

test('le processus enfant ne reçoit que les variables système nécessaires', () => {
  const previousPath = process.env.PATH;
  const previousHostSecret = process.env.VIGIL_HOST_SECRET;
  const previousApiKey = process.env.OPENAI_API_KEY;
  process.env.PATH = 'C:\\Windows\\System32';
  process.env.VIGIL_HOST_SECRET = 'host-secret-must-not-leak';
  process.env.OPENAI_API_KEY = 'api-key-must-not-leak';

  try {
    const env = childSystemEnv();
    assert.equal(env.PATH, 'C:\\Windows\\System32');
    assert.equal(env.VIGIL_HOST_SECRET, undefined);
    assert.equal(env.OPENAI_API_KEY, undefined);
  } finally {
    if (previousPath === undefined) delete process.env.PATH;
    else process.env.PATH = previousPath;
    if (previousHostSecret === undefined) delete process.env.VIGIL_HOST_SECRET;
    else process.env.VIGIL_HOST_SECRET = previousHostSecret;
    if (previousApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousApiKey;
  }
});
