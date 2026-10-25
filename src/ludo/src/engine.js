'use strict';
/**
 * Moteur de règles LUDO — pur (aucune dépendance WhatsApp / image).
 * Réutilisable pour WhatsApp, Telegram, web, etc.
 */
const B = require('./board');
const defaults = require('./config').rules;

const PAWNS = 4;

function colorsFor(n) {
  if (n === 2) return ['red', 'yellow'];          // adversaires face à face
  if (n === 3) return ['red', 'green', 'yellow'];
  return ['red', 'green', 'yellow', 'blue'];
}

/** players: [{id, name}] (2 à 4). */
function createGame(players, rules = {}) {
  if (players.length < 2 || players.length > 4) throw new Error('2 à 4 joueurs');
  const cols = colorsFor(players.length);
  return {
    rules: { ...defaults, ...rules },
    players: players.map((p, i) => ({
      id: p.id, name: p.name, color: cols[i], bot: !!p.bot,
      pawns: new Array(PAWNS).fill(B.YARD),
      rank: null, active: true, timeouts: 0,
    })),
    turn: 0,
    phase: 'roll',          // 'roll' | 'move'
    dice: null,
    legal: [],
    sixes: 0,
    finished: [],           // indices des joueurs, dans l'ordre d'arrivée
    status: 'playing',      // 'playing' | 'finished'
    winner: null,
    turnNo: 1,
  };
}

const current = (s) => s.players[s.turn];

// ── Utilitaires de position ─────────────────────────────────────────────
function absOf(player, progress) { return B.absIndex(player.color, progress); }

/** Barrage adverse sur une case de piste ? (2 pions ou plus du même adversaire) */
function blockAt(state, me, abs) {
  if (!state.rules.blocks) return false;
  for (const q of state.players) {
    if (q === me || !q.active) continue;
    let n = 0;
    for (const pr of q.pawns) if (absOf(q, pr) === abs) n++;
    if (n >= 2) return true;
  }
  return false;
}

function capturesAt(state, me, to) {
  if (to > B.LAST_TRACK) return [];
  const abs = absOf(me, to);
  if (B.SAFE.has(abs)) return [];
  const out = [];
  state.players.forEach((q, qi) => {
    if (q === me || !q.active) return;
    q.pawns.forEach((pr, j) => { if (absOf(q, pr) === abs) out.push({ player: qi, pawn: j }); });
  });
  return out;
}

function pathBlocked(state, me, from, to) {
  if (!state.rules.blocks) return false;
  for (let s = Math.max(from + 1, 0); s <= Math.min(to, B.LAST_TRACK); s++) {
    if (blockAt(state, me, absOf(me, s))) return true;
  }
  return false;
}

/** Coups légaux du joueur `me` pour la valeur `v`. */
function legalMoves(state, me, v) {
  const moves = [];
  me.pawns.forEach((from, i) => {
    let to;
    if (from === B.YARD) {
      if (!state.rules.startRolls.includes(v)) return;
      to = 0;
    } else if (from === B.HOME) {
      return;
    } else {
      to = from + v;
      if (to > B.HOME) return;                 // arrivée : lancer exact obligatoire
    }
    if (pathBlocked(state, me, from, to)) return;
    moves.push({
      pawn: i, from, to,
      enter: from === B.YARD,
      home: to === B.HOME,
      captured: capturesAt(state, me, to),
    });
  });
  return moves;
}

// ── Choix automatique (mode solo : le robot joue son tour) ──────────────
/** Case sûre = colonne d'arrivée, case ⭐ ou case de départ. */
const isSafeTo = (me, to) => to > B.LAST_TRACK || B.SAFE.has(absOf(me, to));

/** Combien d'ennemis peuvent capturer la case `abs` au prochain lancer ? */
function threatsAt(state, me, abs) {
  let n = 0;
  for (const q of state.players) {
    if (q === me || !q.active) continue;
    for (const pr of q.pawns) {
      if (pr < 0 || pr > B.LAST_TRACK) continue;
      const d = (abs - absOf(q, pr) + B.TRACK_LEN) % B.TRACK_LEN;
      if (d >= 1 && d <= 6) n++;
    }
  }
  return n;
}

/**
 * Coup que choisit le robot. Priorités : capture > arrivée > sortir de l'écurie >
 * avancer (case sûre > case exposée). Retourne l'index du pion, -1 sinon.
 */
function bestMove(state) {
  const list = state.legal || [];
  if (!list.length) return -1;
  const me = current(state);
  let best = list[0], bestScore = -Infinity;
  for (const m of list) {
    const safe = isSafeTo(me, m.to);
    const threats = safe ? 0 : threatsAt(state, me, absOf(me, m.to));
    let s;
    if (m.captured.length) s = 10000 + m.captured.length * 500;
    else if (m.home) s = 9000;
    else if (m.enter) s = 7000;
    else s = 1000 + m.to * 20 + (safe ? 250 : 0);
    s -= threats * 250;
    if (s > bestScore) { bestScore = s; best = m; }
  }
  return best.pawn;
}

// ── Enchaînement des tours ──────────────────────────────────────────────
function remaining(state) {
  return state.players.filter((p) => p.active && p.rank === null);
}

function nextTurn(state) {
  state.sixes = 0;
  state.dice = null;
  state.legal = [];
  state.phase = 'roll';
  for (let k = 1; k <= state.players.length; k++) {
    const idx = (state.turn + k) % state.players.length;
    const p = state.players[idx];
    if (p.active && p.rank === null) { state.turn = idx; state.turnNo++; return; }
  }
}

function checkEnd(state) {
  const left = remaining(state);
  const ranked = state.finished.length;
  const over = state.rules.fullRanking ? left.length <= 1 : ranked >= 1 || left.length <= 1;
  if (!over) return false;
  if (left.length === 1 && left[0].rank === null && state.rules.fullRanking) {
    left[0].rank = ranked + 1;
    state.finished.push(state.players.indexOf(left[0]));
  }
  if (state.finished.length === 0 && left.length === 1) {
    // tous les autres ont abandonné
    left[0].rank = 1; state.finished.push(state.players.indexOf(left[0]));
  }
  state.status = 'finished';
  state.winner = state.players[state.finished[0]] || null;
  return true;
}

// ── Actions ─────────────────────────────────────────────────────────────
function roll(state, rng = Math.random) {
  if (state.status !== 'playing') throw new Error('partie terminée');
  if (state.phase !== 'roll') throw new Error('il faut d\'abord jouer un pion');
  const me = current(state);
  const value = 1 + Math.floor(rng() * 6);
  state.dice = value;
  state.sixes = value === 6 ? state.sixes + 1 : 0;
  const res = { player: state.turn, value, legal: [], penalty: false, passed: false, extra: false };

  const max = state.rules.maxSixesInRow;
  if (value === 6 && max && state.sixes >= max) {
    res.penalty = true; res.passed = true;
    const keep = state.dice; nextTurn(state); state.dice = keep; // le dé reste visible pour l'image
    return res;
  }

  const legal = legalMoves(state, me, value);
  state.legal = legal;
  res.legal = legal;
  if (legal.length === 0) {
    res.passed = true;
    if (value === 6 && state.rules.extraOnSix) { res.extra = true; state.phase = 'roll'; }
    else { const keep = state.dice; nextTurn(state); state.dice = keep; }
    return res;
  }
  state.phase = 'move';
  return res;
}

function move(state, pawnIdx) {
  if (state.status !== 'playing') throw new Error('partie terminée');
  if (state.phase !== 'move') throw new Error('lance d\'abord le dé');
  const me = current(state);
  const m = state.legal.find((l) => l.pawn === pawnIdx);
  if (!m) throw new Error('coup illégal');
  const value = state.dice;

  me.pawns[pawnIdx] = m.to;
  m.captured.forEach((c) => { state.players[c.player].pawns[c.pawn] = B.YARD; });

  const res = { player: state.turn, pawn: pawnIdx, from: m.from, to: m.to, value,
    captured: m.captured, home: m.home, enter: m.enter, extra: false, finishedPlayer: false, ended: false };

  if (me.pawns.every((p) => p === B.HOME)) {
    me.rank = state.finished.length + 1;
    state.finished.push(state.turn);
    res.finishedPlayer = true;
  }

  const r = state.rules;
  const wantsExtra = (value === 6 && r.extraOnSix) || (m.captured.length && r.extraOnCapture) || (m.home && r.extraOnHome);

  if (checkEnd(state)) { res.ended = true; state.legal = []; state.phase = 'roll'; return res; }

  if (wantsExtra && me.rank === null) {
    res.extra = true; state.phase = 'roll'; state.legal = []; state.dice = null;
  } else {
    nextTurn(state);
  }
  return res;
}

/** Saute le tour du joueur courant (délai dépassé). */
function skipTurn(state) {
  const me = current(state);
  me.timeouts++;
  nextTurn(state);
}

/** Retire un joueur (abandon / exclusion). Retourne true si la partie est terminée. */
function removePlayer(state, index) {
  const p = state.players[index];
  if (!p || !p.active) return state.status === 'finished';
  p.active = false;
  p.pawns = p.pawns.map(() => B.YARD);
  const wasTurn = state.turn === index;
  if (checkEnd(state)) return true;
  if (wasTurn) nextTurn(state);
  return false;
}

// ── Description des positions ───────────────────────────────────────────
function describePawn(player, i) {
  const pr = player.pawns[i];
  if (pr === B.YARD) return { kind: 'yard', progress: -1, left: B.HOME, coord: 'écurie' };
  if (pr === B.HOME) return { kind: 'home', progress: B.HOME, left: 0, coord: 'arrivée' };
  return {
    kind: pr > B.LAST_TRACK ? 'column' : 'track',
    progress: pr, left: B.HOME - pr, coord: B.coordLabel(player.color, pr),
    safe: pr <= B.LAST_TRACK && B.SAFE.has(absOf(player, pr)),
  };
}

module.exports = {
  createGame, roll, move, skipTurn, removePlayer, legalMoves, describePawn, bestMove,
  current, remaining, colorsFor, PAWNS,
};
