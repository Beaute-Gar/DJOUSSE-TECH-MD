const { getEconomy, updateEconomy } = require('../../utils/economy');

function getUser(userId) {
  const data = getEconomy(userId);
  return {
    coins: data.wallet || 0,
    bank: data.bank || 0,
    level: data.level || 1,
    inventory: data.inventory || [],
    lastDaily: data.lastDaily || 0,
    lastWeekly: data.lastWeekly || 0,
    lastWork: data.lastWork || 0,
    lastCrime: data.lastCrime || 0,
    lastMine: data.lastMine || 0,
    autoLevelUp: data.autoLevelUp || false,
    transactions: data.transactions || 0,
    diamonds: data.diamonds || 0,
    xp: data.xp || 0,
  };
}

function updateUser(userId, data) {
  const updates = {};
  if (data.coins !== undefined) updates.wallet = data.coins;
  if (data.bank !== undefined) updates.bank = data.bank;
  if (data.level !== undefined) updates.level = data.level;
  if (data.inventory !== undefined) updates.inventory = data.inventory;
  if (data.lastDaily !== undefined) updates.lastDaily = data.lastDaily;
  if (data.lastWeekly !== undefined) updates.lastWeekly = data.lastWeekly;
  if (data.lastWork !== undefined) updates.lastWork = data.lastWork;
  if (data.lastCrime !== undefined) updates.lastCrime = data.lastCrime;
  if (data.lastMine !== undefined) updates.lastMine = data.lastMine;
  if (data.autoLevelUp !== undefined) updates.autoLevelUp = data.autoLevelUp;
  if (data.transactions !== undefined) updates.transactions = data.transactions;
  if (data.diamonds !== undefined) updates.diamonds = data.diamonds;
  if (data.xp !== undefined) updates.xp = data.xp;
  updateEconomy(userId, updates);
}

function getAllUsers() {
  const fs = require('fs');
  const path = require('path');
  const DB_PATH = path.join(__dirname, '..', '..', 'database', 'economy.json');
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
  catch { return {}; }
}

function getLeaderboard(limit = 10) {
  const db = getAllUsers();
  return Object.entries(db)
    .map(([id, data]) => ({ id, total: (data.wallet || 0) + (data.bank || 0), coins: data.wallet || 0, bank: data.bank || 0, level: data.level || 1 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

function loadDB() {
  const fs = require('fs');
  const path = require('path');
  const DB_PATH = path.join(__dirname, '..', '..', 'database', 'economy.json');
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
  catch { return {}; }
}

function saveDB(data) {
  const fs = require('fs');
  const path = require('path');
  const DB_PATH = path.join(__dirname, '..', '..', 'database', 'economy.json');
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

module.exports = { getUser, updateUser, getAllUsers, getLeaderboard, loadDB, saveDB };
