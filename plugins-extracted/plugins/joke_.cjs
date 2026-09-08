const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');

const JOKES = [
  "Pourquoi les développeurs confondent Halloween et Noël ? Parce que OCT 31 == DEC 25.",
  "Un ingénieur en informatique se noie. Le sauveteur crie : 'Nage vers moi !' Il répond : 'J'ai pas cette fonction en local, je dois d'abord l'importer.'",
  "Ma copine m'a dit que je ne l'écoutais jamais... enfin, un truc dans le genre.",
  "Pourquoi le développeur est-il mort de faim ? Parce qu'il attendait toujours le prochain 'catch'.",
  "Deux antennes se marient. La cérémonie n'était pas terrible, mais la réception, wow.",
  "Combien de développeurs faut-il pour changer une ampoule ? Aucun, c'est un problème matériel.",
  "Pourquoi les poules ne font pas de bons commentateurs sportifs ? Elles caquettent trop vite.",
  "J'ai demandé à un chimiste s'il pouvait m'aider avec du HCN. Il a dit oui, sans hési(cyanure).",
  "Pourquoi le squelette n'est pas allé à la fête ? Il n'avait pas le cœur à s'amuser.",
  "Mon banquier m'a demandé mes objectifs pour l'année. J'ai dit : rembourser mon banquier.",
];

cmd({ pattern: 'joke', alias: ['blague'], react: '😂', desc: 'Une blague au hasard', category: 'fun', filename: __filename }, async (conn, m, commands, { reply }) => {
  const joke = JOKES[Math.floor(Math.random() * JOKES.length)];
  reply(box('😂 *BLAGUE DU JOUR*', [
    { raw: joke },
  ]));
});
