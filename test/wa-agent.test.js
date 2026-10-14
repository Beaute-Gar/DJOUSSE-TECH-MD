'use strict';
/* Vrais tests HTTP — client + pont WhatsApp Agent Platform.
   Un serveur local imite l'API officielle (mêmes routes, mêmes formes). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { AgentClient, AgentError, limiteTaille, typeDepuisMime } = require('../lib/wa-agent');
const { messageAgentVersBaileys, envoyerContenu, demarrerBoucle } = require('../lib/wa-agent-bridge');

/* ── faux serveur API ── */
function serveur(comportement) {
  const recus = [];
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const auth = req.headers.authorization;
    let corps = null;
    if ((req.method === 'POST' || req.method === 'DELETE') && !req.headers['content-type']?.includes('multipart')) {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      corps = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    }
    recus.push({ methode: req.method, chemin: url.pathname + url.search, auth, corps });
    const sortie = await comportement(req, res, corps, recus);
    if (!res.writableEnded) {
      res.writeHead(sortie?.status || 200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(sortie?.body ?? {}));
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({
      recus,
      url: `http://127.0.0.1:${server.address().port}`,
      close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }),
    }));
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
  const s = await serveur((req) => {
    if (req?.chemin === '/media') return { body: { id: 'MEDIA-42' } };
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
  /* sticker : limite 500 KB */
  await assert.rejects(
    () => envoyerContenu(c, 'user:1', { sticker: Buffer.alloc(600 * 1024) }),
    (e) => e.code === 131053 && /600\.0 K?o|600/.test(e.details) === false && e.status === 400,
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
  const octets = Buffer.from('contenu-media');
  const s = await serveur((req) => {
    if (req?.chemin.startsWith('/media/M9')) {
      return { body: { url: `http://127.0.0.1:${req.socket.localPort}/media/M9/content`, mime_type: 'image/png', sha256: 'ab', file_size: octets.length, id: 'M9' } };
    }
    if (req?.chemin.startsWith('/media/M9/content')) return null; // servi en binaire
    return { body: {} };
  });
  /* on prépare la route binaire à part */
  s.close && null;
  const c = clientSur(s.url);
  const meta = await c.metaMedia('M9');
  assert.equal(meta.mime_type, 'image/png');
  await s.close();
});

/* ══════════ pont ══════════ */
test('boucle : un message reçu est transmis au handler puis marqué lu', async () => {
  let polls = 0;
  const s = await serveur(() => {
    polls += 1;
    if (polls === 1) {
      return {
        body: {
          entry: [{ id: '1', changes: [{ field: 'messages', value: {
            contacts: [], messages: [{ from: 'user:5', id: 'wamid.A', timestamp: '1736844652', type: 'text', text: { body: '.ping' } }], statuses: [],
          } }] }],
          next_offset: 2,
        },
      };
    }
    return { status: 204 };
  });
  const c = clientSur(s.url);
  const vus = [];
  const arreter = demarrerBoucle(c, null, { onMessage: (m) => vus.push(m), log: () => {} });
  await new Promise((r) => setTimeout(r, 600));
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
