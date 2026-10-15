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

/* ── Marque tierce « Silva » → identité maison ── */
const { retirerSignatureTierce, normaliserContenu, loadSilvaPlugins } = require('../lib/silva-loader');

test('« Powered by Silva MD » réécrit en identité maison', () => {
  const out = retirerSignatureTierce('_Powered by Silva MD_');
  assert.ok(!/silva/i.test(out), 'plus aucune trace de Silva');
  assert.match(out, /DJOUSSE-TECH-MD/);
});

test('variantes Silva (Tech Inc, CoinGecko, bare) toutes réécrites', () => {
  for (const s of [
    'Powered by Silva Tech Inc',
    'Powered by CoinGecko • Silva MD_',
    "I'm *Silva* 🤖",
    'SilvaTech repository',
  ]) {
    const out = retirerSignatureTierce(s);
    assert.ok(!/silva/i.test(out), `trace Silva restante: ${out}`);
  }
});

test('les références de commandes en minuscules ne sont PAS réécrites', () => {
  const s = '• "silva play <song>" • "silva silvatech repos"';
  assert.equal(retirerSignatureTierce(s), s, 'aide des commandes laissée intacte');
});

test('légende média : marque nettoyée, mais AUCUN cadre erreur/succès', () => {
  const c = normaliserContenu({ image: { url: 'x' }, caption: '✅ Done Silva MD' }, style);
  assert.ok(!/silva/i.test(c.caption), 'marque retirée de la légende');
  assert.ok(!/CADRE-/.test(c.caption), 'pas de cadre dans une légende d’image');
});

test('le ctx silva expose bien safeSend / jid / message / theme / download', async () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'silva-ctx-'));
  fs.writeFileSync(path.join(dir, 'demo.js'), `module.exports = { commands: ['demotestctx'], run: async (sock, m, a, ctx) => {
    const { safeSend, send, jid, message, groupMetadata, mentionedJid, theme, pushName, download } = ctx;
    const resume = {
      safeSend: typeof safeSend, send: typeof send, jid, message: !!message,
      groupMetadata, mention: mentionedJid.length, admin: !!theme.admin,
      pushName: typeof pushName, download: typeof download,
    };
    await safeSend({ text: JSON.stringify(resume) });
  } };`);
  let handler = null;
  const cmd = (noms, meta, fn) => { handler = fn; };
  loadSilvaPlugins(cmd, {
    dir,
    config: { prefix: '.', botName: 'DJOUSSE-TECH-MD' },
    send: async (sock, jid, c) => { envoyes.push(c.text); },
    style: { renderError: (l) => l.join(' '), renderSuccess: (l) => l.join(' '), botName: 'DJOUSSE-TECH-MD' },
    download: async () => Buffer.from('x'),
  });
  const envoyes = [];
  const ctx = {
    sock: { sendMessage: async () => {} },
    msg: { key: {}, message: { extendedTextMessage: { contextInfo: { mentionedJid: ['x@s.whatsapp.net'] } } } },
    args: [], q: '', from: 'c@s.whatsapp.net', sender: 'c@s.whatsapp.net', senderNum: '1',
    isOwner: true, isGroup: false, reply: async () => {}, react: async () => {},
  };
  assert.equal(typeof handler, 'function', 'commande démo enregistrée');
  await handler(ctx);
  assert.equal(envoyes.length, 1, 'safeSend a bien envoyé');
  const r = JSON.parse(envoyes[0]);
  assert.equal(r.safeSend, 'function');
  assert.equal(r.send, 'function');
  assert.equal(r.jid, 'c@s.whatsapp.net');
  assert.equal(r.message, true);
  assert.equal(r.mention, 1);
  assert.equal(r.admin, true);
  assert.equal(r.pushName, 'string');
  assert.equal(r.download, 'function');
});

