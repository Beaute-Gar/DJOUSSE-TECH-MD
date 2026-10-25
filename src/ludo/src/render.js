'use strict';
/**
 * Rendu PNG du plateau + dé (via @napi-rs/canvas, aucune dépendance système).
 * Chaque image contient : en-tête (joueur + dé), plateau, pions numérotés,
 * coordonnées A-O / 1-15, coups possibles surlignés.
 */
const path = require('path');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const B = require('./board');
const cfg = require('./config');

const FONT = 'LudoFont';
try { GlobalFonts.registerFromPath(path.join(__dirname, '..', 'assets', cfg.render.fontFile), FONT); } catch (_) { /* police système en secours */ }
const font = (px) => `bold ${px}px "${FONT}", "DejaVu Sans", Arial, sans-serif`;

const cleanName = (n) => (String(n || 'Joueur').replace(/[^\p{L}\p{N} ._-]/gu, '').trim().slice(0, 18) || 'Joueur');

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function star(ctx, cx, cy, R, r, fill, stroke) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rad = i % 2 ? r : R;
    ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}

// ── Dé ──────────────────────────────────────────────────────────────────
const PIPS = {
  1: [[0.5, 0.5]],
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
  6: [[0.28, 0.24], [0.72, 0.24], [0.28, 0.5], [0.72, 0.5], [0.28, 0.76], [0.72, 0.76]],
};

function drawDie(ctx, x, y, size, value, colorKey) {
  const col = B.COLOR_INFO[colorKey] || B.COLOR_INFO.red;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
  roundRect(ctx, x, y, size, size, size * 0.18); ctx.fillStyle = '#FFFFFF'; ctx.fill();
  ctx.restore();
  roundRect(ctx, x, y, size, size, size * 0.18); ctx.lineWidth = 4; ctx.strokeStyle = col.hex; ctx.stroke();
  (PIPS[value] || []).forEach(([px, py]) => {
    ctx.beginPath(); ctx.arc(x + px * size, y + py * size, size * 0.085, 0, Math.PI * 2);
    ctx.fillStyle = value === 1 ? col.hex : '#1B1F3B'; ctx.fill();
  });
}

/** Image seule du dé (256 x 256). */
function renderDice(value, colorKey = 'red', size = 256) {
  const c = createCanvas(size, size), ctx = c.getContext('2d');
  const pad = size * 0.1;
  drawDie(ctx, pad, pad, size - pad * 2, value, colorKey);
  return c.toBuffer('image/png');
}

// ── Plateau ─────────────────────────────────────────────────────────────
/**
 * @param {object} state  état du moteur
 * @param {object} opts   { title, subtitle, showLegal }
 */
function renderBoard(state, opts = {}) {
  const { cell: C, margin: M, header: H } = cfg.render;
  const S = C * 15;
  const W = M + S + 12, Ht = H + M + S + 12;
  const cv = createCanvas(W, Ht), ctx = cv.getContext('2d');
  const ox = M, oy = H + M;                       // origine du plateau
  const px = (x) => ox + x * C, py = (y) => oy + y * C;

  // Fond + en-tête
  ctx.fillStyle = '#F4EFE4'; ctx.fillRect(0, 0, W, Ht);
  const grad = ctx.createLinearGradient(0, 0, W, 0); grad.addColorStop(0, '#141833'); grad.addColorStop(1, '#2A2F63');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

  const meIdx = opts.asPlayer != null ? opts.asPlayer : state.turn;
  const me = state.players[meIdx];
  const meCol = B.COLOR_INFO[me.color];
  const diceValue = opts.dice != null ? opts.dice : state.dice;

  ctx.fillStyle = '#FFFFFF'; ctx.font = font(24); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(`${cfg.brand.name} • ${cfg.brand.game}`, 20, 26);

  if (state.status === 'finished' && state.winner) {
    const wc = B.COLOR_INFO[state.winner.color];
    ctx.fillStyle = wc.hex; roundRect(ctx, 20, 52, 300, 46, 12); ctx.fill();
    ctx.fillStyle = state.winner.color === 'yellow' ? '#222' : '#FFF'; ctx.font = font(20);
    ctx.fillText(`VICTOIRE : ${cleanName(state.winner.name)}`, 34, 76);
  } else {
    ctx.fillStyle = meCol.hex; roundRect(ctx, 20, 52, 320, 46, 12); ctx.fill();
    ctx.fillStyle = me.color === 'yellow' ? '#222' : '#FFF'; ctx.font = font(20);
    ctx.fillText(`${meCol.fr} • ${cleanName(me.name)}`, 34, 76);
  }
  if (opts.subtitle) { ctx.fillStyle = '#C9CEF5'; ctx.font = font(15); ctx.fillText(opts.subtitle, 350, 76); }
  if (opts.title) { ctx.fillStyle = '#FFD54F'; ctx.font = font(15); ctx.textAlign = 'right'; ctx.fillText(opts.title, W - 130, 26); ctx.textAlign = 'left'; }
  if (diceValue) drawDie(ctx, W - 108, 14, 88, diceValue, me.color);

  // Coordonnées
  ctx.fillStyle = '#6B6F8D'; ctx.font = font(13); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i < 15; i++) {
    ctx.fillText('ABCDEFGHIJKLMNO'[i], px(i) + C / 2, oy - M / 2);
    ctx.fillText(String(i + 1), ox - M / 2, py(i) + C / 2);
  }

  // Écuries
  B.COLORS.forEach((c, i) => {
    const info = B.COLOR_INFO[c];
    const [bx, by] = [[0, 0], [9, 0], [9, 9], [0, 9]][i];
    ctx.fillStyle = info.hex; roundRect(ctx, px(bx), py(by), 6 * C, 6 * C, 14); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; roundRect(ctx, px(bx + 1), py(by + 1), 4 * C, 4 * C, 12); ctx.fill();
    B.YARD_SPOTS[c].forEach(([x, y]) => {
      ctx.beginPath(); ctx.arc(px(x), py(y), C * 0.42, 0, Math.PI * 2);
      ctx.fillStyle = info.light; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = info.hex; ctx.stroke();
    });
  });

  // Cases de piste
  ctx.lineWidth = 1;
  B.TRACK.forEach(([x, y], idx) => {
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(px(x), py(y), C, C);
    const owner = B.COLORS.find((c) => B.START_INDEX[c] === idx);
    if (owner) { ctx.fillStyle = B.COLOR_INFO[owner].hex; ctx.fillRect(px(x), py(y), C, C); }
    ctx.strokeStyle = '#9A9AAF'; ctx.strokeRect(px(x), py(y), C, C);
  });
  // Colonnes d'arrivée
  B.COLORS.forEach((c) => {
    B.HOME_COLUMN[c].forEach(([x, y]) => {
      ctx.fillStyle = B.COLOR_INFO[c].hex; ctx.globalAlpha = 0.85; ctx.fillRect(px(x - 0.5), py(y - 0.5), C, C); ctx.globalAlpha = 1;
      ctx.strokeStyle = '#FFFFFF'; ctx.strokeRect(px(x - 0.5), py(y - 0.5), C, C);
    });
  });
  // Centre
  const tri = [[[6, 6], [6, 9], [7.5, 7.5]], [[6, 6], [9, 6], [7.5, 7.5]], [[9, 6], [9, 9], [7.5, 7.5]], [[6, 9], [9, 9], [7.5, 7.5]]];
  const triCol = ['red', 'green', 'yellow', 'blue'];
  tri.forEach((t, i) => {
    ctx.beginPath(); t.forEach(([x, y], k) => ctx[k ? 'lineTo' : 'moveTo'](px(x), py(y))); ctx.closePath();
    ctx.fillStyle = B.COLOR_INFO[triCol[i]].hex; ctx.fill(); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2; ctx.stroke();
  });
  // Étoiles (cases sûres)
  B.SAFE.forEach((idx) => {
    const [x, y] = B.TRACK[idx];
    const isStart = B.COLORS.some((c) => B.START_INDEX[c] === idx);
    star(ctx, px(x) + C / 2, py(y) + C / 2, C * 0.32, C * 0.14, isStart ? '#FFFFFF' : '#FFB300', '#7A5A00');
  });

  // ── Pions ───────────────────────────────────────────────────────────
  const tokens = [];
  state.players.forEach((p, pi) => {
    if (!p.active) return;
    p.pawns.forEach((pr, i) => tokens.push({ p, pi, i, pr, pos: B.centerOf(p.color, pr, i) }));
  });
  // regroupement par case pour décaler les pions empilés
  const groups = new Map();
  tokens.forEach((t) => {
    if (t.pr === B.YARD || t.pr === B.HOME) { t.off = [0, 0]; t.scale = 1; return; }
    const k = t.pos.join(',');
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(t);
  });
  groups.forEach((arr) => {
    const n = arr.length;
    const offs = n === 1 ? [[0, 0]] : n === 2 ? [[-0.2, 0], [0.2, 0]] : [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]];
    arr.forEach((t, k) => { t.off = offs[k % offs.length]; t.scale = n === 1 ? 1 : 0.72; });
  });

  const legalPawns = new Set();
  const showLegal = opts.showLegal !== false && state.phase === 'move' && state.status === 'playing' && meIdx === state.turn;
  if (showLegal) {
    // cibles : anneau pointillé + pion fantôme numéroté
    state.legal.forEach((m) => {
      legalPawns.add(m.pawn);
      const [tx, ty] = B.centerOf(me.color, m.to, m.pawn);
      const [fx, fy] = B.centerOf(me.color, m.from, m.pawn);
      ctx.save();
      ctx.strokeStyle = '#FFB300'; ctx.lineWidth = 3; ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.moveTo(px(fx), py(fy)); ctx.lineTo(px(tx), py(ty)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(px(tx), py(ty), C * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,179,0,0.28)'; ctx.fill(); ctx.strokeStyle = '#FFB300'; ctx.lineWidth = 3; ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#7A5A00'; ctx.font = font(13); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`→${m.pawn + 1}`, px(tx), py(ty) - C * 0.32 - 2);
    });
  }

  tokens.forEach((t) => {
    const info = B.COLOR_INFO[t.p.color];
    const cx = px(t.pos[0] + t.off[0]), cy = py(t.pos[1] + t.off[1]);
    const r = C * 0.36 * t.scale;
    const mine = t.pi === meIdx;
    if (mine && legalPawns.has(t.i)) {
      ctx.beginPath(); ctx.arc(cx, cy, r + 6, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,179,0,0.55)'; ctx.fill();
    }
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = info.hex; ctx.fill(); ctx.restore();
    ctx.lineWidth = mine ? 3.5 : 2.5; ctx.strokeStyle = mine ? '#FFFFFF' : '#1B1F3B'; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.lineWidth = 1.2; ctx.strokeStyle = mine ? '#1B1F3B' : '#FFFFFF'; ctx.stroke();
    ctx.fillStyle = t.p.color === 'yellow' ? '#222' : '#FFF';
    ctx.font = font(Math.round(C * 0.4 * t.scale)); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(t.i + 1), cx, cy + 1);
  });

  // Pied de page
  ctx.fillStyle = '#8A8FB0'; ctx.font = font(11); ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(cfg.brand.footer, W - 10, Ht - 3);

  return cv.toBuffer('image/png');
}

module.exports = { renderBoard, renderDice, cleanName };
