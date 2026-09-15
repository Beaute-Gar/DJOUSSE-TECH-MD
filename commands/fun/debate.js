const { cmd } = require('../command.cjs');

cmd({
  pattern: 'debate',
  alias: ['débat'],
  desc: 'AI debate simulation',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, config) => {
  const topic = args.join(' ');
  if (!topic) return m.reply('🤖 [SYSTEM] Usage: .debate <sujet>\n\nExemple: .debate les chats sont-ils meilleurs que les chiens?');

  const positions = [
    ['FOR', 'CONTRE'],
    ['POUR', 'CONTRE'],
    ['SUPPORT', 'OPPOSITION']
  ];
  const pos = positions[Math.floor(Math.random() * positions.length)];

  const argumentsFor = [
    'Logique indiscutable. Les faits sont clairs.',
    'Données statistiques à l\'appui. Aucune contestation possible.',
    'Consensus scientifique. Point final.',
    'Expérience personnelle concrète. Irréfutable.',
    'Raisonnement impeccable. Aucune faille détectée.'
  ];

  const argumentsAgainst = [
    'Argument fallacieux. Les données sont biaisées.',
    'Vision trop étroite. Il faut considérer les nuances.',
    'Exemple anecdotique. Pas représentatif.',
    'Logique inversée. Les conclusions sont erronées.',
    'Biais cognitif détecté. Raisonnement flawed.'
  ];

  const text = `⚖️ [ROBOT] DÉBAT SIMULÉ!\n\nSujet: "${topic}"\n\n🟢 ${pos[0]}: ${argumentsFor[Math.floor(Math.random() * argumentsFor.length)]}\n\n🔴 ${pos[1]}: ${argumentsAgainst[Math.floor(Math.random() * argumentsAgainst.length)]}\n\n⚖️ Verdict: Le débat continue... L'opinion est subjective.\n\n⚡ [ROBOT] Simulation de débat terminée.`;
  await m.reply(text);
});
