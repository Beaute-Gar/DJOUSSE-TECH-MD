const { cmd } = require('../command.cjs');

const moods = [
  { mood: 'Heureux', emoji: '😊', description: 'Tout va bien dans le monde numérique.' },
  { mood: 'Motivé', emoji: '💪', description: 'Prêt à coder quoi que ce soit!' },
  { mood: 'Fatigué', emoji: '😴', description: 'Trop de compilations hier soir.' },
  { mood: 'Curieux', emoji: '🤔', description: 'Envie d\'explorer de nouveaux langages.' },
  { mood: 'Créatif', emoji: '🎨', description: 'Des idées à revendre.' },
  { mood: 'Désorganisé', emoji: '😵', description: 'Le code est en vrac mais ça marche.' },
  { mood: 'Confiant', emoji: '😎', description: 'Ce bug n\'a aucune chance.' },
  { mood: 'Paresseux', emoji: '🦥', description: 'Il y a toujours demain pour push.' },
  { mood: 'Étonné', emoji: '😲', description: 'Le code a marché du premier coup!' },
  { mood: 'Nostalgique', emoji: '🥲', description: 'On me manque les bons vieux PHP.' }
];

cmd({
  pattern: 'mood',
  alias: ['humeur'],
  desc: 'Random mood generator',
  category: 'fun',
  filename: __filename,
}, async (conn, m, args, config) => {
  const mood = moods[Math.floor(Math.random() * moods.length)];
  const text = `🎭 [ROBOT] HUMEUR DU JOUR!\n\n${mood.emoji} Humeur: ${mood.mood}\n💬 ${mood.description}\n\n⚡ [ROBOT] Humeur détectée par algorithme émotionnel.`;
  await m.reply(text);
});
