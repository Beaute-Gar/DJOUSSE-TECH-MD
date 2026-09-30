'use strict';
/**
 * LUDO : pont réel handler.js → plugins/ludo.js → ludo/
 * Vérifie ce que l'auteur du module n'a PAS pu tester : l'inscription des
 * commandes dans CE registre, le passage du contexte (from/sender/args/sock)
 * et l'envoi réel des images du plateau et du dé.
 *
 *  node --test tests/ludo.integration.test.js
 */
const test = require('node:test');
const assert = require('node:assert');
const H = require('./helpers');
const { handler, mockSock, msg, text, fresh, texts } = H;

const G = '120363000000000099@g.us';
const GS = '120363000000000098@g.us';
const P1 = '2376555000001'; // hôte (identifiants dédiés : 10 commandes / 10 s / expéditeur)
const P2 = '2376555000002';
const P3 = '2376555000003'; // mode solo (limite de débit propre à cet expéditeur)

const run = (s, m) => handler.handleMessage(s, m);
const images = (s) => s.sent.filter((m) => m.image);
const isPng = (b) => Buffer.isBuffer(b) && b.slice(1, 4).toString() === 'PNG';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('registre : .ludo / .dé / .pion sont chargés (nom, alias, catégorie FUN)', () => {
  for (const [key, name] of [['ludo', 'ludo'], ['ludogame', 'ludo'], ['de', 'de'], ['dé', 'de'], ['pion', 'pion']]) {
    const entry = handler.commands.get(key);
    assert.ok(entry, `commande absente du registre : ${key}`);
    assert.strictEqual(entry.name, name);
    assert.strictEqual(entry.cat, 7);
  }
});

test('salon → start → image du plateau → .dé avec image du dé', async () => {
  fresh(G);
  const s = mockSock();

  await run(s, text(G, P1, '.ludo creer'));
  assert.ok(texts(s).some((t) => /salon/i.test(t)), 'ouverture du salon attendue');

  await run(s, text(G, P2, '.ludo rejoindre'));
  await run(s, text(G, P1, '.ludo start'));

  const board = images(s).at(-1);
  assert.ok(board, 'le départ doit envoyer le plateau en image');
  assert.ok(isPng(board.image), 'le plateau doit être un PNG');
  assert.ok(board.image.length > 5000, 'image anormalement vide');

  await run(s, text(G, P1, '.dé'));
  const roll = images(s).at(-1);
  assert.ok(roll, '.dé doit envoyer une image');
  assert.ok(isPng(roll.image), 'l\'image du dé doit être un PNG');
  assert.ok(/a lanc[ée] un \*?[1-6]/i.test(roll.caption || ''), 'légende de lancer attendue : ' + (roll.caption || '').slice(0, 120));
  assert.ok(Array.isArray(roll.mentions) && roll.mentions.includes(H.jid(P1)), 'le joueur doit être mentionné');

  await run(s, text(G, P1, '.pion 1'));
  assert.ok(s.sent.length > 4, '.pion doit produire une réponse');

  await run(s, text(G, P1, '.ludo pos'));
  const pos = images(s).at(-1);
  assert.ok(pos && isPng(pos.image), '.ludo pos doit renvoyer le plateau');

  await run(s, text(G, P1, '.ludo stop'));
  assert.ok(texts(s).some((t) => /annul|stop|partie/i.test(t)), 'fin de partie attendue');
});

test('commande inconnue du module : message d\'aide, jamais une exception', async () => {
  fresh(G + 'x');
  const s = mockSock();
  await run(s, text(G + 'x', P2, '.ludo nimportequoi'));
  assert.ok(texts(s).length >= 1, 'une réponse est attendue même pour une sous-commande inconnue');
});

test('mode solo : la partie démarre sans salon et le robot joue tout seul', async () => {
  fresh(GS);
  const s = mockSock();

  await run(s, text(GS, P3, '.ludo solo'));
  assert.ok(texts(s).some((t) => /MODE SOLO/.test(t)), 'annonce du mode solo attendue');
  const board = images(s).at(-1);
  assert.ok(board && isPng(board.image), 'le plateau doit partir immédiatement, sans salon d\'attente');

  /* On pousse l'humain jusqu'à ce que le robot prenne son tour, puis on ne
     touche plus à rien : c'est lui qui joue (dé + déplacement automatiques). */
  const robotActed = () => s.sent.some((m) => {
    const b = m.caption || m.text || '';
    return b.includes('@robot') && /a lanc|avance|sort le pion/.test(b);
  });
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline && !robotActed()) {
    const last = [...s.sent].reverse().find((m) => m.caption || m.text);
    const body = last ? (last.caption || last.text) : '';
    const mv = body.match(/\.pion (\d)/);       // le dernier plateau liste les coups jouables
    await run(s, text(GS, P3, mv ? `.pion ${mv[1]}` : '.dé'));
    await sleep(1300);
  }
  assert.ok(robotActed(), 'le robot doit jouer son tour sans intervention');

  const roll = s.sent.find((m) => m.image && /@robot/.test(m.caption || '') && /a lanc/.test(m.caption || ''));
  assert.ok(roll, 'image du lancer du robot attendue');
  assert.ok(Array.isArray(roll.mentions) && !roll.mentions.some((j) => !/^\d+@/.test(j)),
    'aucun JID virtuel (robot) dans les mentions');

  await run(s, text(GS, P3, '.ludo stop'));
});
