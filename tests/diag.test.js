'use strict';
/**
 * Option D — .diag : diagnostics Baileys lisibles depuis WhatsApp
 * (les stats sont produites par index.js via lib/waStats.js).
 */
const test = require('node:test');
const assert = require('node:assert');
const H = require('./helpers');
const { handler, mockSock, text, fresh, plain, OWNER, MEMBER } = H;
const waStats = require('../lib/waStats');

const G = '120363000000000301@g.us';
const run = (s, m) => handler.handleMessage(s, m);
const out = (s) => s.sent.map((m) => plain(m.text || m.caption || '')).join('\n');

test('.diag : cadre complet pour le owner', async () => {
  fresh(G);
  const s = mockSock();
  await run(s, text(G, OWNER, '.diag'));

  const t = out(s);
  assert.ok(t.includes('DIAGNOSTIC'), 'cadre affiché');
  assert.ok(t.includes('CONFLITS 440'), 'compteur de conflits exposé');
  assert.ok(t.includes('DERNIÈRE COUPURE'), 'dernière déconnexion exposée');
  assert.ok(t.includes('VERSION WA'), 'version négociée exposée');
  assert.ok(t.includes('SESSION'), 'état des credentials exposé');
  assert.ok(t.includes('MÉMOIRE'), 'empreinte mémoire exposée');
});

test('.diag : hors owner, refus', async () => {
  fresh(G);
  const s = mockSock();
  await run(s, text(G, MEMBER, '.diag'));
  assert.ok(!out(s).includes('DIAGNOSTIC'), 'aucun détail technique pour un non-owner');
});

test('.diag reflète les stats de connexion (lib/waStats)', async () => {
  fresh(G);
  const s = mockSock();
  waStats.conflicts = 3;
  waStats.waVersion = '2.3000.1043857760';
  waStats.waVersionSource = 'github WhiskeySockets';
  try {
    await run(s, text(G, OWNER, '.diag'));
    const t = out(s);
    assert.ok(t.includes('2.3000.1043857760'), 'version WA réelle affichée');
    assert.ok(t.includes('github WhiskeySockets'), 'source de la version affichée');
  } finally {
    waStats.conflicts = 0;
    waStats.waVersion = null;
    waStats.waVersionSource = '';
  }
});
