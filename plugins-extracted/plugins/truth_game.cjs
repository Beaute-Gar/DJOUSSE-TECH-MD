const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');

const TRUTHS = [
  "Quelle est la chose la plus étrange que tu aies mangée ?",
  "Quel est ton plus grand regret cette année ?",
  "Quelle appli utilises-tu le plus sur ton téléphone ?",
  "As-tu déjà menti pour éviter une sortie ?",
  "Quelle est la dernière chose que tu as googlée ?",
  "Quel est ton talent caché que peu de gens connaissent ?",
  "Quelle série ou film as-tu revu le plus de fois ?",
  "Quelle est la pire excuse que tu aies donnée pour arriver en retard ?",
  "Si tu pouvais changer une chose sur toi, ce serait quoi ?",
  "Quel est ton plus grand kif du moment ?",
];

cmd({ pattern: 'truth', alias: ['verite'], react: '❓', desc: 'Question au hasard (jeu action/vérité)', category: 'game', filename: __filename }, async (conn, m, commands, { reply }) => {
  const truth = TRUTHS[Math.floor(Math.random() * TRUTHS.length)];
  reply(box('❓ *VÉRITÉ*', [
    { raw: truth },
    { blank: true },
    { raw: '_Tape .dare pour une action à la place_' },
  ]));
});
