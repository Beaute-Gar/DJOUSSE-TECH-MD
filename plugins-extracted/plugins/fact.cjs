const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');

const FACTS = [
  "Le miel ne se périme jamais — des pots vieux de 3000 ans ont été retrouvés encore comestibles en Égypte.",
  "Un jour sur Vénus dure plus longtemps qu'une année sur Vénus.",
  "Les poulpes ont trois cœurs et du sang bleu.",
  "Le Sahara était une région verte et fertile il y a environ 10 000 ans.",
  "Un éclair est environ 5 fois plus chaud que la surface du soleil.",
  "Les bananes sont techniquement des baies, mais les fraises non.",
  "Le cœur d'une crevette se trouve dans sa tête.",
  "Il y a plus d'étoiles dans l'univers observable que de grains de sable sur toutes les plages de la Terre.",
  "Les ours polaires ont la peau noire sous leur fourrure blanche.",
  "Le Wi-Fi ne signifie officiellement rien — ce n'est pas un acronyme, juste un nom commercial.",
  "L'ADN humain est identique à environ 60% à celui d'une banane.",
  "Un escargot peut dormir jusqu'à 3 ans.",
  "La tour Eiffel grandit d'environ 15 cm en été à cause de la dilatation du métal.",
  "Il est physiquement impossible de se lécher le coude pour la plupart des humains.",
  "Le Cameroun compte plus de 250 langues et groupes ethniques différents.",
];

cmd({ pattern: 'fact', alias: ['fait', 'saviezvous'], react: '💡', desc: 'Un fait insolite au hasard', category: 'fun', filename: __filename }, async (conn, m, commands, { reply }) => {
  const fact = FACTS[Math.floor(Math.random() * FACTS.length)];
  reply(box('💡 *LE SAVIEZ-VOUS ?*', [
    { raw: fact },
  ]));
});
