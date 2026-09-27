const { cmd } = require('../command.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

const fortunes = [
  'Un ami proche vous apportera une bonne nouvelle.',
  'Une opportunité inattendue se présentera bientôt.',
  'Votre créativité vous mènera vers le succès.',
  'Le bonheur se cache dans les petits détails.',
  'Un voyage imprévu changera votre perspective.',
  'Votre persévérance sera récompensée.',
  'Une rencontre fortuite éclairera votre journée.',
  'Le succès vous attend à un tournant.',
  'Votre gentillesse vous ouvrira des portes.',
  'Le destin vous réserve une surprise agréable.',
  'Un projet en cours aboutira favorablement.',
  'Votre intuition est votre meilleur guide.',
  'La fortune sourit aux audacieux.',
  'Un secret vous sera révélé prochainement.',
  'Votre sourire est votre meilleure arme.'
];

cmd({
  pattern: 'fortune',
  desc: 'Random fortune cookie',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, config) => {
  const fortune = fortunes[Math.floor(Math.random() * fortunes.length)];
  const text = boxWithFooter('🥠 COOKIE DE FORTUNE', [
    { raw: `"${fortune}"` },
  ]);
  await m.reply(text);
});
