const mongoose = require('mongoose');
const config = require('../config-djousse.cjs');

const connectdb = async () => {
    try {
        mongoose.set('strictQuery', false);
        await mongoose.connect(config.MONGODB_URI, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        console.log("✅ Database Connected Successfully");
    } catch (e) {
        console.error("❌ Database Connection Failed:", e.message);
    }
};

const sessionSchema = new mongoose.Schema({
    number: { type: String, required: true, unique: true, index: true },
    credentials: { type: Object, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const userConfigSchema = new mongoose.Schema({
    number: { type: String, required: true, unique: true, index: true },
    config: {
        AUTO_RECORDING: { type: String, default: 'false' },
        AUTO_TYPING: { type: String, default: 'false' },
        ANTI_CALL: { type: String, default: 'false' },
        REJECT_MSG: { type: String, default: '*CALL LATER PLEASE ☺️🌹*' },
        READ_MESSAGE: { type: String, default: 'false' },
        AUTO_VIEW_STATUS: { type: String, default: 'true' },
        AUTO_LIKE_STATUS: { type: String, default: 'true' },
        AUTO_STATUS_REPLY: { type: String, default: 'false' },
        AUTO_STATUS_MSG: { type: String, default: 'SEEN YOUR STATUS BY DJOUSSE-TECH-MD 🤗' },
        AUTO_LIKE_EMOJI: { type: Array, default: ['❤️', '👍', '😮', '😎'] },
        AUTO_REACT: { type: String, default: 'false' },
        AUTO_REACT_EMOJI: { type: Array, default: ['👀', '❤️', '🔥', '😍', '💯'] }
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const otpSchema = new mongoose.Schema({
    number: { type: String, required: true, index: true },
    otp: { type: String, required: true },
    config: { type: Object, required: true },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 5 * 60000), index: { expires: '5m' } },
    createdAt: { type: Date, default: Date.now }
});

const activeNumberSchema = new mongoose.Schema({
    number: { type: String, required: true, unique: true, index: true },
    lastConnected: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true }
});

const statsSchema = new mongoose.Schema({
    number: { type: String, required: true },
    date: { type: String, required: true },
    commandsUsed: { type: Number, default: 0 },
    messagesReceived: { type: Number, default: 0 },
    messagesSent: { type: Number, default: 0 },
    groupsInteracted: { type: Number, default: 0 }
});

const Session = mongoose.model('Session', sessionSchema);
const UserConfig = mongoose.model('UserConfig', userConfigSchema);
const OTP = mongoose.model('OTP', otpSchema);
const ActiveNumber = mongoose.model('ActiveNumber', activeNumberSchema);
const Stats = mongoose.model('Stats', statsSchema);

async function saveSessionToMongoDB(number, credentials) {
    try {
        const cleanNumber = number.replace(/[^0-9]/g, '');
        await Session.findOneAndUpdate(
            { number: cleanNumber },
            { credentials: credentials, updatedAt: new Date() },
            { upsert: true, new: true }
        );
        return true;
    } catch (error) {
        console.error('❌ Error saving session:', error);
        return false;
    }
}

async function getSessionFromMongoDB(number) {
    try {
        const cleanNumber = number.replace(/[^0-9]/g, '');
        const session = await Session.findOne({ number: cleanNumber });
        return session ? session.credentials : null;
    } catch (error) {
        console.error('❌ Error getting session:', error);
        return null;
    }
}

async function deleteSessionFromMongoDB(number) {
    try {
        const cleanNumber = number.replace(/[^0-9]/g, '');
        await Session.deleteOne({ number: cleanNumber });
        await ActiveNumber.deleteOne({ number: cleanNumber });
        return true;
    } catch (error) {
        console.error('❌ Error deleting session:', error);
        return false;
    }
}

async function getUserConfigFromMongoDB(number) {
    try {
        const cleanNumber = number.replace(/[^0-9]/g, '');
        const cfg = await UserConfig.findOne({ number: cleanNumber });
        if (cfg) return cfg.config;
        const defaultConfig = {
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
        await UserConfig.create({ number: cleanNumber, config: defaultConfig });
        return defaultConfig;
    } catch (error) {
        console.error('❌ Error getting user config:', error);
        return {};
    }
}

async function updateUserConfigInMongoDB(number, newConfig) {
    try {
        const cleanNumber = number.replace(/[^0-9]/g, '');
        await UserConfig.findOneAndUpdate(
            { number: cleanNumber },
            { config: newConfig, updatedAt: new Date() },
            { upsert: true, new: true }
        );
        return true;
    } catch (error) {
        console.error('❌ Error updating user config:', error);
        return false;
    }
}

async function saveOTPToMongoDB(number, otp, config) {
    try {
        const cleanNumber = number.replace(/[^0-9]/g, '');
        await OTP.create({ number: cleanNumber, otp: otp, config: config });
        return true;
    } catch (error) {
        console.error('❌ Error saving OTP:', error);
        return false;
    }
}

async function verifyOTPFromMongoDB(number, otp) {
    try {
        const cleanNumber = number.replace(/[^0-9]/g, '');
        const otpRecord = await OTP.findOne({ number: cleanNumber, otp: otp, expiresAt: { $gt: new Date() } });
        if (!otpRecord) return { valid: false, error: 'Invalid or expired OTP' };
        await OTP.deleteOne({ _id: otpRecord._id });
        return { valid: true, config: otpRecord.config };
    } catch (error) {
        console.error('❌ Error verifying OTP:', error);
        return { valid: false, error: 'Verification error' };
    }
}

async function addNumberToMongoDB(number) {
    try {
        const cleanNumber = number.replace(/[^0-9]/g, '');
        await ActiveNumber.findOneAndUpdate(
            { number: cleanNumber },
            { lastConnected: new Date(), isActive: true },
            { upsert: true, new: true }
        );
        return true;
    } catch (error) {
        console.error('❌ Error adding number:', error);
        return false;
    }
}

async function removeNumberFromMongoDB(number) {
    try {
        const cleanNumber = number.replace(/[^0-9]/g, '');
        await ActiveNumber.deleteOne({ number: cleanNumber });
        return true;
    } catch (error) {
        console.error('❌ Error removing number:', error);
        return false;
    }
}

async function getAllNumbersFromMongoDB() {
    try {
        const activeNumbers = await ActiveNumber.find({ isActive: true });
        return activeNumbers.map(num => num.number);
    } catch (error) {
        console.error('❌ Error getting numbers:', error);
        return [];
    }
}

async function incrementStats(number, field) {
    try {
        const cleanNumber = number.replace(/[^0-9]/g, '');
        const today = new Date().toISOString().split('T')[0];
        await Stats.findOneAndUpdate(
            { number: cleanNumber, date: today },
            { $inc: { [field]: 1 } },
            { upsert: true, new: true }
        );
    } catch (error) {}
}

async function getStatsForNumber(number) {
    try {
        const cleanNumber = number.replace(/[^0-9]/g, '');
        return await Stats.find({ number: cleanNumber }).sort({ date: -1 }).limit(30);
    } catch (error) {
        return [];
    }
}

module.exports = {
    connectdb,
    Session, UserConfig, OTP, ActiveNumber, Stats,
    saveSessionToMongoDB, getSessionFromMongoDB, deleteSessionFromMongoDB,
    getUserConfigFromMongoDB, updateUserConfigInMongoDB,
    saveOTPToMongoDB, verifyOTPFromMongoDB,
    addNumberToMongoDB, removeNumberFromMongoDB, getAllNumbersFromMongoDB,
    incrementStats, getStatsForNumber,
    getUserConfig: async (number) => { const c = await getUserConfigFromMongoDB(number); return c || {}; },
    updateUserConfig: updateUserConfigInMongoDB
};
