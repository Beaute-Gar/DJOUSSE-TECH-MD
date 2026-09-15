const { cmd } = require('../command.cjs');

const questions = [
  'Avoir la capacité de voler ou d\'être invisible?',
  'Vivre sans musique ou sans films?',
  'Être trop chaud ou trop froid?',
  'Avoir un million de dollars ou des super-pouvoirs?',
  'Manger toujours le même plat ou ne jamais manger tes plats préférés?',
  'Avoir un génie ou une lampe magique?',
  'Vivre à la campagne ou à la ville?',
  'Être célèbre ou incroyablement riche?',
  'Avoir plus de temps ou plus d\'argent?',
  'Pouvoir parler tous les langages ou communiquer avec les animaux?',
  'Voyager dans le passé ou dans le futur?',
  'Avoir la télépathie ou la télékinésie?',
  'Être toujours honnête ou toujours gentil?',
  'Avoir un décrypteur parfait ou un traducteur parfait?',
  'Vivre sans internet ou sans air conditionné?'
];

cmd({
  pattern: 'wyr',
  alias: ['wouldyourather'],
  desc: 'Would You Rather questions',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, config) => {
  const question = questions[Math.floor(Math.random() * questions.length)];
  const text = `🤔 [ROBOT] WOULD YOU RATHER?\n\n❓ ${question}\n\n📝 Répondez avec l'option 1 ou 2!\n\n⚡ [ROBOT] Question sélectionnée.`;
  await m.reply(text);
});
