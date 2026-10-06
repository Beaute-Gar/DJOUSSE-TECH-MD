'use strict';
/**
 * Option B — commutateur QR / Pairing dans .menu
 *
 * Vérifie que la bascule réécrit UNIQUEMENT CONNECT_METHOD et
 * PAIRING_PHONE, que les autres lignes du .env (secrets, URL avec &)
 * survivent octet à octet, et que le refus hors-owner ne touche rien.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const H = require('./helpers');
const { handler, mockSock, text, fresh, plain, OWNER, MEMBER } = H;

const G = '120363000000000201@g.us';
const ENV = process.env.ENV_FILE;
const run = (s, m) => handler.handleMessage(s, m);
const envRaw = () => fs.readFileSync(ENV, 'utf8');
/* .menu répond soit en texte, soit en image + légende */
const out = (s) => s.sent.map((m) => plain(m.text || m.caption || '')).join('\n');

test('.menu pairing : écrit la méthode et le numéro, secrets intacts', async () => {
  fresh(G);
  const s = mockSock();
  await run(s, text(G, OWNER, '.menu pairing 237690000000'));

  const raw = envRaw();
  assert.ok(/^CONNECT_METHOD=pairing$/m.test(raw), 'CONNECT_METHOD=pairing écrit');
  assert.ok(/^PAIRING_PHONE=237690000000$/m.test(raw), 'PAIRING_PHONE=237690000000 écrit');
  // le reste du fichier doit être recopié tel quel
  assert.ok(raw.includes('SUPER_SECRET'), 'secret conservé');
  assert.ok(raw.includes('sslmode=require&channel_binding=require'),
    'URL contenant & et = non altérée');
  assert.ok(raw.includes('BOT_NAME=DJOUSSE-TECH-MD'), 'autres clés conservées');
  assert.ok(!fs.existsSync(`${ENV}.tmp`), 'aucun .tmp résiduel (écriture atomique)');
  assert.ok(out(s).includes('MÉTHODE DE CONNEXION ENREGISTRÉE'), 'accusé de réception envoyé');
});

test('.menu qr : bascule en QR et vide le numéro de pairing', async () => {
  fresh(G);
  const s = mockSock();
  await run(s, text(G, OWNER, '.menu qr'));

  const raw = envRaw();
  assert.ok(/^CONNECT_METHOD=qr$/m.test(raw), 'CONNECT_METHOD=qr');
  assert.ok(/^PAIRING_PHONE=$/m.test(raw), 'PAIRING_PHONE vidé');
  assert.ok(raw.includes('SUPER_SECRET'), 'secret toujours présent');
  assert.ok(out(s).includes('QR'), 'le mode QR est annoncé');
});

test('hors owner : refus et .env inchangé', async () => {
  fresh(G);
  const before = envRaw();
  const s = mockSock();
  await run(s, text(G, MEMBER, '.menu pairing 237611111111'));

  assert.strictEqual(envRaw(), before, '.env non modifié par un non-owner');
  assert.ok(out(s).includes('RÉSERVÉE'), 'refus explicite');
});

test('numéro de pairing invalide : refus et .env inchangé', async () => {
  fresh(G);
  const before = envRaw();
  const s = mockSock();
  await run(s, text(G, OWNER, '.menu pairing abc'));

  assert.strictEqual(envRaw(), before, '.env non modifié sur numéro invalide');
  assert.ok(out(s).includes('INVALIDE'), 'erreur de saisie signalée');
});

test('.menu sans argument : affiche le cadre avec CONNEXION, .env intact', async () => {
  fresh(G);
  const before = envRaw();
  const s = mockSock();
  await run(s, text(G, OWNER, '.menu'));

  assert.strictEqual(envRaw(), before, '.env non modifié par un simple affichage');
  assert.ok(out(s).includes('CONNEXION'), 'la méthode de connexion est affichée');
  assert.ok(out(s).includes('CATEGORIES'), 'le menu habituel est bien rendu');
});
