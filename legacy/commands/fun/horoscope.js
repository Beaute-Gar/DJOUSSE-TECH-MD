const { cmd } = require('../command.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

const horoscopes = {
  'bélier': 'Votre énergie est au maximun aujourd\'hui. Profitez-en pour commencer un nouveau projet.',
  'taureau': 'La stabilité est votre alliée. Prenez le temps de savourer les petits plaisirs.',
  'gémeaux': 'Votre curiosité vous mènera vers de nouvelles découvertes. Soyez ouvert d\'esprit.',
  'cancer': 'L\'émotion est au rendez-vous. Écoutez votre instinct aujourd\'hui.',
  'lion': 'Vous brillez de mille feux. C\'est le moment d\'assumer le leadership.',
  'vierge': 'L\'attention aux détails fera la différence. Soyez méthodique.',
  'balance': 'L\'harmonie règne. C\'est le jour parfait pour les relations sociales.',
  'scorpion': 'Votre intensité vous attire. Méfiez-vous des apparences.',
  'sagittaire': 'L\'aventure vous appelle. Osez sortir de votre zone de confort.',
  'capricorne': 'La persévérance paie. Continuez vos efforts, le succès est proche.',
  'verseau': 'Votre originalité vous distingue. Partagez vos idées audacieuses.',
  'poisson': 'L\'intuition est renforcée. Fiez-vous à votre sixième sens.'
};

cmd({
  pattern: 'horoscope',
  desc: 'Daily horoscope',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, config) => {
  if (!args.length) return m.reply(boxWithFooter('USAGE', [{ raw: '🤖 [SYSTEM] Usage: .horoscope <signe>\n\nSignes: bélier, taureau, gémeaux, cancer, lion, vierge, balance, scorpion, sagittaire, capricorne, verseau, poisson' }]));

  const sign = args[0].toLowerCase();
  if (!horoscopes[sign]) return m.reply(boxWithFooter('ERREUR', [{ raw: '🤖 [SYSTEM] Signe non reconnu. Vérifiez l\'orthographe.' }]));

  const text = boxWithFooter('🔮 HOROSCOPE DU JOUR', [
    { label: '♈ Signe', value: sign.charAt(0).toUpperCase() + sign.slice(1) },
    { raw: horoscopes[sign] },
  ]);
  await m.reply(text);
});
