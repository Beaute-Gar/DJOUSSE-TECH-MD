'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { MessageStore } = require('../lib/store');
const { createMessageCache } = require('../lib/message-cache');

function createTempStore(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'djou-anti-delete-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('cache récupère un message persistant après redémarrage et le remet en RAM', (t) => {
  const dir = createTempStore(t);
  const jid = '12345-67890@g.us';
  const id = 'message-1';
  const original = {
    key: {
      remoteJid: jid,
      id,
      fromMe: false,
      participant: '237600000000@s.whatsapp.net',
    },
    message: { conversation: 'message à restaurer' },
    messageTimestamp: 1_791_526_800,
  };

  const firstStore = new MessageStore(dir);
  firstStore.put(jid, id, original);
  firstStore.flushJson();

  const restartedStore = new MessageStore(dir);
  const cache = createMessageCache({
    getStore: () => restartedStore,
    getMaxSize: () => 800,
  });

  const recovered = cache.get(jid, id);
  assert.deepEqual(recovered.msg, original);
  assert.equal(cache.get(jid, id), recovered, 'le résultat est mis en cache en RAM');
});

test('cache RAM prioritaire et fallback persistant retourne null si absent', (t) => {
  const jid = '12345-67890@g.us';
  const id = 'message-2';
  const persistentMessage = {
    key: { remoteJid: jid, id, fromMe: false },
    message: { conversation: 'persistant' },
  };
  const store = {
    get: (requestedJid, requestedId) =>
      requestedJid === jid && requestedId === id
        ? {
          key: persistentMessage.key,
          message: persistentMessage.message,
          ts: 1,
        }
        : null,
    put() {},
  };
  const cache = createMessageCache({
    getStore: () => store,
    getMaxSize: () => 800,
  });
  const newerMessage = {
    ...persistentMessage,
    message: { conversation: 'RAM' },
  };

  cache.put(jid, id, newerMessage);
  assert.equal(cache.get(jid, id).msg.message.conversation, 'RAM');
  assert.equal(cache.get(jid, 'missing'), null);
  assert.equal(cache.get('', id), null);
});
