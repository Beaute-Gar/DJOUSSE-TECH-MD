const fs = require('fs');
const path = require('path');

const ECONOMY_DB = path.join(__dirname, '..', 'database', 'economy.json');

const initEconomy = () => {
  if (!fs.existsSync(ECONOMY_DB)) {
    fs.writeFileSync(ECONOMY_DB, JSON.stringify({}, null, 2));
  }
};

const readEconomy = () => {
  try {
    return JSON.parse(fs.readFileSync(ECONOMY_DB, 'utf-8'));
  } catch (e) {
    return {};
  }
};

const writeEconomy = (data) => {
  fs.writeFileSync(ECONOMY_DB, JSON.stringify(data, null, 2));
};

const getEconomy = (userId) => {
  const data = readEconomy();
  if (!data[userId]) {
    data[userId] = {
      wallet: 0,
      bank: 0,
      diamonds: 0,
      xp: 0,
      level: 1,
      inventory: [],
      lastDaily: 0,
      lastWeekly: 0
    };
    writeEconomy(data);
  }
  return data[userId];
};

const updateEconomy = (userId, updates) => {
  const data = readEconomy();
  data[userId] = { ...(data[userId] || {}), ...updates };
  writeEconomy(data);
};

const tryAutoLevelUp = (chatId, sender) => {
  const data = readEconomy();
  if (!data[sender]) return { leveled: false };
  
  const user = data[sender];
  const xpNeeded = user.level * 100;
  
  if (user.xp >= xpNeeded) {
    const before = user.level;
    user.level++;
    user.xp = 0;
    user.diamonds += 5;
    writeEconomy(data);
    return { leveled: true, before, after: user.level, diamondsEarned: 5 };
  }
  
  return { leveled: false };
};

const formatLevelUpMessage = (before, after, role, diamonds) => {
  return `Niveau supérieur ! Tu es maintenant level ${after} ! (+${diamonds} diamants)`;
};

initEconomy();

module.exports = { getEconomy, updateEconomy, tryAutoLevelUp, formatLevelUpMessage };