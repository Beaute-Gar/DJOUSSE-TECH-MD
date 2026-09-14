const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'database', 'autoread.json');

const init = () => {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ enabled: false }, null, 2));
  }
};

const isEnabled = () => {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')).enabled;
  } catch (e) {
    return false;
  }
};

const toggle = () => {
  const current = isEnabled();
  fs.writeFileSync(DB_PATH, JSON.stringify({ enabled: !current }, null, 2));
  return !current;
};

init();

module.exports = { isEnabled, toggle };