const badWords = [
  'connard', 'enculé', 'fdp', ' pute', 'salope', 'merde', 'nique', 'ta mère',
  'batard', 'bâtard', 'fils de pute', 'enculer', 'salaud', 'grognasse',
  'con', 'conne', 'conard', 'nul', 'nulle', 'debile', 'idiot', 'stupide',
  'brainrot', 'rizz', 'skibidi', 'sigma', 'gyatt', 'mewing', 'looksmax',
  'womp', 'cringe', 'slay', 'ate', 'no cap', 'bussin', 'fr fr',
  'sus', 'amogus', 'poggers', 'kekw', ' copa ', ' omega ', ' alphamale'
];

const containsBadWord = (text) => {
  if (!text) return false;
  const lower = text.toLowerCase();
  return badWords.some(word => lower.includes(word.toLowerCase()));
};

module.exports = { containsBadWord, badWords };