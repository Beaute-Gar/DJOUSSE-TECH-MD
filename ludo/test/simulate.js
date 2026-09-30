'use strict';
const assert = require('assert');
const E = require('../src/engine');
const B = require('../src/board');

// RNG déterministe
function lcg(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function play(n, rules, seed) {
  const rng = lcg(seed);
  const g = E.createGame(Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i })), rules);
  let steps = 0, captures = 0;
  while (g.status === 'playing') {
    if (++steps > 20000) throw new Error('boucle infinie seed ' + seed);
    if (g.phase === 'roll') { E.roll(g, rng); }
    else {
      const m = g.legal[Math.floor(rng() * g.legal.length)];
      const r = E.move(g, m.pawn); captures += r.captured.length;
    }
    // invariants
    g.players.forEach((p) => p.pawns.forEach((x) => assert(x >= -1 && x <= 56, 'position hors limites ' + x)));
    if (g.phase === 'move') assert(g.legal.length > 0);
  }
  assert(g.winner, 'pas de vainqueur');
  assert(g.winner.pawns.every((x) => x === 56), 'le vainqueur n\'a pas tout ramené');
  return { steps, captures };
}

let games = 0, totalCaps = 0;
for (const n of [2, 3, 4])
  for (const rules of [{}, { blocks: true }, { fullRanking: true }, { blocks: true, fullRanking: true, maxSixesInRow: 0 }])
    for (let seed = 1; seed <= 60; seed++) { const r = play(n, rules, seed * 7 + n); games++; totalCaps += r.captures; }
console.log(`✔ ${games} parties simulées sans erreur (${totalCaps} captures au total)`);

// ── Tests ciblés ────────────────────────────────────────────────────────
const fixed = (v) => () => (v - 0.5) / 6; // rng qui donne toujours v

function mk(n = 2, rules = {}) { return E.createGame(Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i })), rules); }

// 1. Sortie de l'écurie : seulement avec un 6
{
  const g = mk(); const r = E.roll(g, fixed(3));
  assert(r.passed && r.legal.length === 0 && g.turn === 1, 'sans 6, tour passé');
  const g2 = mk(); const r2 = E.roll(g2, fixed(6));
  assert.strictEqual(r2.legal.length, 4); assert.strictEqual(r2.legal[0].to, 0);
}
// 2. Un 6 redonne la main
{
  const g = mk(); E.roll(g, fixed(6)); const m = E.move(g, 0);
  assert(m.extra && g.turn === 0 && g.phase === 'roll');
}
// 3. Trois 6 d'affilée => tour perdu
{
  const g = mk(); E.roll(g, fixed(6)); E.move(g, 0); E.roll(g, fixed(6)); E.move(g, 0);
  const r = E.roll(g, fixed(6)); assert(r.penalty && g.turn === 1, '3e six annule le tour');
}
// 4. Capture (rouge p0 vs jaune p1) : le jaune démarre à l'index 26 ; on place les pions à la main
{
  const g = mk(); const red = g.players[0], yel = g.players[1];
  yel.pawns[0] = 3;               // index absolu 29
  red.pawns[0] = 26 + 0 - 0;      // rouge progression 26 -> index 26 (case de départ jaune = sûre)
  red.pawns[1] = 28;              // index 28 ; +1 => 29 capture
  g.phase = 'roll';
  const r = E.roll(g, fixed(1));
  const cap = r.legal.find((l) => l.pawn === 1);
  assert.strictEqual(cap.captured.length, 1, 'capture attendue en 29');
  const safe = r.legal.find((l) => l.pawn === 0);
  assert.strictEqual(safe.captured.length, 0);
  const res = E.move(g, 1); assert(res.extra && yel.pawns[0] === -1, 'pion capturé renvoyé à l\'écurie');
}
// 5. Case sûre : pas de capture
{
  const g = mk(); const red = g.players[0], yel = g.players[1];
  yel.pawns[0] = 0;               // jaune sur SA case de départ (index 26, sûre)
  red.pawns[0] = 25;              // rouge à l'index 25 ; +1 => 26
  const r = E.roll(g, fixed(1));
  assert.strictEqual(r.legal.find((l) => l.pawn === 0).captured.length, 0, 'case de départ = sûre');
}
// 6. Arrivée : lancer exact
{
  const g = mk(); g.players[0].pawns = [54, -1, -1, -1];
  let r = E.roll(g, fixed(3)); assert(r.passed, '54+3=57 impossible');
  const g2 = mk(); g2.players[0].pawns = [54, -1, -1, -1];
  r = E.roll(g2, fixed(2)); assert.strictEqual(r.legal[0].to, 56);
  const m = E.move(g2, 0); assert(m.home && m.extra);
}
// 7. Barrage
{
  const g = mk(2, { blocks: true }); const red = g.players[0], yel = g.players[1];
  yel.pawns[0] = 0; yel.pawns[1] = 0;      // barrage jaune en index 26 (départ, mais barrage compte)
  red.pawns[0] = 24;                        // 24 + 3 traverse 26
  const r = E.roll(g, fixed(3));
  assert(!r.legal.some((l) => l.pawn === 0), 'barrage adverse infranchissable');
}
// 8. Victoire
{
  const g = mk(); g.players[0].pawns = [56, 56, 56, 55];
  E.roll(g, fixed(1)); const m = E.move(g, 3);
  assert(m.ended && g.winner === g.players[0] && g.status === 'finished');
}
// 9. Abandon => victoire de l'autre
{
  const g = mk(); assert(E.removePlayer(g, 0) === true && g.winner === g.players[1]);
}
// 10. Mode solo : le robot choisit ses coups (bestMove) et termine la partie
{
  const rng = lcg(2024);
  for (const n of [2, 3, 4]) {
    const g = E.createGame(Array.from({ length: n }, (_, i) => ({ id: 'bot' + i, name: 'B' + i, bot: true })), {});
    let steps = 0;
    while (g.status === 'playing') {
      if (++steps > 50000) throw new Error('partie solo interminable (' + n + ' joueurs)');
      if (g.phase === 'roll') E.roll(g, rng);
      else {
        const idx = E.bestMove(g);
        assert(idx >= 0, 'bestMove doit proposer un coup en phase move');
        E.move(g, idx);
      }
    }
    assert(g.winner && g.winner.pawns.every((x) => x === B.HOME), 'vainqueur solo invalide');
  }
}
// 11. bestMove sans coup possible
{
  const g = mk(); g.phase = 'move'; g.legal = [];
  assert.strictEqual(E.bestMove(g), -1);
}
console.log('✔ tests de règles OK (dont mode solo)');
