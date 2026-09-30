'use strict';
/**
 * Géométrie du plateau LUDO (grille 15 x 15).
 *  - Piste commune : 52 cases, sens horaire.
 *  - Chaque couleur démarre 13 cases après la précédente.
 *  - Progression d'un pion :  -1 = écurie | 0..50 = piste | 51..55 = colonne d'arrivée | 56 = arrivé.
 *    (56 étapes du départ à l'arrivée)
 */

const COLORS = ['red', 'green', 'yellow', 'blue']; // sens horaire : haut-gauche, haut-droite, bas-droite, bas-gauche

const COLOR_INFO = {
  red:    { fr: 'Rouge', emoji: '🔴', hex: '#E53935', light: '#FFCDD2', dark: '#B71C1C' },
  green:  { fr: 'Vert',  emoji: '🟢', hex: '#43A047', light: '#C8E6C9', dark: '#1B5E20' },
  yellow: { fr: 'Jaune', emoji: '🟡', hex: '#FDD835', light: '#FFF9C4', dark: '#F9A825' },
  blue:   { fr: 'Bleu',  emoji: '🔵', hex: '#1E88E5', light: '#BBDEFB', dark: '#0D47A1' },
};

const TRACK_LEN = 52;
const LAST_TRACK = 50;   // dernière étape sur la piste commune
const HOME = 56;         // étape finale
const YARD = -1;

// Piste commune, à partir de la case de départ du Rouge.
const TRACK = (() => {
  const s = [];
  const p = (x, y) => s.push([x, y]);
  for (let x = 1; x <= 5; x++) p(x, 6);
  for (let y = 5; y >= 0; y--) p(6, y);
  p(7, 0); p(8, 0);
  for (let y = 1; y <= 5; y++) p(8, y);
  for (let x = 9; x <= 14; x++) p(x, 6);
  p(14, 7); p(14, 8);
  for (let x = 13; x >= 9; x--) p(x, 8);
  for (let y = 9; y <= 14; y++) p(8, y);
  p(7, 14); p(6, 14);
  for (let y = 13; y >= 9; y--) p(6, y);
  for (let x = 5; x >= 0; x--) p(x, 8);
  p(0, 7); p(0, 6);
  if (s.length !== TRACK_LEN) throw new Error('Piste invalide : ' + s.length);
  return s;
})();

// Rotation de 90° (sens horaire) autour du centre — coordonnées continues (0..15).
const rot = (x, y, times) => {
  let px = x, py = y;
  for (let i = 0; i < ((times % 4) + 4) % 4; i++) { const nx = 15 - py; py = px; px = nx; }
  return [px, py];
};

const START_INDEX = COLORS.reduce((o, c, i) => { o[c] = i * 13; return o; }, {});

// Cases sûres : les 4 cases de départ + 4 étoiles (8 cases après chaque départ).
const SAFE = new Set();
COLORS.forEach((c) => { SAFE.add(START_INDEX[c]); SAFE.add((START_INDEX[c] + 8) % TRACK_LEN); });
const STAR_CELLS = [...SAFE].filter((i) => !COLORS.some((c) => START_INDEX[c] === i));

// Colonne d'arrivée de chaque couleur (centres de cases, coordonnées continues).
const HOME_COLUMN = {};
COLORS.forEach((c, i) => {
  HOME_COLUMN[c] = [1, 2, 3, 4, 5].map((x) => rot(x + 0.5, 7.5, i));
});

// Emplacements dans l'écurie.
const YARD_SPOTS = {};
COLORS.forEach((c, i) => {
  YARD_SPOTS[c] = [[2, 2], [4, 2], [2, 4], [4, 4]].map(([x, y]) => rot(x, y, i));
});

// Emplacements des pions arrivés (dans le triangle de la couleur au centre).
const HOME_SPOTS = {};
COLORS.forEach((c, i) => {
  HOME_SPOTS[c] = [0, 1, 2, 3].map((k) => rot(6.62, 7.5 + (k - 1.5) * 0.3, i));
});

/** Index absolu (0..51) sur la piste pour un pion de progression 0..50, ou null sinon. */
function absIndex(color, progress) {
  if (progress < 0 || progress > LAST_TRACK) return null;
  return (START_INDEX[color] + progress) % TRACK_LEN;
}

/** Centre (coordonnées continues) d'un pion d'après sa progression. */
function centerOf(color, progress, pawnIdx = 0) {
  if (progress === YARD) return YARD_SPOTS[color][pawnIdx];
  if (progress === HOME) return HOME_SPOTS[color][pawnIdx];
  if (progress > LAST_TRACK) return HOME_COLUMN[color][progress - 51];
  const [x, y] = TRACK[absIndex(color, progress)];
  return [x + 0.5, y + 0.5];
}

/** Coordonnée lisible façon échiquier : colonnes A-O, lignes 1-15. */
function coordLabel(color, progress) {
  if (progress === YARD) return 'écurie';
  if (progress === HOME) return 'arrivée';
  const [cx, cy] = centerOf(color, progress);
  return 'ABCDEFGHIJKLMNO'[Math.floor(cx)] + (Math.floor(cy) + 1);
}

module.exports = {
  COLORS, COLOR_INFO, TRACK, TRACK_LEN, LAST_TRACK, HOME, YARD,
  START_INDEX, SAFE, STAR_CELLS, HOME_COLUMN, YARD_SPOTS, HOME_SPOTS,
  absIndex, centerOf, coordLabel, rot,
};
