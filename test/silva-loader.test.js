'use strict';
/* Vrai test : adapter un plugin silva et EXÉCUTER sa commande pour de vrai. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
process.env.HACKTOOLS_PASSWORD = 'test';
const h = require('../handler');

/* contexte d'exécution façon executeCommand() de handler.js */
function ctx(args, from) {
  const out = [];
  const sock = {
    user: { id: 'bot@s.whatsapp.net' },
    sendMessage: async (jid, content) => { out.push({ jid, content }); return { key: { remoteJid: jid, id: 'X1' } }; },
    groupMetadata: async () => ({ subject: 'Test', participants: [{ id: 'a@s.whatsapp.net', admin: 'admin' }] }),
    groupParticipantsUpdate: async () => {},
    profilePictureUrl: async () => 'https://x/y.jpg',
    sendPresenceUpdate: async () => {},
  };
  const c = {
    ...{ from: from || 'g@g.us', sender: '111@s.whatsapp.net', senderNum: '111', isGroup: true, isOwner: true, isAdmin: true, isBotAdmin: true },
    args, sock, msg: { key: { remoteJid: from || 'g@g.us' }, message: {} },
    reply: async (t) => out.push({ jid: from || 'g@g.us', content: { text: String(t) } }),
    error: async (l) => out.push({ content: { error: l } }),
    success: async (l) => out.push({ content: { ok: l } }),
  };
  return { c, out };
}

async function runCmd(nom, args, from) {
  const entry = h.commands.get(nom);
  assert.ok(entry, `commande ${nom} enregistrée`);
  const { c, out } = ctx(args, from);
  await entry.handler(c);
  return out;
}

test('le chargeur a enregistré plus de 1000 commandes silva', () => {
  assert.ok(h.commands.size > 1000, `attendu > 1000, obtenu ${h.commands.size}`);
  console.log('   registre total :', h.commands.size);
});

test('RÉEL — .8ball répond une des réponses du plugin silva', async () => {
  const out = await runCmd('8ball', ['vais-je', 'être', 'riche'], 'g@g.us');
  const txt = JSON.stringify(out);
  assert.match(txt, /certain|doubt|definitely|likely|signs point|ask again|cannot predict|concentrate|count on|reply is no|sources say|doubtful|outlook/i);
});

test('RÉEL — .emojiguess lance un devinette (état du plugin conservé)', async () => {
  const out = await runCmd('emojiguess', [], 'partie1@g.us');
  assert.match(JSON.stringify(out), /Guess|emoji|Movie/i);
});

test('RÉEL — .mathquiz pose un calcul (plugin silva avec état)', async () => {
  const out = await runCmd('mathquiz', [], 'mathpartie@g.us');
  const txt = JSON.stringify(out);
  assert.match(txt, /Quick Math|[0-9]+\s*[-+×x*]\s*[0-9]+/);
});

test('RÉEL — .flagquiz pose un drapeau à deviner', async () => {
  const out = await runCmd('flagquiz', [], 'fl@g.us');
  assert.match(JSON.stringify(out), /Country|Country|Guess/i);
});

test('les commandes interdites (crash/NSFW) ne sont PAS enregistrées', () => {
  for (const n of ['loccrash', 'crashbug', 'amountbug', 'bombug', 'lagbug', 'terminate', 'hentai']) {
    assert.ok(!h.commands.has(n), `${n} ne doit pas exister`);
  }
});

test('aucun plugin silva ne pose de listener (pas de double écoute)', () => {
  const fs = require('fs');
  const path = require('path');
  const dir = path.join(process.cwd(), 'plugins', 'silva');
  const fichiers = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));
  const coupables = [];
  for (const f of fichiers) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    if (/\.ev\s*\.\s*on\s*\(/.test(src)) coupables.push(f);
  }
  assert.deepEqual(coupables, [], `plugins avec listener : ${coupables.join(', ')}`);
});

test('les catégories silva recouvrent les 11 menus', () => {
  const cats = new Set();
  for (const e of h.commands.values()) cats.add(e.cat);
  const attendues = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  for (const a of attendues) assert.ok(cats.has(a), `catégorie ${a} utilisée`);
});
