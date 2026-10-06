'use strict';
/**
 * Option C — base locale séparée de session/
 *
 *   session/ = credentials WhatsApp (le seul dossier à effacer)
 *   data/    = state.json, history.json, guard.json, scheduler.json, store/
 *
 * Vérifie : la séparation est effective au chargement, la migration est
 * complète, idempotente, ne touche jamais aux credentials et ne perd
 * jamais une config plus récente.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const H = require('./helpers');
const { handler, mockSock, text, fresh, plain, OWNER } = H;
const { migrate } = require('../lib/dataDir');

const BOT_FILES = ['state.json', 'history.json', 'guard.json', 'scheduler.json'];
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'dj-data-'));

function seed(dir, name, content, mtime) {
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, name);
  fs.writeFileSync(p, content);
  if (mtime) fs.utimesSync(p, new Date(mtime), new Date(mtime));
  return p;
}

test('état du bot écrit dans data/bot.db (SQLite), plus dans session/', () => {
  const localDb = require('../lib/db');
  if (localDb.available()) {
    assert.ok(localDb.has('state'), 'état présent dans la table kv de data/bot.db');
    assert.ok(fs.existsSync(path.join(H.TMP, 'data', 'bot.db')), 'base SQLite créée dans data/');
  } else {
    assert.ok(fs.existsSync(path.join(H.TMP, 'data', 'state.json')),
      'repli JSON : state.json dans data/');
  }
  assert.ok(!fs.existsSync(path.join(H.TMP, 'state.json')),
    'aucun state.json résiduel dans le dossier de session');
});

test('migrate() déplace toute la config, laisse les credentials WhatsApp', () => {
  const src = tmp();
  const dst = tmp();
  for (const f of BOT_FILES) seed(src, f, `{"from":"${f}"}`);
  seed(src, 'creds.json', '{"registered":true}'); // ne doit PAS bouger
  seed(path.join(src, 'store'), 'm.json', '[]');

  const moved = migrate(dst, src).sort();
  assert.deepStrictEqual(moved, [...BOT_FILES, 'store'].sort());

  for (const f of BOT_FILES) {
    assert.ok(fs.existsSync(path.join(dst, f)), `${f} migré`);
    assert.ok(!fs.existsSync(path.join(src, f)), `${f} retiré de l'ancien dossier`);
  }
  assert.ok(fs.existsSync(path.join(dst, 'store', 'm.json')), 'store/ migré avec son contenu');
  assert.ok(fs.existsSync(path.join(src, 'creds.json')),
    'creds.json reste dans session/ (réappareillage possible)');
});

test('migrate() est idempotent : second appel sans effet', () => {
  const src = tmp();
  const dst = tmp();
  seed(src, 'state.json', '{"v":1}');

  assert.strictEqual(migrate(dst, src).length, 1, 'premier appel migre');
  assert.strictEqual(migrate(dst, src).length, 0, 'second appel ne bouge rien');
  assert.strictEqual(fs.readFileSync(path.join(dst, 'state.json'), 'utf8'), '{"v":1}',
    'contenu intact après le second passage');
});

test('conflit : le fichier le plus récent gagne (pas de perte silencieuse)', () => {
  // data/ plus récent → data/ conservé, session/ laissé tel quel
  let src = tmp();
  let dst = tmp();
  seed(src, 'state.json', '{"who":"session"}', Date.parse('2026-01-01T00:00:00Z'));
  seed(dst, 'state.json', '{"who":"data"}', Date.parse('2026-02-01T00:00:00Z'));
  migrate(dst, src);
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(dst, 'state.json'), 'utf8')).who, 'data',
    'la config data/ la plus fraîche n’est pas écrasée');

  // session/ plus récent → elle remplace data/
  src = tmp();
  dst = tmp();
  seed(src, 'state.json', '{"who":"session"}', Date.parse('2026-03-01T00:00:00Z'));
  seed(dst, 'state.json', '{"who":"data"}', Date.parse('2026-02-01T00:00:00Z'));
  migrate(dst, src);
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(dst, 'state.json'), 'utf8')).who, 'session',
    'une config session/ plus fraîche remplace la valeur obsolète');
  assert.ok(!fs.existsSync(path.join(src, 'state.json')), 'origine consommée');
});

test('.diag expose la base locale en plus de la session', async () => {
  const G = '120363000000000401@g.us';
  fresh(G);
  const s = mockSock();
  await handler.handleMessage(s, text(G, OWNER, '.diag'));
  const out = s.sent.map((m) => plain(m.text || m.caption || '')).join('\n');
  assert.ok(out.includes('BASE LOCALE'), 'base locale affichée');
  assert.ok(out.includes('SESSION DISQUE'), 'session WhatsApp affichée séparément');
});
