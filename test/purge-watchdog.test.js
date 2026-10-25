'use strict';
/**
 * MODULE 5 — watchdog 10 s + purge automatique des données > 30 jours :
 * preuves par test. La base est un dossier TEMPORAIRE — le data/ réel
 * du bot n'est jamais touché.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/* AVANT tout require : base isolée + fenêtre de rétention par défaut.
   dotenv ne remplace pas une variable déjà définie → 30 jours garanti. */
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'djousse-purge-test-'));
process.env.DATA_DIR = TMP;
process.env.DB_KEEP_DAYS = '';

const db = require('../src/lib/db');
const { MessageStore } = require('../src/lib/store');
const { WATCH_INTERVAL_MS } = require('../scripts/service.js');

const DAY = 86400000;

test('rétention par défaut : 30 jours (DB_KEEP_DAYS)', () => {
  assert.equal(db.KEEP_DAYS, 30);
});

test('purge automatique à l’ouverture : messages > 30 jours et événements > 60 jours supprimés', { skip: !db.available() && 'node:sqlite absent (Node < 22.5)' }, () => {
  const file = path.join(TMP, 'purge-test.db');
  const now = Date.now();

  let conn = db.conn(file);
  const insM = conn.prepare('INSERT INTO messages(ts, chat, sender, kind, cmd, len, text) VALUES(?, ?, ?, ?, ?, ?, ?)');
  insM.run(now - 40 * DAY, 'vieux@g.us', 'a', 'cmd', '.x', 1, 'trop vieux');
  insM.run(now - 1 * DAY, 'recent@g.us', 'b', 'cmd', '.y', 1, 'récent');
  const insE = conn.prepare('INSERT INTO events(ts, type, chat, actor, detail) VALUES(?, ?, ?, ?, ?)');
  insE.run(now - 70 * DAY, 'old', 'g@g.us', 'u', 'journal trop ancien');   // > 60 j → purge
  insE.run(now - 40 * DAY, 'kept', 'g@g.us', 'u', 'journal conservé');     // < 60 j → conservé
  db.close(file);

  /* Réouverture = exactement ce que fait le bot à chaque démarrage
     (conn() → prune()) : la purge est donc automatique. */
  conn = db.conn(file);
  const chats = conn.prepare('SELECT chat FROM messages').all().map((r) => r.chat);
  assert.deepEqual(chats, ['recent@g.us'], 'le message de 40 jours doit avoir disparu');
  const types = conn.prepare('SELECT type FROM events').all().map((r) => r.type);
  assert.deepEqual(types, ['kept'], 'l’événement de 70 jours doit avoir disparu');
  db.close(file);
});

test('store de messages : purge des entrées plus vieilles que 7 jours (défaut)', () => {
  const store = new MessageStore(path.join(TMP, 'store'));
  store.put('a@g.us', 'MSG_RECENT', { message: { conversation: 'neuf' } });
  store.put('a@g.us', 'MSG_VIEUX', { message: { conversation: 'vieux' } });

  /* On vieillit artificiellement MSG_VIEUX de 8 jours (la rétention
     du store est de 7 jours : voir lib/store.js purgeOlderThan). */
  store.mem.get('a@g.us|MSG_VIEUX').ts -= 8 * DAY;
  store.purgeOlderThan();

  assert.equal(store.get('a@g.us', 'MSG_VIEUX'), null, 'l’entrée de 8 jours doit être purgée');
  assert.ok(store.get('a@g.us', 'MSG_RECENT'), 'l’entrée récente doit rester');
});

test('watchdog : vérification de vie toutes les 10 secondes, câblée dans watchLoop', () => {
  assert.equal(WATCH_INTERVAL_MS, 10_000);
  const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'service.js'), 'utf8');
  assert.ok(/setInterval\(\(\) => \{/.test(src), 'boucle setInterval présente');
  assert.ok(/}, WATCH_INTERVAL_MS\);/.test(src), 'la boucle utilise bien la constante exportée');
  assert.ok(!/}, 10_000\);/.test(src), 'plus d’interval codé en dur');
});
