const tag = (mentions) => {
  if (!mentions || !mentions.length) return '';
  return mentions.map(m => `@${m.split('@')[0]}`).join(' ');
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

module.exports = { tag, pick };