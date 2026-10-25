'use strict';
/**
 * AUTO-STATUTS — preuves par test réel (socket moqué, appels vérifiés) :
 *   1. défauts du cahier : vue ON · réaction ON · réponse OFF (procès-verbal
 *      lancé avec un .env vide — indépendant du .env local) ;
 *   2. la VUE passe par sendReceipt('status@broadcast', auteur, [id], 'read') ;
 *   3. la RÉACTION emporte TOUJOURS { statusJidList } composé de JID
 *      téléphone (@s.whatsapp.net), JAMAIS de @lid — sinon WhatsApp
 *      l'avale silencieusement (piège constaté en production sur les bots
 *      de référence : c'est exactement pourquoi ça ne marchait pas) ;
 *   4. la RÉPONSE DM cible le numéro réel de l'auteur et cite le statut ;
 *   5. fromMe ignoré · overrides runtime prioritaires sur la config ;
 *   6. INTÉGRATION : handleMessage() d'un statut → les appels sortants
 *      réels partent bien (chaîne complète config → handler → module → socket).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/* Pas de délai humain dans les tests (lu à chaque envoi par wa-send). */
process.env.HUMAN_DELAY = '0';

/* ═══ 1. DÉFAUTS DU CAHIER DES CHARGES (procès-verbal 100 % frais) ═══ */

test('défauts : AUTO_STATUS_SEEN=true · AUTO_STATUS_REACT=true · AUTO_STATUS_REPLY=false', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'djousse-status-env-'));
  const emptyEnv = path.join(dir, 'empty.env');
  fs.writeFileSync(emptyEnv, '');
  /* Enfant sans AUCUNE clé AUTO_STATUS_* et .env vide → défauts purs. */
  const env = { ...process.env };
  for (const k of ['AUTO_STATUS_SEEN', 'AUTO_STATUS_REACT', 'AUTO_STATUS_REPLY', 'AUTO_REPLY_STATUS']) delete env[k];
  env.ENV_FILE = emptyEnv;
  const script = `const c=require(${JSON.stringify(path.join(__dirname, '..', 'src', 'config', 'config.js'))});` +
    'console.log([c.autoStatusSeen,c.autoStatusReact,c.autoStatusReply].join(","));';
  const r = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8', env, cwd: path.join(__dirname, '..') });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), 'true,true,false', 'défauts conformes à la spec (vue ON, réaction ON, réponse OFF)');
});

/* ═══ FIXTURES ═══ */

const { handleStatus, effective, phoneJidOf, botPhoneJid } = require('../src/lib/auto-status');
const config = require('../src/config/config');

const PHONE = '23765550001@s.whatsapp.net';
const LID = '123456789012345@lid';
const BOT_ID = '237699988877:12@s.whatsapp.net';

function mockSock() {
  const calls = { receipt: [], msgs: [], presence: [] };
  return {
    user: { id: BOT_ID },
    calls,
    sendReceipt: async (...a) => { calls.receipt.push(a); },
    sendMessage: async (jid, content, opts) => { calls.msgs.push({ jid, content, opts }); return { key: { id: 'ok' } }; },
    sendPresenceUpdate: async (...a) => { calls.presence.push(a); },
  };
}

const statusMsg = (over = {}) => ({
  key: { remoteJid: 'status@broadcast', fromMe: false, id: 'ST-1', participant: PHONE, ...over },
  message: { conversation: 'mon statut du jour' },
});

/* ═══ 2. VUE ═══ */

test('vue : sendReceipt(status@broadcast, auteur, [id], "read")', async () => {
  const sock = mockSock();
  const done = await handleStatus(sock, statusMsg(), { seen: true, react: false, reply: false });
  assert.equal(done.seen, true);
  assert.deepEqual(sock.calls.receipt, [['status@broadcast', PHONE, ['ST-1'], 'read']]);
  assert.equal(sock.calls.msgs.length, 0, 'aucun envoi autre que le receipt');
});

test('vue : readMessages en repli si sendReceipt absent', async () => {
  const sock = mockSock();
  delete sock.sendReceipt;
  let read = null;
  sock.readMessages = async (keys) => { read = keys; };
  const msg = statusMsg();
  const done = await handleStatus(sock, msg, { seen: true, react: false, reply: false });
  assert.equal(done.seen, true);
  assert.deepEqual(read, [msg.key]);
});

test('vue : envoi qui échoue n’écrase pas le reste (résolution douce)', async () => {
  const sock = mockSock();
  sock.sendReceipt = async () => { throw new Error('boom réseau'); };
  const done = await handleStatus(sock, statusMsg(), { seen: true, react: true, reply: false });
  assert.equal(done.seen, false, 'vue signalée comme non acquittée');
  assert.equal(done.react, true, 'la réaction part malgré l’échec de la vue');
});

/* ═══ 3. RÉACTION — LE PIÈGE statusJidList ═══ */

test('réaction : statusJidList présent, JID téléphone uniquement, emoji de la liste', async () => {
  const sock = mockSock();
  const done = await handleStatus(sock, statusMsg(), { seen: false, react: true, reply: false });
  assert.equal(done.react, true);
  assert.equal(sock.calls.msgs.length, 1);
  const { jid, content, opts } = sock.calls.msgs[0];
  assert.equal(jid, 'status@broadcast');
  /* Piège n°1 : SANS statusJidList, WhatsApp avale la réaction. */
  assert.ok(opts && Array.isArray(opts.statusJidList), 'options.statusJidList obligatoire');
  /* Piège n°2 : un @lid dans la liste → rejet silencieux côté serveur. */
  assert.ok(opts.statusJidList.every((j) => j.includes('@s.whatsapp.net')), `JID non-téléphone dedans : ${opts.statusJidList}`);
  assert.ok(opts.statusJidList.includes(PHONE), 'auteur en JID téléphone');
  assert.ok(opts.statusJidList.includes('237699988877@s.whatsapp.net'), 'bot sans suffixe appareil');
  /* Emoji issu de CUSTOM_REACT_EMOJIS (plus l’emoji corrompu du .env). */
  const emojis = String(process.env.CUSTOM_REACT_EMOJIS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (emojis.length) assert.ok(emojis.includes(content.react.text), `emoji « ${content.react.text} » hors liste`);
  assert.ok(content.react.key && content.react.key.id === 'ST-1', 'la réaction est portée par la clé du statut');
  assert.equal(sock.calls.presence.length, 0, 'pas de « écrit… » sur une réaction (envoi immédiat)');
});

test('réaction : auteur en @lid → participantPn résolu dans statusJidList, receipt en @lid d’origine', async () => {
  const sock = mockSock();
  const msg = statusMsg({ participant: LID, participantPn: PHONE });
  await handleStatus(sock, msg, { seen: true, react: true, reply: false });
  const [, receiptParticipant] = sock.calls.receipt[0];
  assert.equal(receiptParticipant, LID, 'le receipt retourne le participant tel que reçu');
  const { opts } = sock.calls.msgs[0];
  assert.ok(opts.statusJidList.includes(PHONE), 'la réaction porte le numéro réel (participantPn)');
  assert.ok(!opts.statusJidList.some((j) => j.includes('@lid')), 'aucun @lid dans statusJidList');
});

/* ═══ 4. RÉPONSE DM ═══ */

test('réponse : DM au numéro réel citant le statut', async () => {
  const sock = mockSock();
  const done = await handleStatus(sock, statusMsg({ participant: LID, participantPn: PHONE }), { seen: false, react: false, reply: true });
  assert.equal(done.reply, true);
  assert.equal(sock.calls.msgs.length, 1);
  const { jid, content } = sock.calls.msgs[0];
  assert.equal(jid, PHONE, 'réponse au numéro réel, pas au @lid');
  assert.equal(content.text, config.autoStatusMsg, 'texte = AUTO_STATUS_MSG');
  assert.ok(config.autoStatusMsg, 'AUTO_STATUS_MSG non vide');
  assert.equal(content.contextInfo.stanzaId, 'ST-1', 'citation du statut');
  assert.deepEqual(content.contextInfo.quotedMessage, { conversation: 'mon statut du jour' });
});

test('réponse : sans AUTO_STATUS_MSG (vide) → aucun envoi', async () => {
  const sock = mockSock();
  const saved = config.autoStatusMsg;
  config.autoStatusMsg = '';
  try {
    const done = await handleStatus(sock, statusMsg(), { seen: false, react: false, reply: true });
    assert.equal(done.reply, false);
    assert.equal(sock.calls.msgs.length, 0);
  } finally {
    config.autoStatusMsg = saved;
  }
});

/* ═══ 5. FILTRES ET OVERRIDES ═══ */

test('fromMe : statut du bot lui-même → rien de partout', async () => {
  const sock = mockSock();
  const done = await handleStatus(sock, statusMsg({ fromMe: true }), { seen: true, react: true, reply: true });
  assert.deepEqual(done, { seen: false, react: false, reply: false });
  assert.equal(sock.calls.receipt.length, 0);
  assert.equal(sock.calls.msgs.length, 0);
});

test('sans participant (écho) : rien de partout', async () => {
  const sock = mockSock();
  const done = await handleStatus(sock, statusMsg({ participant: undefined }), { seen: true, react: true, reply: true });
  assert.deepEqual(done, { seen: false, react: false, reply: false });
  assert.equal(sock.calls.msgs.length, 0);
});

test('overrides runtime prioritaires sur la config (qui dit true)', async () => {
  assert.equal(config.autoStatusSeen, true, 'config locale : vue ON');
  const sock = mockSock();
  const done = await handleStatus(sock, statusMsg(), { seen: false, react: false, reply: false });
  assert.deepEqual(done, { seen: false, react: false, reply: false });
  assert.equal(sock.calls.receipt.length, 0, '.autoview off coupe la vue malgré le .env');
  assert.equal(sock.calls.msgs.length, 0);
});

test('effective() : override présent → override ; absent → config', () => {
  assert.deepEqual(effective({}), { seen: true, react: true, reply: false });
  assert.equal(effective({ seen: false }).seen, false, 'false explicite respecté (pas de ??)');
  assert.equal(effective({ react: false }).react, false);
  assert.equal(effective({ reply: true }).reply, true);
});

test('phoneJidOf : participantPn d’abord, @lid ignoré, null sans numéro', () => {
  assert.equal(phoneJidOf({ participant: LID, participantPn: PHONE }), PHONE);
  assert.equal(phoneJidOf({ participant: PHONE }), PHONE, 'participant déjà en téléphone');
  assert.equal(phoneJidOf({ participant: LID }), null, 'lid seul → null (réaction impossible)');
  assert.equal(phoneJidOf({}), null);
});

test('botPhoneJid : suffixe appareil retiré', () => {
  assert.equal(botPhoneJid({ user: { id: BOT_ID } }), '237699988877@s.whatsapp.net');
  assert.equal(botPhoneJid({ user: { id: '237699988877@s.whatsapp.net' } }), '237699988877@s.whatsapp.net');
  assert.equal(botPhoneJid({}), '');
});

test('pickEmoji : toujours un emoji de CUSTOM_REACT_EMOJIS', () => {
  const { pickEmoji } = require('../src/lib/auto-status');
  const list = String(process.env.CUSTOM_REACT_EMOJIS || '').split(',').map((s) => s.trim()).filter(Boolean);
  assert.ok(list.length >= 1, 'liste d’emojis configurée');
  for (let i = 0; i < 20; i += 1) assert.ok(list.includes(pickEmoji()));
});

/* ═══ 6. INTÉGRATION — chaîne complète config → handler → module → socket ═══ */

test('intégration : handleMessage() traite status@broadcast et émet les vrais appels', async () => {
  const handler = require('../src/handlers/handler');
  const sock = mockSock();
  const msg = statusMsg();
  await handler.handleMessage(sock, msg);
  /* vue : receipt réel */
  assert.deepEqual(sock.calls.receipt, [['status@broadcast', PHONE, ['ST-1'], 'read']]);
  /* réaction : statusJidList conforme */
  assert.equal(sock.calls.msgs.length, 1, 'une seule réaction (réponse OFF par défaut)');
  const { jid, content, opts } = sock.calls.msgs[0];
  assert.equal(jid, 'status@broadcast');
  assert.ok(opts.statusJidList.every((j) => j.includes('@s.whatsapp.net')));
  assert.ok(content.react.key.id === 'ST-1');
});
