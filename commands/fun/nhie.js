const { cmd } = require('../command.cjs');

const statements = [
  'J\'ai déjà menti à un ami proche.',
  'J\'ai regardé quelqu\'un dormir.',
  'J\'ai volé quelque chose dans un magasin.',
  'J\'ai triché à un examen.',
  'J\'ai envoyé un message à la mauvaise personne.',
  'J\'ai fait semblant d\'appeler pour éviter quelqu\'un.',
  'J\'ai pleuré en regardant un film.',
  'J\'ai mangé quelque chose tombé par terre.',
  'J\'ai vérifié le téléphone de quelqu\'un.',
  'J\'ai fait semblant de être malade pour ne pas travailler.',
  'J\'ai dit "je t\'aime" sans le penser.',
  'J\'ai soupçonné quelqu\'un sans raison.',
  'J\'ai googlé quelqu\'un avant de le rencontrer.',
  'J\'ai fait semblant de comprendre une blague.',
  'J\'ai mis les doigts dans le nez en cachette.'
];

cmd({
  pattern: 'nhie',
  alias: ['neverhaveiever'],
  desc: 'Never Have I Ever',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, config) => {
  const statement = statements[Math.floor(Math.random() * statements.length)];
  const text = `🎭 [ROBOT] NEVER HAVE I EVER!\n\n📝 "${statement}"\n\n👍 J'ai fait (tapez "j'ai fait")\n👎 Je n'ai jamais fait (tapez "jamais")\n\n⚡ [ROBOT] Statement sélectionné.`;
  await m.reply(text);
});
