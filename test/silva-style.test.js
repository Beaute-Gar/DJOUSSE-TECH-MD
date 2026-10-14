'use strict';
/* Test réel : le proxy d'envoi normalise le style des plugins silva. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normaliserStyle, wrapSock } = require('../lib/silva-loader');

const style = {
  renderError: (lignes) => `[CADRE-ERREUR] ${lignes.join(' | ')}`,
  renderSuccess: (lignes) => `[CADRE-SUCCES] ${lignes.join(' | ')}`,
};

test('erreur anglaise d\'un plugin silva → cadre DJOUSE', () => {
  const out = normaliserStyle('❌ *Error!* Movie not found', style);
  assert.match(out, /^\[CADRE-ERREUR\]/);
  assert.match(out, /Movie not found/);
  assert.ok(!out.includes('*Error!*'), 'markdown du plugin nettoyé');
});

test('usage demandé → cadre DJOUSE', () => {
  const out = normaliserStyle('Please provide a search term', style);
  assert.match(out, /^\[CADRE-ERREUR\]/);
});

test('succès d\'un plugin silva → cadre DJOUSE', () => {
  const out = normaliserStyle('✅ Done! Your note was saved', style);
  assert.match(out, /^\[CADRE-SUCCES\]/);
  assert.match(out, /note was saved/);
});

test('réponse utile (quiz, liste) → conservée, markdown nettoyé', () => {
  const out = normaliserStyle('🎬 *Guess the Movie*\n\n🦁👑\n\nReply with .emojianswer', style);
  assert.match(out, /Guess the Movie/);
  assert.ok(!out.includes('*'), 'astérisques nettoyés');
  assert.ok(!/CADRE-(ERREUR|SUCCES)/.test(out), 'pas encadré comme erreur/succès');
});

test('proxy sendMessage : contenu texte normalisé ET envoyé via wa-send', async () => {
  const envoyes = [];
  const sockBrut = {
    sendMessage: async (jid, c) => { envoyes.push(['BRUT', jid, c.text]); },
  };
  const sendWa = async (sock, jid, c) => { envoyes.push(['WA-SEND', jid, c.text]); };
  const sock = wrapSock(sockBrut, sendWa, style);
  await sock.sendMessage('g@g.us', { text: '❌ *Error!* something failed' });
  assert.equal(envoyes.length, 1, 'un seul envoi');
  assert.equal(envoyes[0][0], 'WA-SEND', 'passe par wa-send (centralisé)');
  assert.match(envoyes[0][2], /^\[CADRE-ERREUR\]/, 'style DJOUSE appliqué');
});

test('proxy : les NON-messages (médias) ne sont pas dénaturés', async () => {
  const envoyes = [];
  const sockBrut = { sendMessage: async (jid, c) => { envoyes.push(['BRUT', jid, c]); } };
  const sendWa = async (sock, jid, c) => { envoyes.push(['WA', jid, c]); };
  const sock = wrapSock(sockBrut, sendWa, style);
  await sock.sendMessage('g@g.us', { image: { url: 'https://x/y.jpg' }, caption: 'ok' });
  assert.deepEqual(Object.keys(envoyes[0][2]), ['image', 'caption']);
});

test('proxy : si wa-send échoue, repli sur le sock brut', async () => {
  const envoyes = [];
  const sockBrut = { sendMessage: async (jid, c) => { envoyes.push(['BRUT', jid, c.text]); } };
  const sendWa = async () => { throw new Error('wa-send ne sait pas envoyer'); };
  const sock = wrapSock(sockBrut, sendWa, style);
  await sock.sendMessage('g@g.us', { text: 'texte simple' });
  assert.equal(envoyes[0][0], 'BRUT', 'repli brut utilisé');
});
