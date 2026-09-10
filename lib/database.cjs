const config = require('../config-djousse.cjs');
const path = require('path');
const fs = require('fs');

const USE_MONGO = !!config.MONGODB_URI;
let sqliteDb = null;

// ═══════════════════════════════════════════════════════════════════════════
//  SQLite (local) — fallback quand MONGODB_URI n'est pas défini
// ═══════════════════════════════════════════════════════════════════════════
function initSQLite() {
    const Database = require('better-sqlite3');
    const dbPath = path.join(__dirname, '..', 'data', 'djousse.db');
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    sqliteDb = new Database(dbPath);
    sqliteDb.pragma('journal_mode = WAL');
    sqliteDb.pragma('foreign_keys = ON');

    sqliteDb.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
            number TEXT PRIMARY KEY,
            credentials TEXT NOT NULL,
            createdAt TEXT DEFAULT (datetime('now')),
            updatedAt TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS user_configs (
            number TEXT PRIMARY KEY,
            config TEXT NOT NULL,
            createdAt TEXT DEFAULT (datetime('now')),
            updatedAt TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS otps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            number TEXT NOT NULL,
            otp TEXT NOT NULL,
            config TEXT NOT NULL,
            expiresAt TEXT NOT NULL,
            createdAt TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS active_numbers (
            number TEXT PRIMARY KEY,
            lastConnected TEXT DEFAULT (datetime('now')),
            isActive INTEGER DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            number TEXT NOT NULL,
            date TEXT NOT NULL,
            commandsUsed INTEGER DEFAULT 0,
            messagesReceived INTEGER DEFAULT 0,
            messagesSent INTEGER DEFAULT 0,
            groupsInteracted INTEGER DEFAULT 0,
            UNIQUE(number, date)
        );
    `);
    console.log(`✅ SQLite connected: ${dbPath}`);
}

function sqlRun(sql, params = []) {
    return sqliteDb.prepare(sql).run(...params);
}
function sqlGet(sql, params = []) {
    return sqliteDb.prepare(sql).get(...params);
}
function sqlAll(sql, params = []) {
    return sqliteDb.prepare(sql).all(...params);
}

// ═══════════════════════════════════════════════════════════════════════════
//  Connexion — MongoDB OU SQLite selon la config
// ═══════════════════════════════════════════════════════════════════════════
const connectdb = async () => {
    if (USE_MONGO) {
        const mongoose = require('mongoose');
        try {
            mongoose.set('strictQuery', false);
            await mongoose.connect(config.MONGODB_URI, {
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
            });
            console.log('✅ MongoDB connected successfully');
        } catch (e) {
            console.error('❌ MongoDB connection failed:', e.message);
            console.log('⚠️  Falling back to SQLite');
            initSQLite();
        }
    } else {
        initSQLite();
    }
};

// ═══════════════════════════════════════════════════════════════════════════
//  SESSIONS
// ═══════════════════════════════════════════════════════════════════════════
async function saveSessionToMongoDB(number, credentials) {
    const clean = number.replace(/[^0-9]/g, '');
    try {
        if (USE_MONGO) {
            const mongoose = require('mongoose');
            const Session = mongoose.model('Session');
            await Session.findOneAndUpdate(
                { number: clean },
                { credentials, updatedAt: new Date() },
                { upsert: true, returnDocument: 'after' }
            );
        } else {
            sqlRun(
                'INSERT INTO sessions (number, credentials, updatedAt) VALUES (?, ?, datetime(\'now\')) ON CONFLICT(number) DO UPDATE SET credentials=excluded.credentials, updatedAt=excluded.updatedAt',
                [clean, JSON.stringify(credentials)]
            );
        }
        return true;
    } catch (error) {
        console.error('❌ Error saving session:', error.message);
        return false;
    }
}

async function getSessionFromMongoDB(number) {
    const clean = number.replace(/[^0-9]/g, '');
    try {
        if (USE_MONGO) {
            const mongoose = require('mongoose');
            const Session = mongoose.model('Session');
            const session = await Session.findOne({ number: clean });
            return session ? session.credentials : null;
        } else {
            const row = sqlGet('SELECT credentials FROM sessions WHERE number = ?', [clean]);
            return row ? JSON.parse(row.credentials) : null;
        }
    } catch (error) {
        console.error('❌ Error getting session:', error.message);
        return null;
    }
}

async function deleteSessionFromMongoDB(number) {
    const clean = number.replace(/[^0-9]/g, '');
    try {
        if (USE_MONGO) {
            const mongoose = require('mongoose');
            const Session = mongoose.model('Session');
            const ActiveNumber = mongoose.model('ActiveNumber');
            await Session.deleteOne({ number: clean });
            await ActiveNumber.deleteOne({ number: clean });
        } else {
            sqlRun('DELETE FROM sessions WHERE number = ?', [clean]);
            sqlRun('DELETE FROM active_numbers WHERE number = ?', [clean]);
        }
        return true;
    } catch (error) {
        console.error('❌ Error deleting session:', error.message);
        return false;
    }
}

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
            const row = sqlGet('SELECT config FROM user_configs WHERE number = ?', [clean]);
            if (row) return JSON.parse(row.config);
            sqlRun(
                'INSERT INTO user_configs (number, config) VALUES (?, ?)',
                [clean, JSON.stringify(DEFAULT_CONFIG)]
            );
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
            sqlRun(
                'INSERT INTO user_configs (number, config, updatedAt) VALUES (?, ?, datetime(\'now\')) ON CONFLICT(number) DO UPDATE SET config=excluded.config, updatedAt=excluded.updatedAt',
                [clean, JSON.stringify(newConfig)]
            );
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
            const expiresAt = new Date(Date.now() + 5 * 60000).toISOString();
            sqlRun(
                'INSERT INTO otps (number, otp, config, expiresAt) VALUES (?, ?, ?, ?)',
                [clean, otp, JSON.stringify(otpConfig), expiresAt]
            );
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
            const now = new Date().toISOString();
            const row = sqlGet(
                'SELECT id, config FROM otps WHERE number = ? AND otp = ? AND expiresAt > ?',
                [clean, otp, now]
            );
            if (!row) return { valid: false, error: 'Invalid or expired OTP' };
            sqlRun('DELETE FROM otps WHERE id = ?', [row.id]);
            return { valid: true, config: JSON.parse(row.config) };
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
            sqlRun(
                'INSERT INTO active_numbers (number, lastConnected, isActive) VALUES (?, datetime(\'now\'), 1) ON CONFLICT(number) DO UPDATE SET lastConnected=excluded.lastConnected, isActive=1',
                [clean]
            );
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
            sqlRun('DELETE FROM active_numbers WHERE number = ?', [clean]);
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
            const rows = sqlAll('SELECT number FROM active_numbers WHERE isActive = 1');
            return rows.map(r => r.number);
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
            sqlRun(
                `INSERT INTO stats (number, date, ${field}) VALUES (?, ?, 1)
                 ON CONFLICT(number, date) DO UPDATE SET ${field} = ${field} + 1`,
                [clean, today]
            );
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
            return sqlAll(
                'SELECT * FROM stats WHERE number = ? ORDER BY date DESC LIMIT 30',
                [clean]
            );
        }
    } catch (error) {
        return [];
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Mongoose models (crées seulement si MongoDB est actif)
// ═══════════════════════════════════════════════════════════════════════════
let Session, UserConfig, OTP, ActiveNumber, Stats;

if (USE_MONGO) {
    const mongoose = require('mongoose');
    Session = mongoose.model('Session', new mongoose.Schema({
        number: { type: String, required: true, unique: true, index: true },
        credentials: { type: Object, required: true },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
    }));
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
    Session, UserConfig, OTP, ActiveNumber, Stats,
    saveSessionToMongoDB, getSessionFromMongoDB, deleteSessionFromMongoDB,
    getUserConfigFromMongoDB, updateUserConfigInMongoDB,
    saveOTPToMongoDB, verifyOTPFromMongoDB,
    addNumberToMongoDB, removeNumberFromMongoDB, getAllNumbersFromMongoDB,
    incrementStats, getStatsForNumber,
    getUserConfig: async (number) => { const c = await getUserConfigFromMongoDB(number); return c || {}; },
    updateUserConfig: updateUserConfigInMongoDB
};
