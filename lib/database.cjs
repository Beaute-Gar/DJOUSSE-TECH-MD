const config = require('../config-djousse.cjs');
const path = require('path');
const fs = require('fs');

const USE_MONGO_INIT = !!config.MONGODB_URI;
let USE_MONGO = false;

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ═══════════════════════════════════════════════════════════════════════════
//  JSON file storage (local fallback)
// ═══════════════════════════════════════════════════════════════════════════
function readJSON(name) {
    const p = path.join(DATA_DIR, `${name}.json`);
    if (!fs.existsSync(p)) return {};
    try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return {}; }
}
function writeJSON(name, data) {
    const p = path.join(DATA_DIR, `${name}.json`);
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

// ═══════════════════════════════════════════════════════════════════════════
//  Connexion — MongoDB OU JSON selon la config
// ═══════════════════════════════════════════════════════════════════════════
const connectdb = async () => {
    if (USE_MONGO_INIT) {
        const mongoose = require('mongoose');
        try {
            mongoose.set('strictQuery', false);
            await mongoose.connect(config.MONGODB_URI, {
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
            });
            USE_MONGO = true;
            console.log('✅ Database: MongoDB connected');
        } catch (e) {
            console.warn('⚠️  MongoDB connection failed, using local JSON storage');
            USE_MONGO = false;
        }
    }
    if (!USE_MONGO) {
        console.log('✅ Database: Local JSON storage');
    }
};

// ═══════════════════════════════════════════════════════════════════════════
//  USER CONFIG
// ═══════════════════════════════════════════════════════════════════════════
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

async function getUserConfigFromMongoDB(number) {
    const clean = number.replace(/[^0-9]/g, '');
    try {
        if (USE_MONGO) {
            const mongoose = require('mongoose');
            const UserConfig = mongoose.model('UserConfig');
            const cfg = await UserConfig.findOne({ number: clean });
            if (cfg) return cfg.config;
            await UserConfig.create({ number: clean, config: DEFAULT_CONFIG });
            return DEFAULT_CONFIG;
        } else {
            const db = readJSON('user_configs');
            if (db[clean]) return db[clean].config;
            db[clean] = { config: DEFAULT_CONFIG, createdAt: new Date().toISOString() };
            writeJSON('user_configs', db);
            return DEFAULT_CONFIG;
        }
    } catch (error) {
        console.error('❌ Error getting user config:', error.message);
        return {};
    }
}

async function updateUserConfigInMongoDB(number, newConfig) {
    const clean = number.replace(/[^0-9]/g, '');
    try {
        if (USE_MONGO) {
            const mongoose = require('mongoose');
            const UserConfig = mongoose.model('UserConfig');
            await UserConfig.findOneAndUpdate(
                { number: clean },
                { config: newConfig, updatedAt: new Date() },
                { upsert: true, returnDocument: 'after' }
            );
        } else {
            const db = readJSON('user_configs');
            db[clean] = { config: newConfig, updatedAt: new Date().toISOString() };
            writeJSON('user_configs', db);
        }
        return true;
    } catch (error) {
        console.error('❌ Error updating user config:', error.message);
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  OTP
// ═══════════════════════════════════════════════════════════════════════════
async function saveOTPToMongoDB(number, otp, otpConfig) {
    const clean = number.replace(/[^0-9]/g, '');
    try {
        if (USE_MONGO) {
            const mongoose = require('mongoose');
            const OTP = mongoose.model('OTP');
            await OTP.create({ number: clean, otp, config: otpConfig });
        } else {
            const db = readJSON('otps');
            db[clean] = { otp, config: otpConfig, expiresAt: new Date(Date.now() + 5 * 60000).toISOString() };
            writeJSON('otps', db);
        }
        return true;
    } catch (error) {
        console.error('❌ Error saving OTP:', error.message);
        return false;
    }
}

async function verifyOTPFromMongoDB(number, otp) {
    const clean = number.replace(/[^0-9]/g, '');
    try {
        if (USE_MONGO) {
            const mongoose = require('mongoose');
            const OTP = mongoose.model('OTP');
            const otpRecord = await OTP.findOne({ number: clean, otp, expiresAt: { $gt: new Date() } });
            if (!otpRecord) return { valid: false, error: 'Invalid or expired OTP' };
            await OTP.deleteOne({ _id: otpRecord._id });
            return { valid: true, config: otpRecord.config };
        } else {
            const db = readJSON('otps');
            const record = db[clean];
            if (!record || record.otp !== otp) return { valid: false, error: 'Invalid or expired OTP' };
            if (new Date(record.expiresAt) < new Date()) return { valid: false, error: 'Invalid or expired OTP' };
            delete db[clean];
            writeJSON('otps', db);
            return { valid: true, config: record.config };
        }
    } catch (error) {
        console.error('❌ Error verifying OTP:', error.message);
        return { valid: false, error: 'Verification error' };
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  ACTIVE NUMBERS
// ═══════════════════════════════════════════════════════════════════════════
async function addNumberToMongoDB(number) {
    const clean = number.replace(/[^0-9]/g, '');
    try {
        if (USE_MONGO) {
            const mongoose = require('mongoose');
            const ActiveNumber = mongoose.model('ActiveNumber');
            await ActiveNumber.findOneAndUpdate(
                { number: clean },
                { lastConnected: new Date(), isActive: true },
                { upsert: true, returnDocument: 'after' }
            );
        } else {
            const db = readJSON('active_numbers');
            db[clean] = { lastConnected: new Date().toISOString(), isActive: true };
            writeJSON('active_numbers', db);
        }
        return true;
    } catch (error) {
        console.error('❌ Error adding number:', error.message);
        return false;
    }
}

async function removeNumberFromMongoDB(number) {
    const clean = number.replace(/[^0-9]/g, '');
    try {
        if (USE_MONGO) {
            const mongoose = require('mongoose');
            const ActiveNumber = mongoose.model('ActiveNumber');
            await ActiveNumber.deleteOne({ number: clean });
        } else {
            const db = readJSON('active_numbers');
            delete db[clean];
            writeJSON('active_numbers', db);
        }
        return true;
    } catch (error) {
        console.error('❌ Error removing number:', error.message);
        return false;
    }
}

async function getAllNumbersFromMongoDB() {
    try {
        if (USE_MONGO) {
            const mongoose = require('mongoose');
            const ActiveNumber = mongoose.model('ActiveNumber');
            const activeNumbers = await ActiveNumber.find({ isActive: true });
            return activeNumbers.map(num => num.number);
        } else {
            const db = readJSON('active_numbers');
            return Object.keys(db).filter(k => db[k].isActive);
        }
    } catch (error) {
        console.error('❌ Error getting numbers:', error.message);
        return [];
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  STATS
// ═══════════════════════════════════════════════════════════════════════════
async function incrementStats(number, field) {
    const clean = number.replace(/[^0-9]/g, '');
    const today = new Date().toISOString().split('T')[0];
    try {
        if (USE_MONGO) {
            const mongoose = require('mongoose');
            const Stats = mongoose.model('Stats');
            await Stats.findOneAndUpdate(
                { number: clean, date: today },
                { $inc: { [field]: 1 } },
                { upsert: true, returnDocument: 'after' }
            );
        } else {
            const validFields = ['commandsUsed', 'messagesReceived', 'messagesSent', 'groupsInteracted'];
            if (!validFields.includes(field)) return;
            const db = readJSON('stats');
            const key = `${clean}:${today}`;
            if (!db[key]) db[key] = { number: clean, date: today, commandsUsed: 0, messagesReceived: 0, messagesSent: 0, groupsInteracted: 0 };
            db[key][field] = (db[key][field] || 0) + 1;
            writeJSON('stats', db);
        }
    } catch (_) {}
}

async function getStatsForNumber(number) {
    const clean = number.replace(/[^0-9]/g, '');
    try {
        if (USE_MONGO) {
            const mongoose = require('mongoose');
            const Stats = mongoose.model('Stats');
            return await Stats.find({ number: clean }).sort({ date: -1 }).limit(30);
        } else {
            const db = readJSON('stats');
            return Object.values(db)
                .filter(r => r.number === clean)
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 30);
        }
    } catch (error) {
        return [];
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Mongoose models (created only if MongoDB is active)
// ═══════════════════════════════════════════════════════════════════════════
let Session, UserConfig, OTP, ActiveNumber, Stats;

if (USE_MONGO_INIT) {
    const mongoose = require('mongoose');
    UserConfig = mongoose.model('UserConfig', new mongoose.Schema({
        number: { type: String, required: true, unique: true, index: true },
        config: { type: Object, default: DEFAULT_CONFIG },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
    }));
    OTP = mongoose.model('OTP', new mongoose.Schema({
        number: { type: String, required: true, index: true },
        otp: { type: String, required: true },
        config: { type: Object, required: true },
        expiresAt: { type: Date, default: () => new Date(Date.now() + 5 * 60000), index: { expires: '5m' } },
        createdAt: { type: Date, default: Date.now }
    }));
    ActiveNumber = mongoose.model('ActiveNumber', new mongoose.Schema({
        number: { type: String, required: true, unique: true, index: true },
        lastConnected: { type: Date, default: Date.now },
        isActive: { type: Boolean, default: true }
    }));
    Stats = mongoose.model('Stats', new mongoose.Schema({
        number: { type: String, required: true },
        date: { type: String, required: true },
        commandsUsed: { type: Number, default: 0 },
        messagesReceived: { type: Number, default: 0 },
        messagesSent: { type: Number, default: 0 },
        groupsInteracted: { type: Number, default: 0 }
    }));
}

module.exports = {
    connectdb,
    USE_MONGO,
    UserConfig, OTP, ActiveNumber, Stats,
    getUserConfigFromMongoDB, updateUserConfigInMongoDB,
    saveOTPToMongoDB, verifyOTPFromMongoDB,
    addNumberToMongoDB, removeNumberFromMongoDB, getAllNumbersFromMongoDB,
    incrementStats, getStatsForNumber,
    getUserConfig: async (number) => { const c = await getUserConfigFromMongoDB(number); return c || {}; },
    updateUserConfig: updateUserConfigInMongoDB
};
