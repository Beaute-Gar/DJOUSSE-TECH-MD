const ranks = [
  { name: 'Newbie', min: 0 },
  { name: 'Bronze', min: 100 },
  { name: 'Silver', min: 300 },
  { name: 'Gold', min: 600 },
  { name: 'Platinum', min: 1000 },
  { name: 'Diamond', min: 1500 },
  { name: 'Master', min: 2500 },
  { name: 'Grandmaster', min: 5000 },
  { name: 'Epic', min: 8000 },
  { name: 'Legend', min: 12000 },
  { name: 'Mythic', min: 18000 },
  { name: 'Immortal', min: 25000 },
  { name: 'Conqueror', min: 35000 },
  { name: 'Deity', min: 50000 }
];

const getRank = (xp) => {
  let rank = ranks[0];
  for (const r of ranks) {
    if (xp >= r.min) rank = r;
  }
  return rank.name;
};

const getXpForNextLevel = (level) => level * 100;

module.exports = { ranks, getRank, getXpForNextLevel };