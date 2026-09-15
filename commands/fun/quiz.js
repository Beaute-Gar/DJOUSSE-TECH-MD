const { cmd } = require('../command.cjs');

const quizzes = [
  { q: 'Quelle est la capitale de la France?', a: ['paris', 'pari'], hint: 'La ville lumière' },
  { q: 'Combien font 7 x 8?', a: ['56'], hint: 'Plus que 50' },
  { q: 'Quel est le plus grand océan?', a: ['pacifique', 'océan pacifique'], hint: 'Il couvre 30% de la Terre' },
  { q: 'Qui a peint la Joconde?', a: ['léonard de vinci', 'vinci', 'da vinci'], hint: 'Un génie italien' },
  { q: 'Quel est le symbole chimique de l\'eau?', a: ['h2o'], hint: 'Hydrogène + Oxygène' },
  { q: 'En quelle année Christophe Colomb a découvert l\'Amérique?', a: ['1492'], hint: 'XVe siècle' },
  { q: 'Quel est le plus petit pays du monde?', a: ['vatican'], hint: 'Enclavé à Rome' },
  { q: 'Combien de continents existe-t-il?', a: ['7', 'sept'], hint: 'Plus que 5' },
  { q: 'Quel animal est le plus rapide du monde?', a: ['guépard', 'le guépard'], hint: 'Un félin' },
  { q: 'Quelle planète est la plus proche du Soleil?', a: ['mercure'], hint: 'La première' }
];

cmd({
  pattern: 'quiz',
  alias: ['question'],
  desc: 'Random quiz question',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, config) => {
  const quiz = quizzes[Math.floor(Math.random() * quizzes.length)];
  const text = `🧠 [ROBOT] QUIZ TIME!\n\n❓ ${quiz.q}\n\n💡 Indice: ${quiz.hint}\n📝 Répondez avec: .quizrep <réponse>\n\n⚡ [ROBOT] Question sélectionnée aléatoirement.`;
  await m.reply(text);
});

cmd({
  pattern: 'quizrep',
  alias: ['qr'],
  desc: 'Answer quiz question',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, config) => {
  if (!args.length) return m.reply('🤖 [SYSTEM] Usage: .quizrep <réponse>');

  const quiz = quizzes[Math.floor(Math.random() * quizzes.length)];
  const answer = args.join(' ').toLowerCase();

  if (quiz.a.includes(answer)) {
    await m.reply(`✅ [ROBOT] CORRECT!\n\nRéponse: ${quiz.a[0]}\n🏆 Bravo!`);
  } else {
    await m.reply(`❌ [ROBOT] INCORRECT!\n\nRéponse: ${quiz.a[0]}\n💡 ${quiz.hint}`);
  }
});
