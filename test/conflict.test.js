'use strict';

/**
 * test/conflict.test.js — MODULE 2 : détection de conflits bot↔bot
 * Style : node:test (aligné sur test/auth.test.js de la session d'intégration).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const conflict = require('../lib/conflict');
const style = require('../style');

test.beforeEach(() => conflict.reset());

test('signature de cadre RÉELLE (renderError du bot) met le chat en pause', () => {
  const hit = conflict.observe({
    chat: 'g1@g.us',
    fromMe: false,
    owner: false,
    text: style.renderError(['CONFLIT TEST']), // vraie sortie d'un DJOUSE
  });
  assert.equal(hit.conflict, true);
  assert.equal(hit.first, true);
  assert.equal(hit.reason, 'signature-cadre');
  assert.equal(conflict.isPaused('g1@g.us'), true);

  /* détection suivante : déjà en pause → first=false */
  const again = conflict.observe({ chat: 'g1@g.us', fromMe: false, owner: false, text: 'suite' });
  assert.equal(again.conflict, true);
  assert.equal(again.first, false);

  const list = conflict.status();
  assert.equal(list.length, 1);
  assert.equal(list[0].chat, 'g1@g.us');
});

test('message ordinaire (aucune marque de cadre) : pas de pause', () => {
  const hit = conflict.observe({ chat: 'g7@g.us', fromMe: false, owner: false, text: 'bonjour tout le monde' });
  assert.equal(hit.conflict, false);
  assert.equal(conflict.isPaused('g7@g.us'), false);
});

test('ping-pong rapide (boucle bot↔bot) déclenche la pause au 6ᵉ message', () => {
  let firstAt = -1;
  for (let i = 0; i < 8; i += 1) {
    const r = conflict.observe({
      chat: 'g2@g.us',
      fromMe: i % 2 === 1,
      owner: false,
      text: `msg ${i}`,
    });
    if (r.first && firstAt < 0) firstAt = i;
  }
  assert.ok(firstAt >= 5, `pause attendue au 6ᵉ message, obtenue à l'index ${firstAt}`);
  assert.equal(conflict.isPaused('g2@g.us'), true);
  assert.equal(conflict.reasonOf('g2@g.us'), 'ping-pong');
});

test('échanges owner↔bot rapides sont exemptés (tests de commandes)', () => {
  for (let i = 0; i < 12; i += 1) {
    conflict.observe({
      chat: 'g3@g.us',
      fromMe: i % 2 === 1,
      owner: i % 2 === 0,
      text: `cmd ${i}`,
    });
  }
  assert.equal(conflict.isPaused('g3@g.us'), false);
});

test('rafale de médias (sans texte) : aucun faux positif', () => {
  for (let i = 0; i < 10; i += 1) {
    conflict.observe({ chat: 'g4@g.us', fromMe: i % 2 === 1, owner: false, text: '' });
  }
  assert.equal(conflict.isPaused('g4@g.us'), false);
});

test('participant isBot du serveur : hors nous uniquement', () => {
  assert.equal(
    conflict.hasBotParticipant({ participants: [{ id: '2371112233@s.whatsapp.net', isBot: true }] }, '237999000'),
    true,
  );
  /* c'est NOUS (suffixe d'appareil :12 normalisé) → false */
  assert.equal(
    conflict.hasBotParticipant({ participants: [{ id: '237999000:12@s.whatsapp.net', isBot: true }] }, '237999000'),
    false,
  );
  assert.equal(
    conflict.hasBotParticipant({ participants: [{ id: '2371112233@s.whatsapp.net' }] }, '237999000'),
    false,
  );
  assert.equal(conflict.hasBotParticipant(null, '237999000'), false);
});

test('levée de pause : resume idempotent + status cohérent', () => {
  conflict.markPaused('g5@g.us', 'test');
  assert.equal(conflict.resume('g5@g.us'), true);
  assert.equal(conflict.isPaused('g5@g.us'), false);
  assert.equal(conflict.resume('g5@g.us'), false);
  assert.equal(conflict.status().length, 0);
});

test('chat en pause : observe ne fait pas croître la fenêtre', () => {
  conflict.markPaused('g6@g.us', 'test');
  conflict.observe({ chat: 'g6@g.us', fromMe: false, owner: false, text: 'x' });
  conflict.observe({ chat: 'g6@g.us', fromMe: true, owner: true, text: 'y' });
  const again = conflict.observe({ chat: 'g6@g.us', fromMe: false, owner: false, text: 'z' });
  assert.equal(again.first, false);
  assert.equal(conflict.status().length, 1);
});
