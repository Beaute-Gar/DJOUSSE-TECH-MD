const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');

const DARES = [
  "Envoie un vocal en chantant pendant 15 secondes.",
  "Change ta photo de profil pour un emoji au hasard pendant 1 heure.",
  "Écris ton prochain message uniquement en emojis.",
  "Raconte la dernière chose embarrassante qui t'est arrivée.",
  "Envoie le 3ème selfie de ta galerie sans le regarder avant.",
  "Imite ton animal préféré dans un vocal.",
  "Complimente les 3 dernières personnes qui ont écrit dans ce chat.",
  "Décris ta journée en seulement 5 mots.",
  "Envoie l'écran d'accueil de ton téléphone.",
  "Dis un secret inoffensif que peu de gens connaissent sur toi.",
];

cmd({ pattern: 'dare', alias: ['action', 'gage'], react: '🎯', desc: 'Action au hasard (jeu action/vérité)', category: 'game', filename: __filename }, async (conn, m, commands, { reply }) => {
  const dare = DARES[Math.floor(Math.random() * DARES.length)];
  reply(box('🎯 *ACTION*', [
    { raw: dare },
    { blank: true },
    { raw: '_Tape .truth pour une question à la place_' },
  ]));
});
