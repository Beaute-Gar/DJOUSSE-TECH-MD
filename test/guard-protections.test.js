'use strict';
/**
 * MODULE 3 — protections du guard (antilink · antivirtex · antifake/.allowcodes)
 * : preuves par test. La base est un dossier TEMPORAIRE — ces tests ne
 * touchent JAMAIS à data/ réel du bot.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/* Base isolée + délai humain coupé : le test reste rapide et non destructif. */
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'djousse-guard-test-'));
process.env.DATA_DIR = TMP;
process.env.HUMAN_DELAY = '0';

const antilink = require('../guard/src/protections/antilink');
const antivirtex = require('../guard/src/protections/antivirtex');
const guardDb = require('../guard/src/db');
const { enforceAntiFake } = require('../guard/src/events');
const { get: getCmd } = require('../guard/src/commands/registry');
require('../guard/src/commands/join.js'); // enregistre .antifake + .allowcodes

const g = (over = {}) => ({ ...guardDb.GROUP_DEFAULTS(), ...over });

/* ── antilink ─────────────────────────────────────────────────────── */

test('antilink détecte liens et domaines, ignore le texte normal', () => {
  assert.ok(antilink.detect({ text: 'viens voir https://chat.whatsapp.com/AbCdEf123' }, g()));
  assert.ok(antilink.detect({ text: 'vas sur example.com directement' }, g()));
  assert.equal(antilink.detect({ text: 'bonjour tout le monde' }, g()), null);
  assert.equal(antilink.detect({ text: '' }, g()), null);
});

test('antilink respecte la whitelist du groupe (.linkallow)', () => {
  const gg = g({ linkWhitelist: ['youtube.com'] });
  assert.equal(antilink.detect({ text: 'regarde https://youtube.com/watch?v=abc' }, gg), null);
  assert.ok(antilink.detect({ text: 'mais aussi https://evil.example.net/piège' }, gg));
});

/* ── antivirtex ───────────────────────────────────────────────────── */

test('antivirtex ignore un message normal', () => {
  assert.equal(antivirtex.detect({ text: 'salut les amis, tout va bien ?' }, g()), null);
});

test('antivirtex flag un texte géant (> maxText = 4000)', () => {
  const r = antivirtex.detect({ text: 'a'.repeat(4001) }, g());
  assert.ok(r, 'un texte de 4001 caractères doit être signalé');
  assert.match(r.reason, /lourd/i);
});

test('antivirtex flag un mur de 260 lignes', () => {
  const r = antivirtex.detect({ text: Array(260).fill('ligne').join('\n') }, g());
  assert.ok(r, '260 lignes doivent être signalées');
});

test('antivirtex flag 160 caractères invisibles (virtex classique)', () => {
  const r = antivirtex.detect({ text: 'ok\u200B'.concat('\u200B'.repeat(160)) }, g());
  assert.ok(r, '160+ caractères invisibles doivent être signalés');
});

/* ── antifake + .allowcodes (base réelle, chemin de production) ───── */

/** Socket de test : enregistre les expulsions, aucune vraie écriture WhatsApp. */
function fakeSock(botJid, meta) {
  const kicks = [];
  const sent = [];
  return {
    kicks,
    sent,
    sock: {
      user: { id: botJid },
      groupMetadata: async () => meta,
      groupParticipantsUpdate: async (gid, jids, action) => { kicks.push({ gid, jids, action }); return [{ status: '200' }]; },
      sendMessage: async (jid, content) => { sent.push({ jid, content }); return { key: { id: 'test' } }; },
      sendPresenceUpdate: async () => {},
    },
  };
}

test('antifake : indicatif interdit expulsé, indicatif autorisé conservé', async () => {
  guardDb.init(path.join(TMP, 'guard-on.db'));
  const gid = '120363099999999999@g.us';
  const botJid = '237690000001:42@s.whatsapp.net';
  const okJid = '237690000002@s.whatsapp.net';
  const koJid = '33612345678@s.whatsapp.net';

  const g0 = guardDb.db().getGroup(gid);
  g0.antifake = true;
  g0.allowedCodes = ['237'];
  guardDb.db().saveGroup(gid, g0);

  const meta = {
    id: gid,
    subject: 'Groupe test',
    participants: [
      { id: botJid, admin: 'superadmin' },  // le bot
      { id: okJid, admin: null },            // 237 ✓ autorisé
      { id: koJid, admin: null },            // 33  ✗ interdit
      { id: '999999999999@lid', admin: null }, // LID sans numéro : intouchable
    ],
  };
  const { sock, kicks } = fakeSock(botJid, meta);

  const removed = await enforceAntiFake(sock, { id: gid, participants: [okJid, koJid, '999999999999@lid'], action: 'add' });

  assert.deepEqual(removed, [koJid], 'seul l’indicatif 33 est expulsé');
  assert.equal(kicks.length, 1);
  assert.equal(kicks[0].action, 'remove');
  assert.deepEqual(kicks[0].jids, [koJid]);
  const gg = guardDb.db().getGroup(gid);
  assert.equal(gg.stats.antifake, 1);
  assert.equal(gg.stats.kicked, 1);
});

test('antifake désactivé → aucun expulsé même avec indicatif interdit', async () => {
  guardDb.init(path.join(TMP, 'guard-off.db'));
  const gid = '120363088888888888@g.us';
  const g1 = guardDb.db().getGroup(gid);
  assert.equal(g1.antifake, false); // défaut : protégé, rien n'est expulsé
  const removed = await enforceAntiFake({}, { id: gid, participants: ['33612345678@s.whatsapp.net'], action: 'add' });
  assert.deepEqual(removed, []);
});

test('antifake : un départ (action ≠ add) ne déclenche rien', async () => {
  guardDb.init(path.join(TMP, 'guard-part.db'));
  const removed = await enforceAntiFake({}, {
    id: '120363077777777777@g.us',
    participants: ['33612345678@s.whatsapp.net'],
    action: 'remove',
  });
  assert.deepEqual(removed, []);
});

/* ── commandes .allowcodes / .antifake ────────────────────────────── */

test('.allowcodes normalise les arguments en chiffres et les sauvegarde', async () => {
  guardDb.init(path.join(TMP, 'guard-cmd1.db'));
  const gid = '120363066666666666@g.us';
  const replies = [];
  const c = { from: gid, args: ['+237', '33', 'abc', '241'], prefix: '.', botAdmin: true, reply: (t) => replies.push(t) };
  await getCmd('allowcodes').run(c);
  assert.deepEqual(guardDb.db().getGroup(gid).allowedCodes, ['237', '33', '241']);
  assert.equal(replies.length, 1);
});

test('.allowcodes sans argument → message d’usage, rien n’est écrit', async () => {
  guardDb.init(path.join(TMP, 'guard-cmd2.db'));
  const gid = '120363055555555555@g.us';
  const replies = [];
  const c = { from: gid, args: [], prefix: '.', botAdmin: true, reply: (t) => replies.push(t) };
  await getCmd('allowcodes').run(c);
  /* ui.error() passe tout par le rendu stylisé de style.js : on compare
     avec le MÊME rendu — message d'usage exact, mot pour mot. */
  const ui = require('../guard/src/ui');
  assert.equal(replies[0], ui.error(['UTILISATION : .allowcodes 237 33 241']));
  assert.deepEqual(guardDb.db().getGroup(gid).allowedCodes, []);
});

test('.antifake on active la protection avec indicatif par défaut 237', async () => {
  guardDb.init(path.join(TMP, 'guard-cmd3.db'));
  const gid = '120363044444444444@g.us';
  const replies = [];
  const c = { from: gid, args: ['on'], prefix: '.', botAdmin: true, reply: (t) => replies.push(t) };
  await getCmd('antifake').run(c);
  const g2 = guardDb.db().getGroup(gid);
  assert.equal(g2.antifake, true);
  assert.deepEqual(g2.allowedCodes, ['237']);
  /* Le cadre stylise son titre en Unicode « math bold » : on asserte
     sur le texte brut de la réponse (état + invite .allowcodes). */
  assert.match(String(replies[0]), /ACTIVÉ/);
  assert.match(String(replies[0]), /\.allowcodes 237 33 241/);
});
