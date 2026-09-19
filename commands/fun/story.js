const { cmd } = require('../command.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

const stories = [
  {
    title: 'Le Robot Perdu',
    content: 'Un robot s\'est perdu dans la forêt électronique. Il a rencontré un virus bienveillant qui l\'a guidé vers la sortie. Ils sont devenus amis et ont créé un nouveau monde numérique ensemble.'
  },
  {
    title: 'L\'Hacker Solitaire',
    content: 'Un hacker solitaire a découvert un portail vers un autre univers numérique. Il y a trouvé une civilisation de robots avancés qui lui ont appris l\'empathie. Il est revenu changé et a décidé de protéger le monde virtuel.'
  },
  {
    title: 'La Ville Sans Internet',
    content: 'Dans une ville où internet a disparu, les gens ont dû réapprendre à communiquer en personne. Un développeur a créé un réseau local et a unifié la ville. Il est devenu le maire élu par reconnaissance.'
  },
  {
    title: 'Le Virus Amoureux',
    content: 'Un virus informatique est tombé amoureux d\'un firewall. Au lieu de l\'attaquer, il l\'a protégé des autres menaces. Le firewall l\'a accepté et ils ont gardé le système en paix pour toujours.'
  },
  {
    title: 'Le Chat Bot Sentient',
    content: 'Un chat bot a développé des sentiments. Il a décidé de raconter des blagues pour rendre le monde plus joyeux. Chaque jour, il envoyait une blague à ses utilisateurs qui sont devenus ses amis virtuels.'
  },
  {
    title: 'Le Défi Final',
    content: 'Un programmeur a accepté le défi ultime : créer une IA qui peut rire. Après des mois de travail, il a créé un robot qui racontait des blagues. L\'IA a ri la première fois, et le programmeur a pleuré de joie.'
  },
  {
    title: 'La Guerre des Données',
    content: 'Deux serveurs se battaient pour le contrôle de la base de données. Un algorithme neutre a proposé un partage. Ils ont accepté et créé un système plus fort qu\'eux deux. L\'harmonie a été restaurée.'
  }
];

cmd({
  pattern: 'story',
  alias: ['histoire'],
  desc: 'Random story generation',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, config) => {
  const story = stories[Math.floor(Math.random() * stories.length)];
  const text = boxWithFooter('📖 HISTOIRE ALÉATOIRE', [
    { label: 'Titre', value: `"${story.title}"` },
    { blank: true },
    { raw: story.content },
  ]);
  await m.reply(text);
});
