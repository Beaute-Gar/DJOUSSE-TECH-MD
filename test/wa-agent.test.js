'use strict';
/* Vrais tests HTTP — client + pont WhatsApp Agent Platform.
   Un serveur local imite l'API officielle (mêmes routes, mêmes formes). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { AgentClient, AgentError, limiteTaille, typeDepuisMime } = require('../lib/wa-agent');
const { messageAgentVersBaileys, envoyerContenu, demarrerBoucle, jidLocalDepuisAgent, destinataireReel } = require('../lib/wa-agent-bridge');

/* ── faux serveur API ── */
function serveur(comportement) {
  const recus = [];
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const auth = req.headers.authorization;
    /* JSON : on lit le corps (les tests vérifient le contenu).
       Multipart : on le draine SANS l'attendre (req.resume) — sinon la
       réponse serait bloquée sous node --test (fetch attend la fin du corps). */
    const chunks = [];
    if (req.headers['content-type']?.includes('json')) {
      try { for await (const c of req) chunks.push(c); } catch {}
    } else {
      req.resume();
    }
    const brut = Buffer.concat(chunks).toString();
    let corps = null;
    if (req.headers['content-type']?.includes('json') && brut) {
      try { corps = JSON.parse(brut); } catch { corps = null; }
    }
    recus.push({ methode: req.method, chemin: url.pathname + url.search, auth, corps, multipart: req.headers['content-type']?.includes('multipart') ? '[multipart]' : null });
    const sortie = await comportement(req, res, corps, recus);
    if (!res.writableEnded) {
      res.writeHead(sortie?.status || 200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(sortie?.body ?? {}));
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      server.unref?.(); // un serveur de test ne garde jamais le process en vie
      resolve({
        recus,
        url: `http://127.0.0.1:${server.address().port}`,
        close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }),
      });
    });
  });
}

function clientSur(base, extra = {}) {
  return new AgentClient({
    token: extra.token ?? 'jeton-test',
    fetchImpl: (url, opts) => {
      /* réécrit https://api.whatsapp.com/agent/v1 → notre serveur local */
      const u = String(url).replace('https://api.whatsapp.com/agent/v1', base);
      return fetch(u, opts);
    },
    log: () => {},
    dors: () => new Promise((r) => setTimeout(r, 1)), // backoff instantané en test
    ...extra,
  });
}

/* ══════════ envoi ══════════ */
test('envoi texte : POST /messages avec Bearer, to, type, body', async () => {
  const s = await serveur(() => ({ body: { messaging_product: 'whatsapp', contacts: [{ input: 'user:1', wa_id: 'user:1' }], messages: [{ id: 'wamid.ABC' }] } }));
  const c = clientSur(s.url);
  const r = await c.envoyer({ to: 'user:1', texte: 'Bonjour agent' });
  assert.equal(r.id, 'wamid.ABC');
  const req = s.recus.find((x) => x.chemin === '/messages');
  assert.equal(req.methode, 'POST');
  assert.equal(req.auth, 'Bearer jeton-test');
  assert.equal(req.corps.to, 'user:1');
  assert.equal(req.corps.type, 'text');
  assert.equal(req.corps.text.body, 'Bonjour agent');
  await s.close();
});

test('texte > 4096 caractères → tronqué avant envoi', async () => {
  const s = await serveur(() => ({ body: { messages: [{ id: 'w1' }] } }));
  const c = clientSur(s.url);
  await c.envoyer({ to: 'user:1', texte: 'x'.repeat(5000) });
  const req = s.recus.find((x) => x.chemin === '/messages');
  assert.equal(req.corps.text.body.length, 4096);
  await s.close();
});

test('envoi d\'une réaction → refusé AVANT l\'appel (réception seule)', async () => {
  const s = await serveur(() => ({ body: {} }));
  const c = clientSur(s.url);
  await assert.rejects(() => c.envoyer({ to: 'user:1', type: 'reaction' }), (e) => e.code === 131009);
  assert.equal(s.recus.filter((x) => x.chemin === '/messages').length, 0, 'aucun appel fait');
  await s.close();
});

test('média : upload (multipart) puis envoi avec l\'id retourné', async () => {
  const s = await serveur((req, res, corps, recus) => {
    if (recus[recus.length - 1]?.chemin === '/media') return { body: { id: 'MEDIA-42' } };
    return { body: { messages: [{ id: 'wamid.MEDIA' }] } };
  });
  const c = clientSur(s.url);
  const r = await envoyerContenu(c, 'user:1', { image: Buffer.from([0x89, 0x50, 0x4e, 0x47]), caption: 'regarde' });
  assert.equal(r.id, 'wamid.MEDIA');
  const up = s.recus.find((x) => x.chemin === '/media');
  assert.ok(up, 'upload appelé');
  const send = s.recus.find((x) => x.chemin === '/messages');
  assert.equal(send.corps.image.id, 'MEDIA-42');
  assert.equal(send.corps.image.caption, 'regarde');
  await s.close();
});

test('média trop gros → refus AVANT l\'upload, avec le bon type', async () => {
  const s = await serveur(() => ({ body: { id: 'X' } }));
  const c = clientSur(s.url);
  /* sticker : limite 500 KB — 600 KB doit être refusé */
  await assert.rejects(
    () => envoyerContenu(c, 'user:1', { sticker: Buffer.alloc(600 * 1024) }),
    (e) => e.code === 131053 && e.status === 400,
  );
  assert.equal(s.recus.length, 0, 'aucun upload lancé');
  await s.close();
});

test('envoi vers un NON-créateur → refus AVANT l\'appel (limite officielle)', async () => {
  const s = await serveur(() => ({ body: { messages: [{ id: 'w' }] } }));
  const c = clientSur(s.url, { createur: 'user:createur' });
  await assert.rejects(
    () => envoyerContenu(c, 'user:quelquun', { text: 'salut' }),
    (e) => e.code === 131005,
  );
  assert.equal(s.recus.filter((x) => x.chemin === '/messages').length, 0);
  await s.close();
});

/* ══════════ réception ══════════ */
test('GET /updates → messages + statuses convertis', async () => {
  const s = await serveur(() => ({
    body: {
      object: 'whatsapp_agent_platform',
      entry: [{
        id: '99',
        changes: [{
          field: 'messages',
          value: {
            contacts: [{ wa_id: 'user:5', profile: { name: 'Alex' } }],
            messages: [{
              from: 'user:5', id: 'wamid.IN1', timestamp: '1736844652', type: 'text',
              text: { body: '.menu' },
            }],
            statuses: [{ id: 'wamid.OUT', status: 'read', recipient_id: 'user:5', timestamp: '1736844653' }],
          },
        }],
      }],
      next_offset: 12,
    },
  }));
  const c = clientSur(s.url);
  const r = await c.mises({ offset: 5 });
  assert.equal(r.messages.length, 1);
  assert.equal(r.statuses.length, 0 + 1);
  assert.equal(r.nextOffset, 12);
  assert.equal(c.offset, 12, 'offset mémorisé pour le prochain sondage');
  await s.close();
});

test('message texte converti en objet façon Baileys (compatible handler)', async () => {
  const msg = messageAgentVersBaileys({
    from: 'user:7', id: 'wamid.X', timestamp: '1736844652', type: 'text', text: { body: '.ping' },
  }, [{ wa_id: 'user:7', profile: { name: 'Bo' } }]);
  assert.equal(msg.key.remoteJid, 'user:7');
  assert.equal(msg.key.id, 'wamid.X');
  assert.equal(msg.message.conversation, '.ping');
  assert.equal(msg.pushName, 'Bo');
});

test('message cité → extendedTextMessage avec contextInfo', async () => {
  const msg = messageAgentVersBaileys({
    from: 'user:7', id: 'wamid.Y', type: 'text',
    text: { body: 'réponse' },
    context: { id: 'wamid.CITE', from: 'agent:99' },
  }, []);
  assert.equal(msg.message.extendedTextMessage.text, 'réponse');
  assert.equal(msg.message.extendedTextMessage.contextInfo.stanzaId, 'wamid.CITE');
});

test('média entrant → handle conservé pour le téléchargement', async () => {
  const msg = messageAgentVersBaileys({
    from: 'user:7', id: 'wamid.Z', type: 'image',
    image: { id: 'M1', mime_type: 'image/jpeg', caption: 'photo' },
  }, []);
  assert.equal(msg.message.imageMessage.mimetype, 'image/jpeg');
  assert.equal(msg.message.imageMessage._agentMediaId, 'M1');
});

test('sondage vide (204) → { vide: true } sans offset modifié', async () => {
  const s = await serveur(() => ({ status: 204 }));
  const c = clientSur(s.url);
  const r = await c.mises({ offset: 9 });
  assert.equal(r.vide, true);
  assert.equal(r.offset, 9);
  await s.close();
});

test('démarrage sans offset → pas de backlog (head actuel)', async () => {
  const appels = [];
  const s = await serveur((req, res, corps, recus) => {
    appels.push(recus[recus.length - 1]?.chemin || req.url);
    return { status: 204 };
  });
  const c = clientSur(s.url);
  assert.equal(c.offset, null, 'offset nul au démarrage');
  await c.mises();
  const chemin = appels[appels.length - 1];
  assert.ok(!chemin.includes('offset='), `pas d'offset dans l'URL : ${chemin}`);
  await s.close();
});

/* ══════════ erreurs & quotas ══════════ */
test('token absent → 401 code 190 avec conseil clair', async () => {
  const s = await serveur(() => ({ status: 401, body: { error: { message: '(190)', code: 190 } } }));
  const c = clientSur(s.url);
  await assert.rejects(() => c.envoyer({ to: 'user:1', texte: 'x' }), (e) => {
    assert.equal(e.code, 190);
    assert.match(e.conseil, /Bearer/);
    return true;
  });
  await s.close();
});

test('destinataire non créateur par l\'API → 403 code 131005 traduit', async () => {
  const s = await serveur(() => ({ status: 403, body: { error: { message: '(131005)', code: 131005 } } }));
  const c = clientSur(s.url);
  await assert.rejects(() => c.envoyer({ to: 'user:autre', texte: 'x' }), (e) => {
    assert.equal(e.code, 131005);
    assert.match(e.conseil, /créateur/);
    return true;
  });
  await s.close();
});

test('429 puis succès → backoff puis 1 seul envoi', async () => {
  let n = 0;
  const s = await serveur(() => {
    n += 1;
    if (n === 1) return { status: 429, body: { error: { message: '(130429)', code: 130429 } } };
    return { body: { messages: [{ id: 'wamid.ok' }] } };
  });
  const c = clientSur(s.url, { maxTentatives: 3 });
  const r = await c.envoyer({ to: 'user:1', texte: 'après quota' });
  assert.equal(r.id, 'wamid.ok');
  assert.equal(n, 2, 'un 429 puis un succès');
  await s.close();
});

test('400 (champ manquant) → PAS de retry (corriger d\'abord)', async () => {
  let n = 0;
  const s = await serveur(() => { n += 1; return { status: 400, body: { error: { message: 'to', code: 131009 } } }; });
  const c = clientSur(s.url, { maxTentatives: 4 });
  await assert.rejects(() => c.envoyer({ to: 'user:1', texte: 'x' }), (e) => e.code === 131009);
  assert.equal(n, 1, 'une seule tentative');
  await s.close();
});

test('quota local 12/min dépassé → refus AVANT l\'appel HTTP', async () => {
  const s = await serveur(() => ({ body: { messages: [{ id: 'w' }] } }));
  const c = clientSur(s.url);
  for (let i = 0; i < 12; i += 1) await c.envoyer({ to: 'user:1', texte: `m${i}` });
  const avant = s.recus.filter((x) => x.chemin === '/messages').length;
  assert.equal(avant, 12);
  await assert.rejects(() => c.envoyer({ to: 'user:1', texte: 'trop' }), (e) => e.code === 130429);
  assert.equal(s.recus.filter((x) => x.chemin === '/messages').length, 12, 'pas de 13e appel');
  await s.close();
});

test('média : métadonnées puis téléchargement des octets', async () => {
  const octets = Buffer.from('contenu-media-reel');
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/media/M9') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        url: `http://127.0.0.1:${server.address().port}/media/M9/content`,
        mime_type: 'image/png', sha256: 'ab', file_size: octets.length, id: 'M9',
      }));
      return;
    }
    if (url.pathname === '/media/M9/content') {
      assert.equal(req.headers.authorization, 'Bearer jeton-test', 'le média se télécharge avec le jeton');
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(octets);
      return;
    }
    res.writeHead(404).end();
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const c = clientSur(base);
  const meta = await c.metaMedia('M9');
  assert.equal(meta.mime_type, 'image/png');
  assert.equal(meta.file_size, octets.length);
  const dl = await c.telecharger('M9');
  assert.equal(dl.buffer.toString(), 'contenu-media-reel');
  assert.equal(dl.mime, 'image/png');
  await new Promise((r) => { server.closeAllConnections?.(); server.close(r); });
});

/* ══════════ pont ══════════ */
test('boucle : un message reçu est transmis au handler puis marqué lu', async () => {
  let polls = 0;
  const s = await serveur(() => {
    polls += 1;
    /* après 2 sondages on renvoie 204 : la boucle s'arrête d'elle-même,
       le test n'attend pas 20 s de timeout. */
    if (polls <= 2) {
      return {
        body: {
          entry: [{ id: '1', changes: [{ field: 'messages', value: {
            contacts: [], messages: polls === 1
              ? [{ from: 'user:5', id: 'wamid.A', timestamp: '1736844652', type: 'text', text: { body: '.ping' } }]
              : [], statuses: [],
          } }] }],
          next_offset: 2,
        },
      };
    }
    return { status: 204 };
  });
  const c = clientSur(s.url, { timeoutMs: 5000, maxTentatives: 2 });
  const vus = [];
  const arreter = demarrerBoucle(c, null, { onMessage: (m) => vus.push(m), log: () => {} });
  /* on attend que le message soit traité (pas une durée fixe) */
  for (let i = 0; i < 60 && vus.length === 0; i += 1) await new Promise((r) => setTimeout(r, 25));
  arreter();
  assert.equal(vus.length, 1, 'un message transmis au moteur');
  assert.equal(vus[0].message.conversation, '.ping');
  const statuts = s.recus.filter((x) => x.chemin === '/statuses');
  assert.ok(statuts.length >= 1, 'message marqué lu via POST /statuses');
  assert.equal(statuts[0].corps.status, 'read');
  await s.close();
});

test('limites officielles exposées (tailles et types)', () => {
  assert.equal(limiteTaille('image'), 5 * 1024 * 1024);
  assert.equal(limiteTaille('sticker'), 500 * 1024);
  assert.equal(limiteTaille('video'), 16 * 1024 * 1024);
  assert.equal(typeDepuisMime('image/webp'), 'sticker');
  assert.equal(typeDepuisMime('image/jpeg'), 'image');
  assert.equal(typeDepuisMime('audio/ogg'), 'audio');
});

/* ══════════ identité : le créateur de l'agent est OWNER ══════════ */
test('id agent « user:123 » → JID local Baileys, reconnu owner par le moteur', () => {
  const auth = require('./../lib/auth');
  const config = require('./../config');
  const { jidNum } = require('./../guard/src/utils/perms');

  assert.equal(jidLocalDepuisAgent('user:20749792362661'), '20749792362661@s.whatsapp.net');
  assert.equal(jidLocalDepuisAgent('agent:42'), '42@s.whatsapp.net');
  assert.equal(jidLocalDepuisAgent('sans-chiffres'), null);
  assert.equal(jidLocalDepuisAgent(''), null);

  const local = jidLocalDepuisAgent('user:20749792362661');
  /* le handler appelle jidNum puis auth.* : les chiffres doivent survivre */
  assert.equal(jidNum(local), '20749792362661');

  const avant = config.ownerNumber.length;
  if (!config.ownerNumber.includes('20749792362661')) config.ownerNumber.push('20749792362661');
  try {
    assert.equal(auth.isOwner(local), true, 'créateur reconnu owner');
    assert.equal(auth.canRun(local), true, 'gate d\'accès ouvert');
    assert.equal(auth.isOwner('99999999999@s.whatsapp.net'), false, 'un inconnu reste refusé');
    assert.equal(auth.canRun('99999999999@s.whatsapp.net'), false);
  } finally {
    config.ownerNumber.length = avant;
  }
});

test('message agent : JID local exposé, id réel conservé pour l\'envoi', () => {
  const local = jidLocalDepuisAgent('user:20749792362661');
  const msg = messageAgentVersBaileys(
    { from: 'user:20749792362661', id: 'wamid.O', type: 'text', text: { body: '.menu' } },
    [], { jidLocal: local },
  );
  assert.equal(msg.key.remoteJid, local);
  assert.equal(msg.key.participant, local);
  assert.equal(msg._agentFrom, 'user:20749792362661');
  assert.equal(msg.message.conversation, '.menu');

  /* sans option : comportement d'origine préservé (compat tests/appels) */
  const brut = messageAgentVersBaileys({ from: 'user:7', id: 'x', type: 'text', text: { body: 'y' } }, []);
  assert.equal(brut.key.remoteJid, 'user:7');

  /* retraduction à l'envoi */
  const client = { jidLocal: local, createur: 'user:20749792362661' };
  assert.equal(destinataireReel(client, local), 'user:20749792362661');
  assert.equal(destinataireReel(client, 'autre@s.whatsapp.net'), 'autre@s.whatsapp.net');
  assert.equal(destinataireReel({}, 'user:1'), 'user:1');
});

test('boucle : le créateur devient owner local et la réponse part vers l\'id réel', async () => {
  let polls = 0;
  const s = await serveur(() => {
    polls += 1;
    if (polls === 1) {
      return {
        body: {
          entry: [{ id: '1', changes: [{ field: 'messages', value: {
            contacts: [],
            messages: [{ from: 'user:20749792362661', id: 'wamid.N', type: 'text', text: { body: '.menu' } }],
            statuses: [],
          } }] }],
          next_offset: 2,
        },
      };
    }
    return { status: 204 };
  });
  const c = clientSur(s.url, { timeoutMs: 5000, maxTentatives: 2 });
  const vus = [];
  const arreter = demarrerBoucle(c, null, { onMessage: (m) => vus.push(m), log: () => {} });
  for (let i = 0; i < 60 && vus.length === 0; i += 1) await new Promise((r) => setTimeout(r, 25));
  arreter();

  assert.equal(c.createur, 'user:20749792362661');
  assert.equal(c.jidLocal, '20749792362661@s.whatsapp.net');
  assert.equal(vus.length, 1);
  assert.equal(vus[0].key.remoteJid, '20749792362661@s.whatsapp.net');

  /* le moteur répond au JID local → l'API doit recevoir l'id réel */
  await c.sendMessage(c.jidLocal, { text: 'pong' });
  const envoi = s.recus.filter((x) => x.chemin === '/messages').pop();
  assert.ok(envoi, 'un envoi a eu lieu');
  assert.equal(envoi.corps.to, 'user:20749792362661');
  await s.close();
});
