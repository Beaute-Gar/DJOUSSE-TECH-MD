'use strict';
const assert = require('assert');
const { createLudo } = require('../src');

function makeIO(log) {
  return {
    text: async (t, m = []) => { log.push({ kind: 'text', t, m }); },
    image: async (b, c, m = []) => { assert(Buffer.isBuffer(b) && b.length > 2000, 'image vide'); log.push({ kind: 'image', c, m, size: b.length }); },
  };
}
const U = (n) => ({ id: `23769000000${n}@s.whatsapp.net`, name: 'Joueur' + n });

(async () => {
  // ── Partie complète pilotée par le gestionnaire ────────────────────
  const log = []; const io = makeIO(log);
  const L = createLudo({ turnTimeoutMs: 60000 });
  const chat = 'groupe@g.us';
  const call = (u, cmd, args = [], admin = false) => L.handle({ chatId: chat, sender: u, isAdmin: admin, cmd, args, io });

  await call(U(1), 'ludo', ['creer']);
  await call(U(1), 'ludo', ['creer']);                  // doublon refusé
  await call(U(2), 'ludo', ['rejoindre']);
  await call(U(2), 'ludo', ['rejoindre']);              // déjà dedans
  await call(U(3), 'ludo', ['start']);                  // pas l'organisateur
  await call(U(1), 'ludo', ['start']);
  const room = L.rooms.get(chat);
  assert.strictEqual(room.status, 'playing');
  assert.strictEqual(room.state.players.length, 2);

  await call(U(3), 'de');                               // pas joueur
  const other = room.state.turn === 0 ? U(2) : U(1);
  await call(other, 'de');                              // pas son tour

  let guard = 0;
  while (L.rooms.has(chat)) {
    if (++guard > 5000) throw new Error('trop long');
    const st = L.rooms.get(chat).state;
    const u = [U(1), U(2)][st.turn];
    if (st.phase === 'roll') await call(u, 'de');
    else { const m = st.legal[Math.floor(Math.random() * st.legal.length)]; await call(u, 'pion', [String(m.pawn + 1)]); }
  }
  const imgs = log.filter((l) => l.kind === 'image');
  const last = log[log.length - 1];
  assert(last.kind === 'image' && /PARTIE TERMIN/.test(last.c), 'podium final attendu');
  assert(imgs.some((i) => /a lancé un \*\d\*/.test(i.c) && /📍 \*Tes pions/.test(i.c)), 'la légende du lancer contient les positions');
  console.log(`✔ partie complète : ${log.length} messages, ${imgs.length} images`);

  // ── Position visible à chaque lancer ────────────────────────────────
  const withPos = imgs.filter((i) => /a lancé un/.test(i.c));
  assert(withPos.every((i) => /🏠|📍|🎯|🏁/.test(i.c)), 'chaque lancer affiche les positions');
  console.log(`✔ ${withPos.length} lancers, tous avec position des pions`);

  // ── Minuteur : tour sauté puis exclusion ─────────────────────────────
  const log2 = []; const io2 = makeIO(log2);
  const L2 = createLudo({ turnTimeoutMs: 40, maxTimeoutsBeforeKick: 2 });
  const c2 = { chatId: 'g2@g.us', isAdmin: false, io: io2 };
  await L2.handle({ ...c2, sender: U(1), cmd: 'ludo', args: ['creer'] });
  await L2.handle({ ...c2, sender: U(2), cmd: 'ludo', args: ['rejoindre'] });
  await L2.handle({ ...c2, sender: U(1), cmd: 'ludo', args: ['start'] });
  await new Promise((r) => setTimeout(r, 400));
  const texts = log2.map((l) => l.t || l.c).join('\n');
  assert(/laissé passer son tour/.test(texts), 'tour sauté');
  assert(/retiré de la partie/.test(texts) || !L2.rooms.has('g2@g.us'), 'exclusion ou fin de partie');
  console.log('✔ minuteur : tour sauté / exclusion / fin de partie');

  // ── Abandon d'un joueur => victoire de l'autre ───────────────────────
  const log3 = []; const io3 = makeIO(log3);
  const L3 = createLudo();
  const c3 = { chatId: 'g3@g.us', isAdmin: false, io: io3 };
  await L3.handle({ ...c3, sender: U(1), cmd: 'ludo', args: ['creer'] });
  await L3.handle({ ...c3, sender: U(2), cmd: 'ludo', args: ['rejoindre'] });
  await L3.handle({ ...c3, sender: U(1), cmd: 'ludo', args: ['start'] });
  await L3.handle({ ...c3, sender: U(2), cmd: 'ludo', args: ['quitter'] });
  assert(!L3.rooms.has('g3@g.us') && /PARTIE TERMIN/.test(log3[log3.length - 1].c));
  // commandes de consultation
  await L3.handle({ ...c3, sender: U(1), cmd: 'ludo', args: ['plateau'] });
  await L3.handle({ ...c3, sender: U(1), cmd: 'ludo', args: ['regles'] });
  console.log('✔ abandon => fin de partie');

  // pos / plateau pendant une partie
  const log4 = []; const io4 = makeIO(log4); const L4 = createLudo({ turnTimeoutMs: 60000 });
  const c4 = { chatId: 'g4@g.us', isAdmin: false, io: io4 };
  await L4.handle({ ...c4, sender: U(1), cmd: 'ludo', args: ['creer'] });
  await L4.handle({ ...c4, sender: U(2), cmd: 'ludo', args: ['rejoindre'] });
  await L4.handle({ ...c4, sender: U(3), cmd: 'ludo', args: ['rejoindre'] });
  await L4.handle({ ...c4, sender: U(1), cmd: 'ludo', args: ['start'] });
  await L4.handle({ ...c4, sender: U(2), cmd: 'ludo', args: ['pos'] });
  await L4.handle({ ...c4, sender: U(2), cmd: 'ludo', args: ['plateau'] });
  assert(log4.some((l) => l.kind === 'image' && /Position de/.test(l.c)));
  assert(log4.some((l) => l.kind === 'image' && /Plateau • tour/.test(l.c)));
  L4._destroy(L4.rooms.get('g4@g.us'));
  console.log('✔ .ludo pos / .ludo plateau OK');

  // ── Mode solo : la partie démarre sans salon, le robot joue seul ──────
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const log5 = []; const io5 = makeIO(log5);
  const L5 = createLudo({ turnTimeoutMs: 60000, solo: { delayMs: 30, name: 'Robot' } });
  const c5 = { chatId: 'g5@g.us', isAdmin: false, io: io5 };
  const call5 = (u, cmd, args = []) => L5.handle({ ...c5, sender: u, cmd, args, io: io5 });

  await call5(U(1), 'ludo', ['solo']);
  const room5 = L5.rooms.get('g5@g.us');
  assert(room5 && room5.status === 'playing', 'le mode solo démarre immédiatement (pas de salon)');
  assert.strictEqual(room5.state.players.length, 2);
  assert.strictEqual(room5.state.players[1].bot, true, 'le deuxième joueur est le robot');
  assert(log5.some((l) => /MODE SOLO/.test(l.t || '')), 'message d\'annonce du mode solo');

  const robotPlayed = () => log5.some((l) => /@robot/.test(l.t || l.c || '') && /a lancé|avance|sort le pion/.test(l.t || l.c || ''));
  const t0 = Date.now();
  while (L5.rooms.has('g5@g.us') && !robotPlayed() && Date.now() - t0 < 30000) {
    const st = L5.rooms.get('g5@g.us').state;
    if (st.turn === 0) {                     // tour de l'humain : on joue pour lui
      if (st.phase === 'roll') await call5(U(1), 'de');
      else await call5(U(1), 'pion', [String(st.legal[0].pawn + 1)]);
    }
    await sleep(40);                         // laisse le robot jouer (30 ms)
  }
  assert(robotPlayed(), 'le robot doit jouer son tour sans intervention');
  const botRoll = log5.find((l) => l.kind === 'image' && /@robot/.test(l.c) && /a lancé/.test(l.c));
  assert(botRoll, 'image du lancer du robot attendue');
  assert(!botRoll.m.some((j) => /robot/.test(j)), 'le robot ne doit jamais être mentionné');
  L5._destroy(L5.rooms.get('g5@g.us'));
  console.log('✔ mode solo : démarre tout de suite, le robot joue seul');

  process.exit(0);
})().catch((e) => { console.error('✘', e); process.exit(1); });
