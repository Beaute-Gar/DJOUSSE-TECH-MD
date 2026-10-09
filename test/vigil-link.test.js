'use strict';

const assert = require('node:assert/strict');
const { afterEach, it } = require('node:test');
const config = require('../config');
const { createLink } = require('../lib/vigilLink');

const originalVigil = { ...config.guard.vigil };
const originalFetch = global.fetch;

afterEach(() => {
  config.guard.vigil = { ...originalVigil };
  global.fetch = originalFetch;
});

it('garde le nom et l’identifiant propres à chaque processus Vigil', async () => {
  config.guard.vigil = {
    ...config.guard.vigil,
    url: 'https://vigil.example',
    email: 'bot@example.com',
    password: 'test-password',
  };

  const syncs = [];
  const ids = {
    'compte-a': '11111111-1111-4111-8111-111111111111',
    'compte-b': '22222222-2222-4222-8222-222222222222',
  };
  global.fetch = async (url, options) => {
    if (String(url).endsWith('/api/auth/login')) {
      return new Response('{}', {
        status: 200,
        headers: { 'set-cookie': 'vigil_session=test; Path=/; HttpOnly' },
      });
    }

    const body = JSON.parse(options.body);
    syncs.push(body);
    return Response.json({
      ok: true,
      nodeId: ids[body.name],
      commands: [],
    });
  };

  const first = createLink({ nodeName: 'compte-a' });
  const second = createLink({ nodeName: 'compte-b' });
  await first.syncOnce();
  await second.syncOnce();
  await first.syncOnce();

  assert.equal(syncs[0].name, 'compte-a');
  assert.equal(syncs[0].nodeId, undefined);
  assert.equal(syncs[1].name, 'compte-b');
  assert.equal(syncs[1].nodeId, undefined);
  assert.equal(syncs[2].name, 'compte-a');
  assert.equal(syncs[2].nodeId, ids['compte-a']);
  assert.equal(first._state().nodeId, ids['compte-a']);
  assert.equal(second._state().nodeId, ids['compte-b']);
});
