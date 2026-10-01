'use strict';
/**
 * Lot B13 — câblage des commandes Baileys manquantes :
 * .logout / .blocklist / .mygroups / .inviteinfo / .privacy set /
 * .seen / .mycatalog / .label / .community / .setpp delete / .disappear.
 * Limite du handler : 10 commandes / 10 s par expéditeur → on répartit
 * OWNER (8), MEMBER (3), admins (3) pour rester sous les seuils.
 */
const test = require('node:test');
const assert = require('node:assert');
const H = require('./helpers');
const presence = require('../lib/presence');
const { handler, mockSock, msg, text, fresh, plain, texts, jid } = H;

const run = (s, m) => handler.handleMessage(s, m);
const G = '120363000000000051@g.us';

test('.logout : sans confirmation = refus, avec confirm = coupure', async () => {
  fresh(G); const s = mockSock();
  await run(s, text(G, H.OWNER, '.logout'));
  assert.ok(texts(s).some((t) => plain(t).includes('CONFIRMATION REQUISE')));
  await run(s, text(G, H.OWNER, '.logout confirm'));
  assert.ok(s.settings.includes('logout'), 'sock.logout() appelé');
  assert.ok(texts(s).some((t) => plain(t).includes('SESSION TERMIN')), 'bilan affiché');
});

test('.blocklist et .mycatalog : listes via Baileys (garde API absente)', async () => {
  fresh(G); const s = mockSock();
  await run(s, text(G, H.OWNER, '.blocklist'));
  assert.ok(texts(s).some((t) => plain(t).includes('BLOCKLIST')));
  await run(s, text(G, H.OWNER, '.mycatalog'));
  assert.ok(texts(s).some((t) => plain(t).includes('API ABSENTE')), 'getCatalog absent du faux socket');
});

test('.privacy set : valeur refusée puis valeur câblée (updateLastSeenPrivacy)', async () => {
  fresh(G); const s = mockSock();
  await run(s, text(G, H.OWNER, '.privacy set lastseen bob'));
  assert.ok(texts(s).some((t) => plain(t).includes('REFUSÉE')));
  await run(s, text(G, H.OWNER, '.privacy set lastseen all'));
  assert.ok(s.settings.includes('privacy:lastseen=all'), 'setter appelé avec la valeur validée');
});

test('.setpp delete → removeProfilePicture (repli image inchangé)', async () => {
  fresh(G); const s = mockSock();
  await run(s, text(G, H.OWNER, '.setpp delete'));
  assert.ok(s.settings.includes('rpp'), 'removeProfilePicture appelé');
});

test('.label : garde API sur l\'association chat', async () => {
  fresh(G); const s = mockSock();
  const m = msg(G, H.OWNER, {
    extendedTextMessage: { text: '.label add 42', contextInfo: { mentionedJid: [jid(H.MEMBER)] } },
  });
  await run(s, m);
  assert.ok(texts(s).some((t) => plain(t).includes('API ABSENTE')), 'addChatLabel absent du faux socket');
});

test('.mygroups et .inviteinfo : listes publiques + usage sans lien', async () => {
  fresh(G); const s = mockSock();
  await run(s, text(G, H.MEMBER, '.mygroups'));
  assert.ok(texts(s).some((t) => plain(t).includes('MES GROUPS')));
  await run(s, text(G, H.MEMBER, '.inviteinfo pas-un-lien'));
  assert.ok(texts(s).some((t) => plain(t).includes('INVITEINFO')));
  await run(s, text(G, H.MEMBER, '.inviteinfo https://chat.whatsapp.com/AbCdEfGh123'));
  assert.ok(texts(s).some((t) => plain(t).includes('GROUPGETINVITEINFO')), 'garde API atteinte');
});

test('.seen : presenceSubscribe puis état reçu par presence.update', async () => {
  fresh(G); const s = mockSock();
  const m = msg(G, H.MEMBER, {
    extendedTextMessage: { text: '.seen @contact', contextInfo: { mentionedJid: [jid(H.MEMBER)] } },
  });
  const waiter = run(s, m);
  const start = Date.now();
  const timer = setInterval(() => {
    if (presence._pending.size > 0) {
      clearInterval(timer);
      presence.handle({
        id: G,
        presences: { [jid(H.MEMBER) + ':7']: { lastKnownPresence: 'composing' } },
      });
    } else if (Date.now() - start > 3000) {
      clearInterval(timer); // échec propre si la demande n'est jamais créée
    }
  }, 10);
  await waiter;
  clearInterval(timer);
  assert.ok(s.settings.includes('sub:' + jid(H.MEMBER)), 'presenceSubscribe appelé');
  assert.ok(texts(s).some((t) => plain(t).includes('ÉCRIT')), 'état composing affiché');
});

test('.community : aide par défaut + garde API sur list', async () => {
  fresh(G); const a = H.newAdmin(); const s = mockSock({ admins: [a] });
  await run(s, text(G, a, '.community'));
  assert.ok(texts(s).some((t) => plain(t).includes('requests')), 'aide des sous-commandes');
  await run(s, text(G, a, '.community list'));
  assert.ok(texts(s).some((t) => plain(t).includes('API ABSENTE')), 'communityFetchAllParticipating absent');
  await run(s, text(G, a, '.community leave'));
  assert.ok(texts(s).some((t) => plain(t).includes('COMMUNITYLEAVE')), 'garde API leave atteinte');
});

test('.disappear : table partagée lib/ephemeral (24h → 86400 s)', async () => {
  fresh(G); const a = H.newAdmin(); const s = mockSock({ admins: [a] });
  await run(s, text(G, a, '.disappear 24h'));
  assert.ok(s.sent.some((m) => m.disappearingMessagesInChat === 86400));
  await run(s, text(G, a, '.disappear bof'));
  assert.ok(texts(s).some((t) => plain(t).includes('Usage')), 'argument inconnu → usage');
});
