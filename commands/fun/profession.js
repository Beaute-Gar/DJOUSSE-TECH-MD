const { cmd } = require('../command.cjs');

const professions = [
  { name: 'Développeur Web', desc: 'Crée des sites web magnifiques.' },
  { name: 'Data Scientist', desc: 'Analyse des données pour trouver des tendances.' },
  { name: 'Designer UI/UX', desc: 'Rend les interfaces utilisateur intuitives.' },
  { name: 'DevOps Engineer', desc: 'Automatise les déploiements.' },
  { name: 'Chef de projet', desc: 'Organise et dirige les équipes.' },
  { name: 'Analyste en cybersécurité', desc: 'Protège les systèmes contre les attaques.' },
  { name: 'Ingénieur IA', desc: 'Développe des intelligences artificielles.' },
  { name: 'Testeur QA', desc: 'Trouve les bugs avant les utilisateurs.' },
  { name: 'Architecte Cloud', desc: 'Conçoit des infrastructures scalables.' },
  { name: 'Consultant IT', desc: 'Conseille les entreprises sur la tech.' },
  { name: 'Freelance Developer', desc: 'Travaille librement depuis n\'importe où.' },
  { name: 'Gamer Professional', desc: 'Joue pour gagner des prix.' },
  { name: 'Streamer Tech', desc: 'Partage des tutos en direct.' },
  { name: 'Product Manager', desc: 'Gère le cycle de vie des produits.' },
  { name: 'Scrum Master', desc: 'Facilite les méthodes agiles.' }
];

cmd({
  pattern: 'profession',
  alias: ['métier', 'metier'],
  desc: 'Random profession generator',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, config) => {
  const prof = professions[Math.floor(Math.random() * professions.length)];
  const text = `💼 [ROBOT] PROFESSION ALÉATOIRE!\n\n🎯 Métier: ${prof.name}\n📝 Description: ${prof.desc}\n\n⚡ [ROBOT] Profession sélectionnée par algorithme aléatoire.`;
  await m.reply(text);
});
