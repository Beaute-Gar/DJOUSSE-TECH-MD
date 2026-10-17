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
require('../guard/src/commands/protection.js'); // enregistre .security + .settings + .antilink…
const { runProtections, PROTECTIONS } = require('../guard/src/engine');

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

/* ── Preuve DE BOUT EN BOUT : l'action (suppression) a réellement lieu ──
   Le moteur doit supprimer le lien d'un simple membre, mais EXEMPTER un
   admin/owner (voulu : sinon le bot supprimerait son propre admin). */

test('antilink SUPPRIME réellement le lien d’un membre non-admin', async () => {
  guardDb.init(path.join(TMP, 'guard-e2e-link.db'));
  const gid = '120363055555555555@g.us';
  const botJid = '237690000001:42@s.whatsapp.net';
  const memberJid = '237690000099@s.whatsapp.net';

  const g0 = guardDb.db().getGroup(gid);
  g0.antilink = true;                      // protection activée
  guardDb.db().saveGroup(gid, g0);

  const meta = {
    id: gid, subject: 'Groupe test',
    participants: [
      { id: botJid, admin: 'superadmin' }, // le bot PEUT supprimer
      { id: memberJid, admin: null },      // simple membre → cible
    ],
  };
  const { sock, sent } = fakeSock(botJid, meta);

  const msg = { key: { id: 'MSG-LINK-1', remoteJid: gid, participant: memberJid } };
  const r = await runProtections({
    sock, msg, from: gid, sender: memberJid, senderNum: '237690000099',
    type: 'extendedTextMessage', text: 'regarde https://youtu.be/sdJIvgKTEG0',
    meta, isBotSelf: false, isOwner: false,
  });

  assert.equal(r.handled, true, 'le lien d’un membre doit être pris en charge');
  assert.equal(r.protection, 'antilink');
  assert.ok(sent.some((s) => s.content && s.content.delete), 'un { delete } doit être émis');
  const gg = guardDb.db().getGroup(gid);
  assert.equal(gg.stats.antilink, 1, 'le compteur antilink doit augmenter');
});

test('antilink EXEMpte un admin : aucun lien supprimé pour un admin', async () => {
  guardDb.init(path.join(TMP, 'guard-e2e-admin.db'));
  const gid = '120363044444444444@g.us';
  const botJid = '237690000001:42@s.whatsapp.net';
  const adminJid = '237690000077@s.whatsapp.net';

  const g0 = guardDb.db().getGroup(gid);
  g0.antilink = true;
  guardDb.db().saveGroup(gid, g0);

  const meta = {
    id: gid, subject: 'Groupe test',
    participants: [
      { id: botJid, admin: 'superadmin' },
      { id: adminJid, admin: 'admin' },   // admin du groupe
    ],
  };
  const { sock, sent } = fakeSock(botJid, meta);

  const msg = { key: { id: 'MSG-LINK-2', remoteJid: gid, participant: adminJid } };
  const r = await runProtections({
    sock, msg, from: gid, sender: adminJid, senderNum: '237690000077',
    type: 'extendedTextMessage', text: 'https://youtu.be/sdJIvgKTEG0',
    meta, isBotSelf: false, isOwner: false,
  });

  assert.equal(r.handled, false, 'un admin est exempté');
  assert.equal(r.reason, 'exempt');
  assert.ok(!sent.some((s) => s.content && s.content.delete), 'aucune suppression pour un admin');
});

test('.security on active les 14 protections (13 moteur + antifake)', async () => {
  guardDb.init(path.join(TMP, 'guard-e2e-security.db'));
  const gid = '120363033333333333@g.us';
  const mk = (args) => ({ from: gid, args, prefix: '.', reply: async (t) => t });
  const sec = getCmd('security');
  assert.ok(sec, 'la commande .security doit exister');
  assert.equal(PROTECTIONS.length + 1, 14, '13 protections + antifake = 14');

  await sec.run(mk(['on']));
  let g = guardDb.db().getGroup(gid);
  for (const p of PROTECTIONS) assert.equal(g[p.key], true, `${p.key} doit être ACTIVÉ`);
  assert.equal(g.antifake, true, 'antifake doit être ACTIVÉ');
  assert.deepEqual(g.allowedCodes, ['237'], 'antifake prend le défaut 237 (comme .antifake on)');

  await getCmd('security').run(mk(['off']));
  g = guardDb.db().getGroup(gid);
  for (const p of PROTECTIONS) assert.equal(g[p.key], false, `${p.key} doit être DÉSACTIVÉ`);
  assert.equal(g.antifake, false, 'antifake doit être DÉSACTIVÉ');
});

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
