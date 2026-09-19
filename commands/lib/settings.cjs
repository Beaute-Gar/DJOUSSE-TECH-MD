const fs = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, '..', '..', 'database', 'settings.json');

function loadSettings() {
  try {
    const dir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(SETTINGS_FILE)) {
      fs.writeFileSync(SETTINGS_FILE, '{}', 'utf8');
      return {};
    }
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveSettings(data) {
  try {
    const dir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('[SETTINGS] Erreur sauvegarde:', e.message);
  }
}

module.exports = {
  get: (key, def) => {
    const data = loadSettings();
    return data[key] !== undefined ? data[key] : def;
  },
  set: (key, val) => {
    const data = loadSettings();
    data[key] = val;
    saveSettings(data);
  },
  toggle: (key) => {
    const data = loadSettings();
    data[key] = !data[key];
    saveSettings(data);
    return data[key];
  },
  delete: (key) => {
    const data = loadSettings();
    delete data[key];
    saveSettings(data);
  },
  all: () => loadSettings(),
};
