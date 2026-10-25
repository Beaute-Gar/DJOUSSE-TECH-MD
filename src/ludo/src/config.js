'use strict';
/**
 * DJOUSSE TECH • LUDO — configuration centrale.
 * Tout ce qu'on peut vouloir régler se trouve ici (aucun réglage dispersé ailleurs).
 */
module.exports = {
  brand: {
    name: 'DJOUSSE TECH',
    game: 'LUDO',
    footer: 'DJOUSSE TECH EVOLUTION',
  },

  // ── Règles ────────────────────────────────────────────────────────────
  rules: {
    startRolls: [6],        // valeurs du dé qui permettent de sortir un pion de l'écurie
    extraOnSix: true,       // un 6 donne un nouveau lancer
    extraOnCapture: true,   // capturer un pion adverse donne un nouveau lancer
    extraOnHome: true,      // amener un pion à l'arrivée donne un nouveau lancer
    maxSixesInRow: 3,       // le 3e six d'affilée annule le tour (0 = désactivé)
    blocks: false,          // 2 pions du même joueur sur une case = barrage infranchissable
    fullRanking: false,     // true = on continue après le 1er vainqueur pour classer tout le monde
  },

  // ── Parties ───────────────────────────────────────────────────────────
  minPlayers: 2,
  maxPlayers: 4,
  turnTimeoutMs: 90 * 1000,        // temps max pour lancer / jouer avant de sauter le tour
  lobbyTimeoutMs: 10 * 60 * 1000,  // un salon d'attente sans démarrage est fermé après ce délai
  maxTimeoutsBeforeKick: 3,        // nb de tours ratés d'affilée avant exclusion
  autoSingleMove: true,            // s'il n'y a qu'un seul coup possible, il est joué automatiquement
  imageAfterMove: false,           // renvoyer aussi le plateau après chaque déplacement

  // ── Mode solo : jouer sans attendre un deuxième joueur ─────────────────
  solo: {
    delayMs: 1200,                 // temps de « réflexion » du robot entre ses actions
    name: 'Robot',                 // nom affiché (mentionnée @robot dans les messages)
  },

  // ── Rendu des images ──────────────────────────────────────────────────
  render: {
    cell: 46,          // taille d'une case en pixels
    margin: 28,        // marge des coordonnées (A-O / 1-15)
    header: 118,       // hauteur de l'en-tête (joueur + dé)
    fontFile: 'DejaVuSans-Bold.ttf',
  },
};
