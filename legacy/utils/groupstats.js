const fs = require('fs');
const path = require('path');

const STATS_DB = path.join(__dirname, '..', 'database', 'groupStats.json');

const initStats = () => {
  if (!fs.existsSync(STATS_DB)) {
    fs.writeFileSync(STATS_DB, JSON.stringify({}, null, 2));
  }
};

const readStats = () => {
  try {
    return JSON.parse(fs.readFileSync(STATS_DB, 'utf-8'));
  } catch (e) {
    return {};
  }
};

const writeStats = (data) => {
  fs.writeFileSync(STATS_DB, JSON.stringify(data, null, 2));
};

const addMessage = (groupId, sender, metadata = {}) => {
  const data = readStats();
  if (!data[groupId]) data[groupId] = { messages: {} };
  if (!data[groupId].messages[sender]) {
    data[groupId].messages[sender] = { count: 0, today: 0, stickers: 0 };
  }
  data[groupId].messages[sender].count++;
  data[groupId].messages[sender].today++;
  if (metadata.sticker) data[groupId].messages[sender].stickers++;
  writeStats(data);
};

const getGroupStats = (groupId) => {
  const data = readStats();
  return data[groupId] || { messages: {} };
};

initStats();

module.exports = { addMessage, getGroupStats };