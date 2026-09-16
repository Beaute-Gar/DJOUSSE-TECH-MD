const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function readJSON(name) {
    const p = path.join(DATA_DIR, `${name}.json`);
    if (!fs.existsSync(p)) return {};
    try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return {}; }
}
function writeJSON(name, data) {
    const p = path.join(DATA_DIR, `${name}.json`);
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

const connectdb = async () => {
    console.log('✅ Database: Local JSON storage');
};

const DEFAULT_CONFIG = {
    AUTO_RECORDING: 'false',
    AUTO_TYPING: 'false',
    ANTI_CALL: 'false',
    REJECT_MSG: '*CALL LATER PLEASE ☺️🌹*',
    READ_MESSAGE: 'false',
    AUTO_VIEW_STATUS: 'true',
    AUTO_LIKE_STATUS: 'true',
    AUTO_STATUS_REPLY: 'false',
    AUTO_STATUS_MSG: 'SEEN YOUR STATUS BY DJOUSSE-TECH-MD 🤗',
    AUTO_LIKE_EMOJI: ['❤️', '👍', '😮', '😎'],
    AUTO_REACT: 'false',
    AUTO_REACT_EMOJI: ['👀', '❤️', '🔥', '😍', '💯']
};

async function getUserConfig(number) {
    const clean = number.replace(/[^0-9]/g, '');
    const db = readJSON('user_configs');
    if (db[clean]) return db[clean].config;
    db[clean] = { config: { ...DEFAULT_CONFIG }, createdAt: new Date().toISOString() };
    writeJSON('user_configs', db);
    return { ...DEFAULT_CONFIG };
}

async function updateUserConfig(number, newConfig) {
    const clean = number.replace(/[^0-9]/g, '');
    const db = readJSON('user_configs');
    db[clean] = { config: newConfig, updatedAt: new Date().toISOString() };
    writeJSON('user_configs', db);
    return true;
}

async function saveOTP(number, otp, otpConfig) {
    const clean = number.replace(/[^0-9]/g, '');
    const db = readJSON('otps');
    db[clean] = { otp, config: otpConfig, expiresAt: new Date(Date.now() + 5 * 60000).toISOString() };
    writeJSON('otps', db);
    return true;
}

async function verifyOTP(number, otp) {
    const clean = number.replace(/[^0-9]/g, '');
    const db = readJSON('otps');
    const record = db[clean];
    if (!record || record.otp !== otp) return { valid: false, error: 'Invalid or expired OTP' };
    if (new Date(record.expiresAt) < new Date()) return { valid: false, error: 'Invalid or expired OTP' };
    delete db[clean];
    writeJSON('otps', db);
    return { valid: true, config: record.config };
}

async function addNumber(number) {
    const clean = number.replace(/[^0-9]/g, '');
    const db = readJSON('active_numbers');
    db[clean] = { lastConnected: new Date().toISOString(), isActive: true };
    writeJSON('active_numbers', db);
    return true;
}

async function removeNumber(number) {
    const clean = number.replace(/[^0-9]/g, '');
    const db = readJSON('active_numbers');
    delete db[clean];
    writeJSON('active_numbers', db);
    return true;
}

async function getAllNumbers() {
    const db = readJSON('active_numbers');
    return Object.keys(db).filter(k => db[k].isActive);
}

async function incrementStats(number, field) {
    const clean = number.replace(/[^0-9]/g, '');
    const today = new Date().toISOString().split('T')[0];
    const validFields = ['commandsUsed', 'messagesReceived', 'messagesSent', 'groupsInteracted'];
    if (!validFields.includes(field)) return;
    const db = readJSON('stats');
    const key = `${clean}:${today}`;
    if (!db[key]) db[key] = { number: clean, date: today, commandsUsed: 0, messagesReceived: 0, messagesSent: 0, groupsInteracted: 0 };
    db[key][field] = (db[key][field] || 0) + 1;
    writeJSON('stats', db);
}

async function getStatsForNumber(number) {
    const clean = number.replace(/[^0-9]/g, '');
    const db = readJSON('stats');
    return Object.values(db)
        .filter(r => r.number === clean)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 30);
}

module.exports = {
    connectdb,
    getUserConfig,
    updateUserConfig,
    saveOTP,
    verifyOTP,
    addNumber,
    removeNumber,
    getAllNumbers,
    incrementStats,
    getStatsForNumber,
};
