'use strict';
const test = require('node:test');
const assert = require('node:assert');
const H = require('./helpers');
const { handler, guardDb, mockSock, msg, text, fresh, newAdmin, plain, deleted, texts, jid } = H;

const G = '120363000000000001@g.us';
const G2 = '120363000000000002@g.us';
const run = (s, m) => handler.handleMessage(s, m);
const enable = (gid, cfg) => Object.assign(guardDb.db().getGroup(gid), cfg);

test('protections : stickers, vocaux et médias SANS texte sont contrôlés (avant : ignorés)', async () => {
  fresh(G); const s = mockSock();
  enable(G, { antisticker: true, antivoice: true, antimedia: true });
  await run(s, msg(G, H.MEMBER, { stickerMessage: {} }));
  await run(s, msg(G, H.MEMBER, { audioMessage: { ptt: true } }));
  await run(s, msg(G, H.MEMBER, { imageMessage: { mimetype: 'image/jpeg' } }));
  assert.strictEqual(deleted(s).length, 3);
});

test('anti-statut : mention du groupe en statut → supprimé + expulsé, message au style DJOUSSE', async () => {
  fresh(G); const s = mockSock({ admins: [newAdmin()] });
  enable(G, { antistatus: true });
  const m = { groupStatusMentionMessage: { message: { protocolMessage: { type: 25 } } } };
  await run(s, msg(G, H.MEMBER, m));
  assert.strictEqual(deleted(s).length, 1);
  assert.deepStrictEqual(s.removed, [jid(H.MEMBER)]);
  const t = s.sent.find((x) => x.text).text;
  assert.ok(t.includes('『') && t.includes('│✦') && plain(t).includes('ANTI-STATUS-MENTION'));
});

test('antilink : membre supprimé, admin épargné, groupes isolés', async () => {
  fresh([G, G2]); const a = newAdmin(); const s = mockSock({ admins: [a] });
  enable(G, { antilink: true });
  await run(s, text(G, H.MEMBER, 'go https://spam.com'));
  await run(s, text(G, a, 'https://ok-admin.com'));
  await run(s, text(G2, H.MEMBER, 'https://libre.com'));
  assert.strictEqual(deleted(s).length, 1);
});

test('un lien ne peut plus être « avalé » comme saisie en attente d\'une commande', async () => {
  fresh(G); const s = mockSock({ admins: [newAdmin()] });
  enable(G, { antilink: true });
  await run(s, text(G, H.MEMBER, '.play'));                    // ouvre une saisie en attente
  await run(s, text(G, H.MEMBER, 'https://evil.com/video'));   // doit être supprimé
  assert.strictEqual(deleted(s).length, 1);
});

test('mode self : les protections restent actives', async () => {
  fresh(G); const s = mockSock({ admins: [newAdmin()] });
  handler.state.settings.selfMode = true;
  enable(G, { antilink: true });
  await run(s, text(G, H.MEMBER, 'https://evil.com'));
  assert.strictEqual(deleted(s).length, 1);
});

test('interrupteurs : sans argument = bascule ; argument invalide = erreur ; on/off explicites', async () => {
  fresh(G); const a = newAdmin(); const s = mockSock({ admins: [a] });
  await run(s, text(G, a, '.antilink'));
  assert.strictEqual(guardDb.db().getGroup(G).antilink, true);
  await run(s, text(G, a, '.antilink'));
  assert.strictEqual(guardDb.db().getGroup(G).antilink, false);
  await run(s, text(G, a, '.antilink peut-etre'));
  assert.ok(texts(s).some((t) => t.includes('ERREUR')));
  await run(s, text(G, a, '.antidelete'));
  assert.strictEqual(handler.state.groups[G].antidelete, true);
  await run(s, text(G, a, '.welcome off'));
  assert.strictEqual(handler.state.groups[G].welcome, false);
  await run(s, text(G, a, '.antistatus on'));
  assert.strictEqual(guardDb.db().getGroup(G).antistatus, true);
});

test('réactions et révocations ne comptent PAS comme flood', async () => {
  fresh(G); const s = mockSock({ admins: [newAdmin()] });
  enable(G, { antiflood: true, floodMax: 3, floodWindowSec: 30 });
  for (let i = 0; i < 10; i++) await run(s, msg(G, H.MEMBER, { reactionMessage: { text: '👍', key: {} } }));
  assert.strictEqual(deleted(s).length, 0, 'réactions ignorées');
  for (let i = 0; i < 5; i++) await run(s, text(G, H.MEMBER, 'vrai message ' + i));
  assert.ok(deleted(s).length >= 1, 'vrai flood détecté');
});

test('éditer un message pour y ajouter un lien ne contourne plus l\'anti-lien', async () => {
  fresh(G); const s = mockSock({ admins: [newAdmin()] });
  enable(G, { antilink: true });
  await run(s, msg(G, H.MEMBER, { protocolMessage: { type: 14, key: {}, editedMessage: { conversation: 'regardez https://x.com' } } }));
  await run(s, msg(G, H.MEMBER, { editedMessage: { message: { protocolMessage: { type: 14, editedMessage: { conversation: 'wa.me/237600000001' } } } } }));
  assert.strictEqual(deleted(s).length, 2);
});

test('antidelete ne re-poste PAS les suppressions du bot (ni un lien interdit)', async () => {
  fresh(G); const s = mockSock({ admins: [newAdmin()] });
  enable(G, { antilink: true });
  handler.state.groups[G] = { antidelete: true };
  const link = text(G, H.MEMBER, 'gagnez https://scam.com');
  await run(s, link);                                   // supprimé par le guard
  assert.strictEqual(deleted(s).length, 1);
  const before = s.sent.length;
  // WhatsApp renvoie l'événement de révocation causé par notre propre suppression
  await run(s, msg(G, H.BOT, { protocolMessage: { type: 'REVOKE', key: { remoteJid: G, id: link.key.id, participant: jid(H.MEMBER) } } }, { fromMe: true }));
  assert.strictEqual(s.sent.length, before, 'aucun re-post');

  // antidelete reste fonctionnel pour un message propre supprimé par son auteur
  const clean = text(G, H.MEMBER, 'bonjour tout le monde');
  await run(s, clean);
  await run(s, msg(G, H.MEMBER, { protocolMessage: { type: 'REVOKE', key: { remoteJid: G, id: clean.key.id, participant: jid(H.MEMBER) } } }));
  assert.ok(texts(s).some((t) => t.includes('Message supprimé détecté')));
});

test('anti-fake : indicatif non autorisé expulsé, pas de bienvenue pour lui', async () => {
  fresh(G);
  const s = mockSock({ admins: [newAdmin()], extra: [{ id: jid('237644444444') }, { id: jid('2349011111111') }] });
  enable(G, { antifake: true, allowedCodes: ['237'] });
  handler.state.groups[G] = { welcome: true };
  await handler.handleGroupUpdate(s, { id: G, action: 'add', participants: [jid('237644444444'), jid('2349011111111')] });
  assert.deepStrictEqual(s.removed, [jid('2349011111111')]);
  const welcome = s.sent.filter((m) => m.image || (m.text && plain(m.text).includes('BIENVENUE')));
  assert.ok(welcome.length === 1 && JSON.stringify(welcome[0].mentions) === JSON.stringify([jid('237644444444')]));
});

test('propriétaire reconnu via son numéro réel quand l\'ID est un LID', async () => {
  fresh(G); const s = mockSock();
  await run(s, msg(G, '99999', { conversation: '.antilink on' }, { participant: '99999@lid', participantAlt: jid(H.OWNER) }));
  assert.strictEqual(guardDb.db().getGroup(G).antilink, true);
});

test('bot non admin : un seul avis (style DJOUSSE), aucune suppression, reprise auto après promotion', async () => {
  fresh(G);
  let s = mockSock({ botAdmin: false, admins: [newAdmin()] });
  enable(G, { antilink: true });
  await run(s, text(G, H.MEMBER, 'https://a.com'));
  await run(s, text(G, H.MEMBER, 'https://b.com'));
  assert.strictEqual(deleted(s).length, 0);
  assert.strictEqual(texts(s).filter((t) => t.includes('ANTI-LINK INACTIF')).length, 1);
  H.guardPerms.invalidate(G);
  s = mockSock({ botAdmin: true, admins: [newAdmin()] });
  await run(s, text(G, H.MEMBER, 'https://c.com'));
  assert.strictEqual(deleted(s).length, 1);
});

test('sanction warn → expulsion au 3e ; surcharge par protection ; pack security', async () => {
  fresh(G); const a = newAdmin(); const s = mockSock({ admins: [a] });
  await run(s, text(G, a, '.security on'));
  const g = guardDb.db().getGroup(G);
  assert.ok(g.antilink && g.antistatus && g.antivirtex && g.antispam && g.antiflood && g.antibad && g.antitag);
  await run(s, text(G, a, '.sanction warn'));
  for (let i = 0; i < 3; i++) await run(s, text(G, H.MEMBER, 'https://x' + i + '.com'));
  assert.deepStrictEqual(s.removed, [jid(H.MEMBER)]);
  await run(s, text(G, a, '.sanction antistatus delete'));
  assert.strictEqual(g.sanctions.antistatus, 'delete');
  await run(s, text(G, a, '.settings'));
  assert.ok(texts(s).some((t) => t.includes('GROUP SETTINGS')));
});

test('virtex, forward, contact, sondage, mots bannis', async () => {
  fresh(G); const s = mockSock({ admins: [newAdmin()] });
  enable(G, { antivirtex: true, antiforward: true, anticontact: true, antipoll: true, antibad: true, badWords: ['idiot'] });
  await run(s, text(G, H.MEMBER, 'A'.repeat(5000)));
  await run(s, msg(G, H.MEMBER, { extendedTextMessage: { text: 'x', contextInfo: { isForwarded: true } } }));
  await run(s, msg(G, H.MEMBER, { contactMessage: {} }));
  await run(s, msg(G, H.MEMBER, { pollCreationMessageV3: { name: 'q' } }));
  await run(s, text(G, H.MEMBER, "espèce d'1d10t"));
  await run(s, text(G, H.MEMBER, 'message normal'));
  assert.strictEqual(deleted(s).length, 5);
});

test('blacklist owner : suppression muette', async () => {
  fresh(G); const s = mockSock({ admins: [newAdmin()] });
  handler.state.blacklist = [H.MEMBER];
  await run(s, text(G, H.MEMBER, 'salut'));
  assert.strictEqual(deleted(s).length, 1);
});

test('mode nuit : fenêtre à cheval sur minuit, fermeture/réouverture, bot non admin = réessai', async () => {
  fresh(G);
  const night = require('../guard/src/nightmode');
  assert.ok(night.inWindow(23 * 60, 22 * 60, 6 * 60) && night.inWindow(3 * 60, 22 * 60, 6 * 60) && !night.inWindow(12 * 60, 22 * 60, 6 * 60));
  enable(G, { nightMode: true, nightStart: '22:00', nightEnd: '06:00' });
  let s = mockSock({ botAdmin: false, admins: [newAdmin()] });
  await night.tick(s, new Date('2026-09-28T21:30:00Z')); // 22:30 à Douala
  assert.deepStrictEqual(s.settings, [], 'pas admin : rien');
  H.guardPerms.invalidate(G);
  s = mockSock({ admins: [newAdmin()] });
  await night.tick(s, new Date('2026-09-28T21:30:00Z'));
  assert.deepStrictEqual(s.settings, ['announcement']);
  await night.tick(s, new Date('2026-09-28T21:45:00Z'));
  assert.strictEqual(s.settings.length, 1, 'idempotent');
  await night.tick(s, new Date('2026-09-29T06:00:00Z')); // 07:00 à Douala
  assert.deepStrictEqual(s.settings, ['announcement', 'not_announcement']);
});

test('statuts : le moteur STATUTS du handler est atteint (index.js ne les filtre plus)', async () => {
  fresh(); const s = mockSock();
  const skip = (jid2) => handler.isSystemJid(jid2) && jid2 !== 'status@broadcast';
  assert.strictEqual(skip('status@broadcast'), false);
  assert.strictEqual(skip('123@newsletter'), true);
  assert.strictEqual(skip('123@broadcast'), true);
  await run(s, { key: { remoteJid: 'status@broadcast', participant: jid(H.MEMBER), id: 'ST1' }, message: { conversation: 'hello' } });
});
