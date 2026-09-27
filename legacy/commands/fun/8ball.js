const { cmd } = require('../command.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

const answers = [
  '🟢 Oui, absolument!',
  '🟢 C\'est certain.',
  '🟢 Sans aucun doute.',
  '🟢 Oui, définitivement.',
  '🟢 Vous pouvez compter dessus.',
  '🟡 Peut-être...',
  '🟡 Il vaut mieux ne pas vous dire maintenant.',
  '🟡 Demandez-moi plus tard.',
  '🟡 Mon esprit dit oui, mais mon cœur dit peut-être.',
  '🟡 Les signes sont favorables.',
  '🔴 Non.',
  '🔴 Non, ne comptez pas dessus.',
  '🔴 Mes sources disent non.',
  '🔴 Très douteux.',
  '🔴 C\'est une illusion.'
];

cmd({
  pattern: '8ball',
  desc: 'Magic 8-ball answers',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, config) => {
  if (!args.length) return m.reply(boxWithFooter('USAGE', [{ raw: '🤖 [SYSTEM] Usage: .8ball <question>\n\nExemple: .8ball Est-ce que je vais réussir?' }]));

  const answer = answers[Math.floor(Math.random() * answers.length)];
  const text = boxWithFooter('🎱 MAGIC 8-BALL!', [
    { raw: `❓ Question: ${args.join(' ')}` },
    { blank: true },
    { raw: `Réponse: ${answer}` },
  ]);
  await m.reply(text);
});
