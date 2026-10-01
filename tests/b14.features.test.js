'use strict';
/**
 * Lot B14 — appétences optionnelles :
 * .chrename / .chdesc / .chpic / .chdel / .chowner / .chdemote / .chfetch
 * (famille channels admin), .chinfo enrichi, .joinv4, .revokev4,
 * .orderinfo, .star / .unstar, .bots, .label list (cache), .mycatalog collections.
 * Limite du handler : 10 commandes / 10 s par expéditeur → on répartit
 * OWNER (9), MEMBER (3), admin (1) pour rester sous les seuils.
 */
const test = require('node:test');
const assert = require('node:assert');
const H = require('./helpers');
const { handler, mockSock, msg, text, fresh, plain, texts, jid } = H;

const run = (s, m) => handler.handleMessage(s, m);
const G = '120363000000000052@g.us';
const CH = '120363000000000099@newsletter';

test('.chdel : sans confirmation = refus, avec confirm = garde API (OWNER ×2)', async () => {
  fresh(G); const s = mockSock();
  await run(s, text(G, H.OWNER, `.chdel ${CH}`));
  assert.ok(texts(s).some((t) => plain(t).includes('CONFIRMATION REQUISE')));
  await run(s, text(G, H.OWNER, `.chdel ${CH} confirm`));
  assert.ok(texts(s).some((t) => plain(t).includes('NEWSLETTERDELETE')), 'garde API atteinte');
});

test('.chrename : usage sans nom puis renommage câblé (OWNER ×2)', async () => {
  fresh(G); const s = mockSock();
  await run(s, text(G, H.OWNER, `.chrename ${CH}`));
  assert.ok(texts(s).some((t) => plain(t).includes('USAGE')));
  await run(s, text(G, H.OWNER, `.chrename ${CH} Nouveau Nom`));
  assert.ok(s.settings.includes('chname=Nouveau Nom'), 'newsletterUpdateName appelé');
});

test('.chinfo enrichi : métadonnées + abonnés affichés (OWNER ×1)', async () => {
  fresh(G); const s = mockSock();
  await run(s, text(G, H.OWNER, `.chinfo ${CH}`));
  const out = texts(s).join('\n');
  assert.ok(plain(out).includes('CHANNEL'), 'cadre CHANNEL affiché');
  assert.ok(out.includes('ABONNÉS: 42'), 'subscribersCount de la métadonnée');
});

test('.chowner sans mention → usage (OWNER ×1)', async () => {
  fresh(G); const s = mockSock();
  await run(s, text(G, H.OWNER, `.chowner ${CH}`));
  assert.ok(texts(s).some((t) => plain(t).includes('USAGE')));
});

test('.orderinfo sans réponse à une carte → usage (OWNER ×1)', async () => {
  fresh(G); const s = mockSock();
  await run(s, text(G, H.OWNER, '.orderinfo'));
  assert.ok(texts(s).some((t) => plain(t).includes('ORDERINFO')));
});

test('.label list : cache des events (vide au démarrage) (OWNER ×1)', async () => {
  fresh(G); const s = mockSock();
  await run(s, text(G, H.OWNER, '.label list'));
  const out = texts(s).join('\n');
  assert.ok(out.includes('ÉTIQUETTES'), 'cadre affiché');
  assert.ok(out.includes('CACHE VIDE'), 'mention du cache événementiel');
});

test('.bots : getBotListV2 du faux socket (OWNER ×1)', async () => {
  fresh(G); const s = mockSock();
  await run(s, text(G, H.OWNER, '.bots'));
  const out = texts(s).join('\n');
  assert.ok(out.includes('LIÉS'), 'cadre BOTS LIÉS');
  assert.ok(out.includes('Bot Test'), 'entrée listée');
});

test('.joinv4 sans réponse à une carte → usage (MEMBER ×1)', async () => {
  fresh(G); const s = mockSock();
  await run(s, text(G, H.MEMBER, '.joinv4'));
  assert.ok(texts(s).some((t) => plain(t).includes('JOINV4')));
});

test('.star / .unstar : appel star() avec le bon état (MEMBER ×2)', async () => {
  fresh(G); const s = mockSock();
  const reply = (t, id) => msg(G, H.MEMBER, { extendedTextMessage: { text: t, contextInfo: { stanzaId: id } } });
  await run(s, reply('.star', 'MSTAR1'));
  assert.ok(s.settings.includes('star=true'), 'épinglage demandé');
  await run(s, reply('.unstar', 'MSTAR2'));
  assert.ok(s.settings.includes('star=false'), 'désépinglage demandé');
});

test('.revokev4 sans mention → usage (admin ×1)', async () => {
  fresh(G); const a = H.newAdmin(); const s = mockSock({ admins: [a] });
  await run(s, text(G, a, '.revokev4'));
  assert.ok(texts(s).some((t) => plain(t).includes('REVOKEV4')));
});
