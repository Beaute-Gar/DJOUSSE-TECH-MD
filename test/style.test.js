'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const style = require('../src/config/style');

test('les réponses système encadrées utilisent le même alphabet pour leur contenu', () => {
  const sample = 'Status active 123';
  const expected = `│✦ ${style.toUnicode(sample)}`;
  const outputs = [
    style.renderInfo([sample]),
    style.renderSuccess([sample]),
    style.renderError([sample]),
    style.renderSaisie(sample),
  ];

  for (const output of outputs) {
    assert.ok(output.includes(expected), `contenu normalisé absent de : ${output}`);
    assert.ok(output.startsWith('╭┄┄『 '));
    assert.ok(output.endsWith('╰┄┄┄┄┄┄┄┄┄┄┄┄⪼'));
  }
});

test('les réponses système préservent les valeurs non ASCII et les symboles', () => {
  const label = 'État : actif ✅';
  const output = style.renderInfo([label, 'Numéro +237 600 000 000']);
  assert.ok(output.includes(style.toUnicode(label)));
  assert.ok(output.includes('✅'));
  assert.ok(output.includes('+𝟸𝟹𝟽 𝟼𝟶𝟶 𝟶𝟶𝟶 𝟶𝟶𝟶'));
});

test('tout texte sortant reçoit le cadre central, sans doubler un cadre existant', () => {
  const plain = style.renderOutgoingText('Une réponse');
  assert.equal(plain, style.buildFrame('INFO', ['│✦ Une réponse']));
  assert.equal(style.renderOutgoingText(plain), plain);
  assert.equal(
    style.renderOutgoingText('❌ Échec'),
    style.buildFrame('ERREUR', ['│✦ ❌ Échec']),
  );
  assert.equal(
    style.renderOutgoingText('✅ Terminé'),
    style.buildFrame('SUCCÈS', ['│✦ ✅ Terminé']),
  );
  assert.ok(style.renderOutgoingText('Lien https://example.com').includes('https://example.com'));
});

test('les longs messages gardent le cadre sans expansion excessive du texte', () => {
  const longText = 'a'.repeat(2100);
  const output = style.renderOutgoingText(longText);
  assert.ok(output.startsWith('╭┄┄『 '));
  assert.ok(output.includes(`│✦ ${longText}`));
  assert.ok(output.length < 2200);
});

test('le tableau de démarrage affiche les états réels dans un cadre de largeur fixe', () => {
  const output = style.renderStartupDashboard({
    process: 'ACTIF',
    version: '4.0.0',
    nodeVersion: 'v22.16.0',
    storage: 'OK (SQLite)',
    commands: 212,
    plugins: 1,
    protections: 'INITIALISEES',
    ai: 'SANS CLE',
    sessionId: 'djsession',
    connection: 'EN ATTENTE',
    activeSessions: 0,
    lastError: '',
  });

  assert.ok(output.includes('Des solutions fiables pour un avenir'));
  assert.ok(output.includes('Connexion : EN ATTENTE'));
  assert.ok(!output.includes('Connexion : CONNECTE'));
  assert.ok(output.includes('Sessions actives : 0'));
  assert.ok(output.includes('Services externes : NON TESTES'));
  for (const line of output.split('\n')) {
    assert.ok(line.length <= style.BOX_W + 2, `ligne trop large : ${line}`);
  }
});
