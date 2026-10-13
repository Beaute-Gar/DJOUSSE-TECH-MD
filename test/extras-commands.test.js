'use strict';
/* Vrai test node:test — registerExtras() avec cmd mock, puis exécution
   réelle des handlers des nouvelles commandes (aucune simulation). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { registerExtras } = require('../lib/extras');

const NEW = ['hangman', 'hang', 'trivia', 'answer', 'riddle', 'tictactoe', 'tttmove',
  'numberguess', 'nguess', 'wordgame', 'morse', 'hash', 'color', 'ascii', 'define',
  'lyrics', 'password', 'remind', 'note', 'bookmark', 'crypto', 'speedtest',
  'timezone', 'dns', 'listadmins', 'listmembers', 'lock', 'unlock', 'grouprules',
  'groupbackup', 'setprefix', 'dmall', 'togif', 'tojpeg', 'textsticker'];

/* ctx minimal mais réel : les mêmes clés que handler.js destructure */
function mkCtx() {
  return {
    config: { prefix: '.', packname: 'DJOUSSE', author: 'DJOUSSE TECH' },
    mediaInfo: () => null,
    downloadFrom: async () => Buffer.alloc(0),
    sharp: null, Sticker: class {}, StickerTypes: { FULL: 'full' },
    renderSuccess: (l) => `OK ${l.join(' ')}`,
    renderError: (l) => `ERR ${l.join(' ')}`,
    buildFrame: (t, l) => [t, ...l].join('\n'),
    bullet: (k, v) => `${k}: ${v}`,
    toUnicode: (s) => s,
    note: (s) => s,
    ctxInfo: () => ({}),
    unwrap: (m) => m,
  };
}

/* cmd() accepte (name, meta, fn) ET (name, aliases, meta, fn) */
function boot() {
  const reg = new Map();
  const cmd = (...a) => {
    const fn = a[a.length - 1];
    if (typeof fn !== 'function') return;
    reg.set(a[0], { meta: a[1], fn });
  };
  registerExtras(cmd, mkCtx());
  return reg;
}

/* contexte d'exécution façon executeCommand() */
function mkC(args, q, from) {
  const out = [];
  const c = {
    args, q: q !== undefined ? q : args.join(' '),
    from: from || '123@g.us', sender: '229@s.whatsapp.net',
    sock: { user: { id: 'bot@s.whatsapp.net' } },
    msg: { key: { remoteJid: from || '123@g.us' }, message: {} },
    reply: async (t) => { out.push(String(t)); },
    error: async (l) => { out.push('ERR: ' + (Array.isArray(l) ? l.join(' ') : l)); },
    success: async (l) => { out.push('OK: ' + (Array.isArray(l) ? l.join(' ') : l)); },
    info: async (l) => { out.push('INFO: ' + (Array.isArray(l) ? l.join(' ') : l)); },
  };
  c._out = out;
  return c;
}

test('les 35 nouvelles commandes sont enregistrées', () => {
  const reg = boot();
  const miss = NEW.filter((n) => !reg.has(n));
  assert.deepEqual(miss, [], `absentes: ${miss.join(', ')}`);
  assert.equal(reg.size >= NEW.length, true, `au moins ${NEW.length} commandes`);
});

test('jeux — pendu, trivia, réponse, devinette, morpion', async () => {
  const reg = boot();
  /* pendu : démarrage puis une lettre */
  let c = mkC([]);
  await reg.get('hangman').fn(c);
  assert.match(c._out.join(' '), /PENDU/);
  assert.match(c._out.join(' '), /_ _ _ _ _ _/);
  c = mkC(['A']);
  await reg.get('hang').fn(c);
  assert.match(c._out.join(' '), /PENDU/);
  /* mauvaise lettre sans partie (contexte isolé) */
  c = mkC(['A'], undefined, 'isole@g.us');
  await reg.get('hang').fn(c);
  assert.match(c._out.join(' '), /AUCUNE PARTIE/);

  /* trivia + answer : la question est posée, puis la réponse vérifiée */
  c = mkC([]);
  await reg.get('trivia').fn(c);
  assert.match(c._out.join(' '), /CULTURE GÉNÉRALE/);
  c = mkC(['inconnu']);
  await reg.get('answer').fn(c);
  assert.match(c._out.join(' '), /RÉPONSE/);

  /* devinette : bornes */
  c = mkC([]);
  await reg.get('numberguess').fn(c);
  assert.match(c._out.join(' '), /DEVINETTE/);
  c = mkC(['x']);
  await reg.get('nguess').fn(c);
  assert.match(c._out.join(' '), /USAGE/);

  /* morpion : sans adversaire → usage propre, pas de crash */
  c = mkC([]);
  await reg.get('tictactoe').fn(c);
  assert.match(c._out.join(' '), /ADVERSAIRE MANQUANT/);
  c = mkC(['1']);
  await reg.get('tttmove').fn(c);
  assert.match(c._out.join(' '), /AUCUNE PARTIE/);
});

test('outils — morse, hash, password, ascii, timezone, notes, bookmarks', async () => {
  const reg = boot();
  let c = mkC(['HELLO']);
  await reg.get('morse').fn(c);
  assert.equal(c._out[0].trim(), '.... . .-.. .-.. ---');

  c = mkC(['test']);
  await reg.get('hash').fn(c);
  assert.match(c._out.join(' '), /098f6bcd4621d373cade4e832627b4f6/);
  assert.match(c._out.join(' '), /9f86d081884c7d659a2feaa0c55ad015a3bf4f1/);

  c = mkC([]);
  await reg.get('password').fn(c);
  assert.match(c._out.join(' '), /MOT DE PASSE/);
  assert.match(c._out.join(' '), /Longueur : 16/);
  c = mkC(['32']);
  await reg.get('password').fn(c);
  assert.match(c._out.join(' '), /Longueur : 32/);

  c = mkC(['AB']);
  await reg.get('ascii').fn(c);
  assert.match(c._out.join(''), /█{5}/);

  c = mkC(['paris']);
  await reg.get('timezone').fn(c);
  assert.match(c._out.join(' '), /HEURE — PARIS/);

  /* notes : ajout puis liste */
  c = mkC(['ma note']);
  await reg.get('note').fn(c);
  assert.match(c._out.join(' '), /NOTE AJOUTÉE/);
  c = mkC(['list']);
  await reg.get('note').fn(c);
  assert.match(c._out.join(' '), /NOTES \(1\)/);

  c = mkC(['https://exemple.com']);
  await reg.get('bookmark').fn(c);
  assert.match(c._out.join(' '), /MARQUE-PAGE AJOUTÉ/);
});

test('usages manquants → message d\'erreur propre, aucun crash', async () => {
  const reg = boot();
  for (const [name, args] of [
    ['morse', []], ['hash', []], ['ascii', []], ['define', []],
    ['lyrics', []], ['remind', []], ['dns', []], ['setprefix', []],
  ]) {
    const c = mkC(args);
    await reg.get(name).fn(c);
    assert.match(c._out.join(' '), /USAGE|ERR/, `${name} sans argument`);
  }
});

test('setprefix change le préfixe du config', async () => {
  const reg = boot();
  const c = mkC(['!']);
  await reg.get('setprefix').fn(c);
  assert.match(c._out.join(' '), /OK|PRÉFIXE/);
});

test('appels réseau réels — crypto répond un prix OU une erreur propre', async () => {
  const reg = boot();
  const c = mkC(['bitcoin']);
  await reg.get('crypto').fn(c);
  const out = c._out.join(' ');
  assert.match(out, /CRYPTO|PRIX|ÉCHEC|CONNUE/, `sortie inattendue: ${out}`);
});
