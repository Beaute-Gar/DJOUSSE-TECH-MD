'use strict';
/**
 * Option E — base locale SQLite réelle (node:sqlite, zéro dépendance)
 *
 * Couvre : le moteur kv/journal/historique, le backend Guard en SQLite
 * (avec import de l'ancien guard.json), et les deux commandes de
 * requête .journal / .chatlog.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const H = require('./helpers');
const { handler, mockSock, text, fresh, plain, OWNER, MEMBER } = H;
const db = require('../lib/db');
const guardDb = require('../guard/src/db');

const G = '120363000000000501@g.us';
const run = (s, m) => handler.handleMessage(s, m);
const out = (s) => s.sent.map((m) => plain(m.text || m.caption || '')).join('\n');

test('moteur SQLite disponible : base data/bot.db, kv atomique', () => {
  assert.ok(db.available(), 'node:sqlite intégré à Node');
  assert.ok(fs.existsSync(path.join(H.TMP, 'data', 'bot.db')), 'base créée dans data/');

  db.setJSON('t:probe', { a: 1, b: ['x', 'y'] });
  assert.deepStrictEqual(db.getJSON('t:probe'), { a: 1, b: ['x', 'y'] });
  assert.ok(db.has('t:probe'));
  assert.ok(!db.has('t:jamais'), 'clé absente → false');

  // écrasement : une seule ligne, pas de doublon
  db.setJSON('t:probe', { a: 2 });
  assert.deepStrictEqual(db.getJSON('t:probe'), { a: 2 });
});

test('journal : écriture, requête filtrée, compteurs, purge', () => {
  db.logEvent({ type: 'cmd', chat: G, actor: OWNER, detail: 'ping' });
  db.logEvent({ type: 'protect', chat: G, actor: MEMBER, detail: 'antilink · EXPULSION' });

  const prot = db.recentEvents({ limit: 10, type: 'protect' });
  assert.strictEqual(prot.length, 1, 'filtre par type');
  assert.strictEqual(prot[0].detail, 'antilink · EXPULSION');
  assert.strictEqual(prot[0].chat, G);

  const all = db.recentEvents({ limit: 50 });
  assert.ok(all.length >= 2, 'le journal contient les événements');
  for (let i = 1; i < all.length; i++) {
    assert.ok(all[i].ts >= all[i - 1].ts, 'retour en ordre chronologique');
  }

  const counts = db.eventCounts();
  assert.ok(counts.find((c) => c.type === 'cmd').n >= 1, 'compteurs GROUP BY type');

  assert.strictEqual(db.purgeJournal(3650), 0, 'rien d’aussi ancien à purger');
});

test("historique : messages typés, filtres chat et expéditeur", () => {
  db.logMessage({ chat: G, sender: OWNER, kind: 'text', len: 5, text: 'salut' });
  db.logMessage({ chat: '237611111111@s.whatsapp.net', sender: MEMBER, kind: 'image', len: 0 });

  assert.strictEqual(db.recentMessages({ limit: 5, chat: G }).length, 1, 'filtre par chat');
  assert.strictEqual(db.recentMessages({ limit: 5, sender: MEMBER }).length, 1, 'filtre par expéditeur');
  assert.ok(db.recentMessages({ limit: 50 }).length >= 2, 'aucun filtre → tout');

  const row = db.recentMessages({ limit: 5, chat: G })[0];
  assert.strictEqual(row.text, 'salut');
  assert.strictEqual(row.kind, 'text');
});

test('Guard SQLite : mêmes API que JSON, persistance après réouverture', () => {
  const file = path.join(H.TMP, 'data', 'guard-sqlite.db');
  const s = guardDb.init(file);

  const g = s.getGroup(G);
  g.antilink = true;
  g.stats.antilink = 7;
  g.sanction = 'kick';
  s.saveGroup(G, g);
  s.setWarns(G, MEMBER, 2);
  s.setMute(G, MEMBER, 1234567890);
  s.flush();

  assert.ok(fs.existsSync(file), 'fichier .db créé');

  // Réouverture = nouveau Store sur le même fichier
  const s2 = guardDb.init(file);
  const g2 = s2.getGroup(G);
  assert.strictEqual(g2.antilink, true, 'réglage persisté');
  assert.strictEqual(g2.stats.antilink, 7, 'stats persistées');
  assert.strictEqual(g2.sanction, 'kick');
  assert.strictEqual(s2.getWarns(G, MEMBER), 2, 'warns persistés');
  assert.strictEqual(s2.getMuteUntil(G, MEMBER), 1234567890, 'mutes persistés');

  // Les défauts restent complétés comme en JSON
  assert.strictEqual(g2.warnLimit, 3, 'champ manquant complété par défaut');
  s2.flush();
});

test('Guard SQLite : import de l’ancien guard.json (rollback possible)', () => {
  const legacy = path.join(H.TMP, 'data', 'guard.json');
  fs.writeFileSync(legacy, JSON.stringify({
    groups: { '120363000000000999@g.us': { antilink: true, warnLimit: 5, stats: { antilink: 3 } } },
    warns: { '120363000000000999@g.us': { '237652746693': 4 } },
    mutes: {},
  }), 'utf8');

  const file = path.join(H.TMP, 'data', 'import-test.db');
  const s = guardDb.init(file);

  const g = s.getGroup('120363000000000999@g.us');
  assert.strictEqual(g.antilink, true, 'réglage importé');
  assert.strictEqual(g.warnLimit, 5, 'override importé');
  assert.strictEqual(g.stats.antilink, 3, 'stats importées');
  assert.strictEqual(s.getWarns('120363000000000999@g.us', '237652746693'), 4, 'warns importés');
  assert.ok(fs.existsSync(legacy), 'ancien JSON conservé → retour en arrière possible');
});

test('.journal : liste filtrable, réservé au owner', async () => {
  fresh(G);
  db.logEvent({ type: 'protect', chat: G, actor: MEMBER, detail: 'antibad · DELETE' });

  const s = mockSock();
  await run(s, text(G, MEMBER, '.journal'));
  assert.ok(!out(s).includes('JOURNAL'), 'hors owner → refus');

  const s2 = mockSock();
  await run(s2, text(G, OWNER, '.journal protect 5'));
  const t = out(s2);
  assert.ok(t.includes('JOURNAL'), 'cadre affiché');
  assert.ok(t.includes('PROTECT'), 'type en majuscules');
  assert.ok(t.includes('antibad · DELETE'), 'détail de l’événement');
});

test('.chatlog : historique requêtable (limité, ici)', async () => {
  fresh(G);
  const s = mockSock();
  await run(s, text(G, OWNER, '.chatlog 5 ici'));
  const t = out(s);
  assert.ok(t.includes('CHATLOG'), 'cadre affiché');
  // le filtre « ici » = ce groupe : les messages du test sont dans G
  assert.ok(t.includes('+'), 'expéditeur affiché');
});
