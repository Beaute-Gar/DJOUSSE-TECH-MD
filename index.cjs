/* ═══════════════════════════════════════════════════════════════════════════
   DJOUSSE-TECH-MD — index.cjs v3.1.0
   Multi-compte + QR Code + Pont Telegram
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

// ─── Core Imports ──────────────────────────────────────────────────────────
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    jidNormalizedUser,
    makeCacheableSignalKeyStore,
    Browsers,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const express = require('express');
const qrcode = require('qrcode');
const NodeCache = require('node-cache');
const http = require('http');
const https = require('https');
const { rateLimit } = require('express-rate-limit');

// ─── DJOUSSE Modules ───────────────────────────────────────────────────────
const config = require('./config-djousse.cjs');
const { commands, replyHandlers } = require('./command.cjs');
const {
    connectdb, saveSessionToMongoDB,
    deleteSessionFromMongoDB, getUserConfigFromMongoDB,
    addNumberToMongoDB, getAllNumbersFromMongoDB, removeNumberFromMongoDB,
    incrementStats,
} = require('./lib/database.cjs');
const { sms } = require('./lib/msg-djousse.cjs');
const { isSudo } = require('./lib/sudo.cjs');
const { randomImage } = require('./lib/images.cjs');
const { fakevCard } = require('./lib/fakevCard.cjs');
const style = require('./lib/style.cjs');
const {
    getBuffer, getGroupAdmins, getRandom, h2k, isUrl,
    runtime, sleep, fetchJson,
} = require('./lib/functions.cjs');
const bridge = require('./android-bridge.cjs');
const logger = require('./lib/logger.cjs');

// ─── Configuration ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const BOT_NAME = config.BOT_NAME || 'DJOUSSE-TECH-MD';
const OWNER_NAME = config.OWNER_NAME || 'Beaute Gar';
const FOOTER = config.BOT_FOOTER || '© DJOUSSE TECH EVOLUTION';
const SESSION_ID = config.SESSION_ID || '';
const MONGODB_URI = config.MONGODB_URI || '';
const MODE = config.MODE || 'public';
const PREFIX = config.PREFIX || '.';
const AUTO_LIKE_EMOJI = config.AUTO_LIKE_EMOJI || ['❤️', '🌹', '✨'];
const AUTO_STATUS_MSG = config.AUTO_STATUS_MSG || 'SEEN YOUR STATUS BY DJOUSSE-TECH-MD 🤗';
const REJECT_MSG = config.REJECT_MSG || '*CALL LATER PLEASE ☺️🌹*';
const MAX_RECONNECT = 3;
const TELEGRAM_FORWARD_URL = (process.env.TELEGRAM_FORWARD_URL || 'http://localhost:3002/forward').trim();

// ─── EPIPE Protection ──────────────────────────────────────────────────────
const ignoreEPipe = (fn) => (...args) => {
    try { return fn(...args); } catch (e) { if (e.code !== 'EPIPE') throw e; }
};
process.stdout.write = ignoreEPipe(process.stdout.write.bind(process.stdout));
process.stderr.write = ignoreEPipe(process.stderr.write.bind(process.stderr));

// ─── Crash Diagnostics ─────────────────────────────────────────────────────
const crashPath = path.join(__dirname, 'crash.json');
function saveCrash(err) {
    try {
        fs.writeFileSync(crashPath, JSON.stringify({
            message: err?.message, stack: err?.stack,
            timestamp: new Date().toISOString(), pid: process.pid,
        }, null, 2));
    } catch (_) {}
}

// ─── Memory Monitoring ─────────────────────────────────────────────────────
const memInterval = setInterval(() => {
    const m = process.memoryUsage();
    logger.memory(m.rss / 1048576, m.heapUsed / 1048576, m.heapTotal / 1048576);
}, 120_000);

// ─── Cache & Cleanup ───────────────────────────────────────────────────────
const msgCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

function cleanUselessCacheAndLogs() {
    msgCache.flushAll();
    const logDir = path.join(__dirname, 'logs');
    if (fs.existsSync(logDir)) {
        fs.readdirSync(logDir).filter(f => f.endsWith('.log') && f !== 'djousse-tech.log')
            .forEach(f => { try { fs.unlinkSync(path.join(logDir, f)); } catch (_) {} });
    }
    const cacheDir = path.join(__dirname, 'tmp');
    if (fs.existsSync(cacheDir)) {
        fs.readdirSync(cacheDir).forEach(f => { try { fs.unlinkSync(path.join(cacheDir, f)); } catch (_) {} });
    }
}

// ─── Console Log to File ───────────────────────────────────────────────────
const logStream = fs.createWriteStream(path.join(__dirname, 'bot-live.log'), { flags: 'a' });
const origLog = console.log, origWarn = console.warn, origError = console.error;
console.log = (...a) => { origLog(...a); logStream.write(`[${new Date().toISOString()}] ${a.join(' ')}\n`); };
console.warn = (...a) => { origWarn(...a); logStream.write(`[${new Date().toISOString()}] WARN ${a.join(' ')}\n`); };
console.error = (...a) => { origError(...a); logStream.write(`[${new Date().toISOString()}] ERROR ${a.join(' ')}\n`); };

// ─── Bot Singleton (bot.lock) ──────────────────────────────────────────────
const lockPath = path.join(__dirname, 'bot.lock');
function acquireLock() {
    try {
        if (fs.existsSync(lockPath)) {
            const pid = parseInt(fs.readFileSync(lockPath, 'utf8').trim(), 10);
            if (pid && !isNaN(pid)) {
                try { process.kill(pid, 0); } catch (_) { return true; }
                console.error(`[LOCK] Another instance running (PID ${pid}). Exiting.`);
                process.exit(1);
            }
        }
        fs.writeFileSync(lockPath, String(process.pid));
        return true;
    } catch (_) { return true; }
}
function releaseLock() { try { if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath); } catch (_) {} }
process.on('exit', releaseLock);
process.on('SIGINT', () => { releaseLock(); process.exit(0); });
process.on('SIGTERM', () => { releaseLock(); process.exit(0); });

// ─── Multi-Account State ───────────────────────────────────────────────────
const accounts = new Map();      // numéro -> { sock, ready }
const pairingState = new Map();  // numéro -> { requested, timeout, code, qr, resolve }
const reconnectMap = new Map();  // numéro -> tentatives
const telegramLinks = new Map(); // numéro WhatsApp -> chatId Telegram
const replyCapture = new Map();  // numéro -> { chatId, expires }
const sseClients = [];

function getPairingState(num) {
    if (!pairingState.has(num)) {
        pairingState.set(num, { requested: false, timeout: null, code: null, qr: null, resolve: null });
    }
    return pairingState.get(num);
}
function existingReconnects(num) { return reconnectMap.get(num) || 0; }
function incrementReconnects(num) { reconnectMap.set(num, existingReconnects(num) + 1); }

// ─── HTTP helper (pont Telegram) ───────────────────────────────────────────
function httpPostJSON(urlStr, body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body || {});
        const u = new URL(urlStr);
        const mod = u.protocol === 'https:' ? https : http;
        const req = mod.request({
            hostname: u.hostname, port: u.port, path: u.pathname, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
            timeout: 15000,
        }, (res) => {
            let buf = '';
            res.on('data', c => buf += c);
            res.on('end', () => { try { resolve(JSON.parse(buf)); } catch { resolve({ raw: buf }); } });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        req.write(data); req.end();
    });
}

// ─── Express App ───────────────────────────────────────────────────────────
const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const apiLimiter = rateLimit({
    windowMs: 60 * 1000, max: 60,
    standardHeaders: true, legacyHeaders: false,
    message: { error: 'Too many requests' },
});
app.use('/api', apiLimiter);

// ─── Load Plugins ──────────────────────────────────────────────────────────
function loadPlugins() {
    const pluginDir = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginDir)) {
        console.log('[PLUGINS] No plugins directory found');
        return;
    }
    const files = fs.readdirSync(pluginDir).filter(f =>
        (f.endsWith('.js') || f.endsWith('.cjs')) &&
        !f.startsWith('_bridge') && !f.startsWith('disabled')
    );
    let loaded = 0, errors = 0;
    for (const file of files) {
        try {
            const fullPath = path.join(pluginDir, file);
            delete require.cache[require.resolve(fullPath)];
            require(fullPath);
            loaded++;
            logger.pluginLoad(file);
        } catch (e) {
            errors++;
            logger.pluginError(file, e.message);
        }
    }
    console.log(`[PLUGINS] Loaded: ${loaded} | Errors: ${errors}`);
    console.log(`📚 ${commands.length} commandes chargées`);
    logger.pluginSummary();
}

// ─── Plugin Dispatch ───────────────────────────────────────────────────────
function dispatchCommand(conn, m, cmdName, body, args, ctx) {
    for (const command of commands) {
        if (command.pattern && cmdName === command.pattern.toLowerCase()) {
            executePlugin(command, conn, m, body, args, ctx);
            return true;
        }
        if (command.alias && command.alias.some(a => a.toLowerCase() === cmdName)) {
            executePlugin(command, conn, m, body, args, ctx);
            return true;
        }
    }
    const withoutPrefix = body.startsWith(PREFIX) ? body.slice(PREFIX.length) : body;
    const parts = withoutPrefix.trim().split(/\s+/);
    const cmdFromBody = (parts[0] || '').toLowerCase();
    for (const command of commands) {
        if (command.pattern && cmdFromBody === command.pattern.toLowerCase()) {
            executePlugin(command, conn, m, body, args, ctx);
            return true;
        }
        if (command.alias && command.alias.some(a => a.toLowerCase() === cmdFromBody)) {
            executePlugin(command, conn, m, body, args, ctx);
            return true;
        }
    }
    return false;
}

async function executePlugin(command, conn, m, body, args, ctx) {
    try {
        const cmdStr = body.startsWith(PREFIX) ? body.slice(PREFIX.length).trim().split(/\s+/)[0] : body.trim().split(/\s+/)[0];
        logger.command(cmdStr, m.sender);

        if (command.fromMe && !m.fromMe) return;
        if (command.category === 'owner' && !isOwner(m.sender, ctx.botNum) && !isSudo(m.sender)) {
            return m.reply('❌ Owner only command.');
        }

        const pluginCtx = {
            ...config,
            conn, sock: conn, mek: m, m, args, body,
            from: m.chat, sender: m.sender,
            prefix: PREFIX, command: cmdStr,
            isOwner: isOwner(m.sender, ctx.botNum), isSudo: isSudo(m.sender),
            isGroup: m.isGroup, isAdmin: false, isBotAdmin: false,
            groupMetadata: null, participants: [], groupAdmins: [],
            config, runtime, sleep, getBuffer, getRandom, h2k, isUrl, fetchJson,
            style, randomImage, fakevCard,
            reply: (text) => m.reply(text),
            sendMessage: (jid, content, opts) => conn.sendMessage(jid, content, opts),
        };

        if (m.isGroup) {
            try {
                const metadata = await conn.groupMetadata(m.chat);
                pluginCtx.groupMetadata = metadata;
                pluginCtx.participants = metadata.participants;
                pluginCtx.groupAdmins = getGroupAdmins(metadata.participants);
                pluginCtx.isAdmin = pluginCtx.groupAdmins.includes(m.sender);
                pluginCtx.isBotAdmin = pluginCtx.groupAdmins.includes(jidNormalizedUser(conn.user.id));
            } catch (_) {}
        }

        await command.function(conn, m, commands, pluginCtx);
        incrementStats(m.botNumber || '', 'commandsUsed').catch(() => {});
    } catch (e) {
        console.error(`[CMD] Error executing ${command.pattern}:`, e.message);
        try { await m.reply('❌ Command error: ' + e.message); } catch (_) {}
    }
}

function isOwner(jid, botNum) {
    const n = (jid || '').replace(/[^0-9]/g, '');
    const ownerNum = (config.OWNER_NUMBER || config.BOT_OWNER || '').replace(/[^0-9]/g, '');
    return n === ownerNum || (!!botNum && n === botNum);
}

// ─── Auto-Features (par numéro) ────────────────────────────────────────────
async function autoStatusReact(conn, statusJid, statusKey, num) {
    try {
        const userConfig = await getUserConfigFromMongoDB(num);
        if (userConfig.AUTO_LIKE_STATUS === 'true' || userConfig.AUTO_VIEW_STATUS === 'true') {
            const emoji = AUTO_LIKE_EMOJI[Math.floor(Math.random() * AUTO_LIKE_EMOJI.length)];
            await conn.sendMessage(statusJid, { react: { text: emoji, key: statusKey } });
        }
    } catch (_) {}
}

function startAutoTyping(conn, chatJid) {
    stopAutoTyping(conn);
    conn._autoTypingInterval = setInterval(async () => {
        try { await conn.sendPresenceUpdate('composing', chatJid); } catch (_) {}
    }, 3000);
}
function stopAutoTyping(conn) {
    if (conn._autoTypingInterval) { clearInterval(conn._autoTypingInterval); conn._autoTypingInterval = null; }
}

function startAutoRecording(conn, chatJid) {
    stopAutoRecording(conn);
    conn._autoRecordingInterval = setInterval(async () => {
        try { await conn.sendPresenceUpdate('recording', chatJid); } catch (_) {}
    }, 3000);
}
function stopAutoRecording(conn) {
    if (conn._autoRecordingInterval) { clearInterval(conn._autoRecordingInterval); conn._autoRecordingInterval = null; }
}

async function handleAntiCall(conn, call, num) {
    try {
        const userConfig = await getUserConfigFromMongoDB(num);
        if (userConfig.ANTI_CALL === 'true') {
            await conn.sendMessage(call.from, { text: REJECT_MSG });
            await conn.rejectCall(call.id, call.from);
        }
    } catch (_) {}
}

async function autoFollowNewsletter(conn) {
    try {
        for (const ch of ['120363298048962083@newsletter']) {
            try { await conn.newsletterFollow(ch); } catch (_) {}
        }
    } catch (_) {}
}

async function autoJoinGroup(conn) {
    try {
        if (config.GROUP_INVITE_CODE) {
            const code = config.GROUP_INVITE_CODE.replace('https://chat.whatsapp.com/', '');
            await conn.groupAcceptInvite(code);
            console.log('[AUTO] Joined group via invite code');
        }
    } catch (_) {}
}

// ─── SSE ───────────────────────────────────────────────────────────────────
app.get('/sse', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
    });
    res.write('data: {"type":"listening"}\n\n');
    sseClients.push(res);
    req.on('close', () => { const i = sseClients.indexOf(res); if (i !== -1) sseClients.splice(i, 1); });
});

function pushSSE(data) {
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    for (let i = sseClients.length - 1; i >= 0; i--) {
        try { sseClients[i].write(payload); } catch (_) { sseClients.splice(i, 1); }
    }
}

// ─── Pairing Logic (multi-compte) ──────────────────────────────────────────
async function pairBot(number, usePairingCode = true) {
    const num = String(number).replace(/[^0-9]/g, '');

    const existing = accounts.get(num);
    if (existing?.ready) return { ok: true, alreadyConnected: true };

    if (existing?.sock) {
        try { existing.sock.ev.removeAllListeners('connection.update'); existing.sock.end(); } catch (_) {}
        accounts.delete(num);
    }

    const pState = getPairingState(num);
    if (pState.timeout) clearTimeout(pState.timeout);
    pState.requested = false;
    pState.code = null;
    pState.qr = null;

    try {
        const sessionDir = path.join(__dirname, 'sessions', num);
        if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
            },
            printQRInTerminal: false,
            browser: Browsers.ubuntu('Chrome'),   // ✅ signature desktop fiable pour le pairing code
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: false,
            syncFullHistory: false,
            retryRequestDelayMs: 500,
            transactionOpts: { delayMs: 500 },
            maxMsgRetryCount: 2,
            connectTimeoutMs: 60_000,
            keepAliveIntervalMs: 30_000,
            qrTimeout: 60_000,
        });

        accounts.set(num, { sock, ready: false });

        sock.ev.on('creds.update', saveCreds);

        // ─── connection.update ──────────────────────────────────────────
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            // ✅ Une SEULE demande de code par session, avec délai de 3s
            if (qr && usePairingCode && !sock.authState.creds.registered && !pState.requested) {
                pState.requested = true;
                pState.timeout = setTimeout(async () => {
                    try {
                        const code = await sock.requestPairingCode(num);
                        pState.code = code;
                        const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
                        pushSSE({ type: 'pairing_code', code: formatted, number: num });
                        bridge.sendStatus('pairing_code', formatted);
                        console.log(`[PAIR][${num}] Code: ${formatted}`);
                        if (pState.resolve) { pState.resolve({ ok: true, code }); pState.resolve = null; }
                    } catch (e) {
                        console.error(`[PAIR][${num}] Error requesting code:`, e.message);
                        pState.requested = false;
                    }
                }, 3000);
                return;
            }

            if (qr && !usePairingCode) {
                pState.qr = qr;
                pState.code = null;
                pushSSE({ type: 'qr_ready', number: num });
                console.log(`[PAIR][${num}] QR generated`);
                return;
            }

            if (connection === 'open') {
                console.log(`[CONN][${num}] ${BOT_NAME} connected!`);
                accounts.set(num, { sock, ready: true });
                reconnectMap.delete(num);
                if (pState.timeout) clearTimeout(pState.timeout);

                pushSSE({ type: 'connected', number: num });
                bridge.sendStatus('connected');

                await sleep(2000);
                await addNumberToMongoDB(num).catch(() => {});
                await autoFollowNewsletter(sock);
                await autoJoinGroup(sock);

                try { await sock.sendPresenceUpdate('available'); } catch (_) {}
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const loggedOut = statusCode === DisconnectReason.loggedOut;
                console.log(`[CONN][${num}] Connection closed. Status: ${statusCode}`);
                if (pState.timeout) clearTimeout(pState.timeout);

                if (pState.resolve) {
                    pState.resolve({ ok: false, error: 'Connection closed' });
                    pState.resolve = null;
                }

                if (loggedOut) {
                    console.log(`❌ [${num}] Session logged out — purge`);
                    accounts.delete(num);
                    pairingState.delete(num);
                    reconnectMap.delete(num);
                    await deleteSessionFromMongoDB(num).catch(() => {});
                    pushSSE({ type: 'disconnected', number: num });
                } else if (existingReconnects(num) < MAX_RECONNECT) {
                    incrementReconnects(num);
                    console.log(`[RECONNECT][${num}] Attempt ${existingReconnects(num)}/${MAX_RECONNECT}...`);
                    pushSSE({ type: 'reconnecting', number: num, attempt: existingReconnects(num) });
                    await sleep(3000 * existingReconnects(num));
                    pairBot(num, false).catch(() => {});
                } else {
                    console.log(`[CONN][${num}] Max reconnect attempts reached.`);
                    accounts.delete(num);
                    pairingState.delete(num);
                    reconnectMap.delete(num);
                }
            }
        });

   // ─── messages.upsert (Plugin Dispatch + Pont Telegram) ──────────
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify') return;
            for (const rawMsg of messages) {
                try {
                    // Statuts WhatsApp
                    if (rawMsg.key && rawMsg.key.remoteJid === 'status@broadcast') {
                        if (config.AUTO_STATUS_REACT) {
                            await autoStatusReact(sock, rawMsg.key.remoteJid, rawMsg.key, num);
                        }
                        const userConfig = await getUserConfigFromMongoDB(num);
                        if (userConfig.AUTO_VIEW_STATUS === 'true') {
                            try { await sock.readMessages([rawMsg.key]); } catch (_) {}
                        }
                        if (userConfig.AUTO_STATUS_REPLY === 'true' && !rawMsg.key.fromMe) {
                            await sock.sendMessage(rawMsg.key.remoteJid, {
                                text: userConfig.AUTO_STATUS_MSG || AUTO_STATUS_MSG,
                            }, { quoted: rawMsg });
                        }
                        continue;
                    }

                    const m = sms(sock, rawMsg);
                    if (!m || !m.message) continue;
                    m.botNumber = num;

                    // ─── Pont Telegram : capture de la réponse WhatsApp ───
                    if (m.fromMe && replyCapture.has(num)) {
                        const cap = replyCapture.get(num);
                        if (Date.now() < cap.expires && cap.chatId) {
                            const text = m.body || '[réponse non textuelle]';
                            replyCapture.delete(num);
                            httpPostJSON(TELEGRAM_FORWARD_URL, { chatId: cap.chatId, text }).catch(() => {});
                        } else {
                            replyCapture.delete(num);
                        }
                    }

                    if (MODE === 'private' && !m.fromMe && !isOwner(m.sender, num) && !isSudo(m.sender)) continue;

                    if (msgCache.has(m.id)) continue;
                    msgCache.set(m.id, true);

                    const body = m.body || '';
                    const isCmd = body.startsWith(PREFIX);
                    const commandBody = isCmd ? body.slice(PREFIX.length).trim() : body.trim();
                    const parts = commandBody.split(/\s+/);
                    const cmdName = (parts[0] || '').toLowerCase();
                    const args = parts.slice(1);

                    const userConfig = await getUserConfigFromMongoDB(num);
                    if (userConfig.AUTO_TYPING === 'true' && !m.fromMe) {
                        startAutoTyping(sock, m.chat);
                        setTimeout(() => stopAutoTyping(sock), 5000);
                    }
                    if (userConfig.AUTO_RECORDING === 'true' && !m.fromMe) {
                        startAutoRecording(sock, m.chat);
                        setTimeout(() => stopAutoRecording(sock), 5000);
                    }
                    if (userConfig.READ_MESSAGE === 'true') {
                        try { await sock.readMessages([m.key]); } catch (_) {}
                    }

                    if (isCmd) {
                        incrementStats(num, 'messagesReceived').catch(() => {});
                        dispatchCommand(sock, m, cmdName, body, args, {
                            conn: sock, mek: m, m, args, body, prefix: PREFIX, command: cmdName, botNum: num,
                        });
                    }

                    if (!isCmd) {
                        for (const handler of replyHandlers) {
                            try {
                                if (handler.filter && typeof handler.filter === 'function') {
                                    const match = await handler.filter(m);
                                    if (match) {
                                        await handler.function({ conn: sock, mek: m, m, args, body, config, style, sleep, getBuffer, botNum: num });
                                        break;
                                    }
                                }
                            } catch (_) {}
                        }
                    }

                    if (!m.fromMe) incrementStats(num, 'messagesReceived').catch(() => {});
                    else incrementStats(num, 'messagesSent').catch(() => {});
                } catch (e) {
                    console.error('[MSG] Error processing message:', e.message);
                }
            }
        });

        // ─── Call Events ────────────────────────────────────────────────
        sock.ev.on('call', async (calls) => {
            for (const call of calls) {
                if (call.status === 'offer') await handleAntiCall(sock, call, num);
            }
        });

        // ─── Groups Update ──────────────────────────────────────────────
        sock.ev.on('groups.update', async (updates) => {
            for (const update of updates) {
                if (update.id && update.subject) {
                    console.log(`[GROUP][${num}] ${update.id} renamed to ${update.subject}`);
                }
            }
        });

        // ─── Group Participant Update ───────────────────────────────────
        sock.ev.on('group-participants.update', async (update) => {
            try {
                const metadata = await sock.groupMetadata(update.id);
                for (const participant of update.participants) {
                    if (update.action === 'add') {
                        await sock.sendMessage(update.id, { text: `👋 Welcome to *${metadata.subject}*!\n\n> ${FOOTER}` });
                    }
                    if (update.action === 'remove') {
                        await sock.sendMessage(update.id, { text: `👋 Goodbye from *${metadata.subject}*.\n\n> ${FOOTER}` });
                    }
                }
            } catch (_) {}
        });

        // ─── Save session to MongoDB ────────────────────────────────────
        sock.ev.on('creds.update', async () => {
            try { await saveSessionToMongoDB(num, state.creds); } catch (_) {}
        });

        return { ok: true };
    } catch (e) {
        console.error(`[PAIR][${num}] Fatal error:`, e.message);
        saveCrash(e);
        accounts.delete(num);
        pairingState.delete(num);
        return { ok: false, error: e.message };
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// API Routes
// ═══════════════════════════════════════════════════════════════════════════

// ─── Pages ─────────────────────────────────────────────────────────────────
app.get('/pair', (req, res) => {
    const pairPath = path.join(__dirname, 'public', 'pair.html');
    if (fs.existsSync(pairPath)) return res.sendFile(pairPath);
    res.status(404).send('Pair page not found');
});

app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
    res.send(`<html><head><title>${BOT_NAME}</title></head><body>
    <h1>${BOT_NAME}</h1><p>Bot is running. Uptime: ${runtime(process.uptime())}</p>
    <p><a href="/pair">Pair Bot</a> | <a href="/api/status">API Status</a></p>
    </body></html>`);
});

// ─── Pairing ───────────────────────────────────────────────────────────────
app.post('/api/pair', async (req, res) => {
    const { number, useCode, telegramUserId } = req.body;
    if (!number) return res.status(400).json({ error: 'Number required' });
    const num = String(number).replace(/[^0-9]/g, '');

    try {
        if (telegramUserId) telegramLinks.set(num, String(telegramUserId));

        const result = await pairBot(num, useCode !== false);
        if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
        if (result.alreadyConnected) return res.json({ ok: true, message: 'Already connected', connected: true });

        if (useCode === false) {
            // QR mode: return immediately, QR will arrive via SSE
            return res.json({ ok: true, message: 'QR mode started' });
        }

        const pState = getPairingState(num);
        const codeResult = await Promise.race([
            new Promise((r) => { if (pState.code) r({ ok: true, code: pState.code }); else pState.resolve = r; }),
            new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout waiting for pairing code')), 30000)),
        ]);
        res.json({ ok: true, message: 'Pairing started', code: codeResult.code });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// QR en image PNG (site web + bot Telegram)
app.get('/qr-image', async (req, res) => {
    const num = (req.query.number || '').replace(/[^0-9]/g, '');
    const pState = num ? pairingState.get(num) : null;
    const qr = pState?.qr;
    if (!qr) return res.status(404).json({ error: 'QR not ready', ready: false });
    try {
        const buf = await qrcode.toBuffer(qr, { width: 512, margin: 2 });
        res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
        res.end(buf);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Ready/QR par numéro
app.get('/ready/qr', (req, res) => {
    const num = (req.query.number || '').replace(/[^0-9]/g, '');
    const pState = num ? pairingState.get(num) : null;
    const acc = num ? accounts.get(num) : null;
    if (acc?.ready) return res.json({ ready: true, connected: true, number: num });
    if (pState?.code) return res.json({ ready: true, code: pState.code });
    if (pState?.qr) {
        return qrcode.toDataURL(pState.qr, { width: 300 }, (err, url) => {
            if (err) return res.status(500).json({ error: 'QR generation failed' });
            res.json({ ready: true, qr: url });
        });
    }
    res.json({ ready: false });
});

// ─── Statuts ───────────────────────────────────────────────────────────────
app.get('/api/status', async (req, res) => {
    try {
        const accountsList = [];
        for (const [num, acc] of accounts) {
            accountsList.push({ number: num, connected: acc.ready });
        }
        res.json({
            ok: true,
            botName: BOT_NAME,
            ownerName: OWNER_NAME,
            accounts: accountsList,
            connectedAccounts: accountsList.filter(a => a.connected).length,
            uptime: process.uptime(),
            memory: {
                rss: (process.memoryUsage().rss / 1048576).toFixed(0) + ' MB',
                heap: (process.memoryUsage().heapUsed / 1048576).toFixed(0) + ' MB',
            },
            commands: commands.length,
            plugins: commands.length,
        });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// Statut par utilisateur Telegram
app.get('/api/status/user/:chatId', (req, res) => {
    const chatId = String(req.params.chatId);
    const sessions = [];
    for (const [num, acc] of accounts) {
        if (telegramLinks.get(num) === chatId) {
            sessions.push({ phone: num, connected: acc.ready, status: acc.ready ? 'connected' : 'pairing' });
        }
    }
    res.json({
        ok: true,
        botName: BOT_NAME,
        connected: sessions.some(s => s.connected),
        sessions,
        uptime: process.uptime(),
    });
});

app.get('/api/accounts', async (req, res) => {
    try {
        const numbers = await getAllNumbersFromMongoDB();
        res.json({ ok: true, accounts: numbers.map(n => ({ number: n })) });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// ─── Reset sessions ────────────────────────────────────────────────────────
app.post('/api/reset-session', async (req, res) => {
    try {
        const { number } = req.body;
        const target = String(number).replace(/[^0-9]/g, '');
        await deleteSessionFromMongoDB(target);
        const sessionDir = path.join(__dirname, 'sessions', target);
        if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true, force: true });
        const acc = accounts.get(target);
        if (acc?.sock) {
            try { acc.sock.ev.removeAllListeners('connection.update'); acc.sock.end(); } catch (_) {}
        }
        accounts.delete(target);
        pairingState.delete(target);
        reconnectMap.delete(target);
        res.json({ ok: true, message: `Session ${target} reset` });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

app.post('/api/reset-all-sessions', async (req, res) => {
    try {
        const numbers = await getAllNumbersFromMongoDB();
        for (const num of numbers) {
            await deleteSessionFromMongoDB(num);
            const sessionDir = path.join(__dirname, 'sessions', num);
            if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true, force: true });
            const acc = accounts.get(num);
            if (acc?.sock) {
                try { acc.sock.ev.removeAllListeners('connection.update'); acc.sock.end(); } catch (_) {}
            }
            accounts.delete(num);
            pairingState.delete(num);
            reconnectMap.delete(num);
        }
        res.json({ ok: true, message: 'All sessions reset' });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// ─── Pont Telegram : liaison, connexion, commandes ─────────────────────────

// Lier un chatId Telegram à un numéro WhatsApp
app.post('/api/link', (req, res) => {
    const { number, telegramUserId } = req.body;
    const num = String(number || '').replace(/[^0-9]/g, '');
    if (!num || !telegramUserId) return res.status(400).json({ ok: false, error: 'number et telegramUserId requis' });
    telegramLinks.set(num, String(telegramUserId));
    res.json({ ok: true });
});

app.post('/api/unlink', (req, res) => {
    const num = String(req.body.number || '').replace(/[^0-9]/g, '');
    telegramLinks.delete(num);
    res.json({ ok: true });
});

// API "connexion" utilisée par le bot Telegram
app.post('/api/connection/create', async (req, res) => {
    const { phone, method, telegramUserId } = req.body;
    const num = String(phone || '').replace(/[^0-9]/g, '');
    if (!num) return res.json({ success: false, error: 'phone requis' });

    if (telegramUserId) telegramLinks.set(num, String(telegramUserId));

    const acc = accounts.get(num);
    if (acc?.ready) return res.json({ success: true, alreadyConnected: true, connectionId: num });

    const usePairingCode = method !== 'qr';
    const result = await pairBot(num, usePairingCode);
    if (!result.ok) return res.json({ success: false, error: result.error });
    res.json({ success: true, connectionId: num, method: usePairingCode ? 'pairing' : 'qr' });
});

app.get('/api/connection/:id/status', (req, res) => {
    const num = String(req.params.id).replace(/[^0-9]/g, '');
    const acc = accounts.get(num);
    const pState = pairingState.get(num);
    if (acc?.ready) return res.json({ status: 'connected', phone: num });
    if (pState?.code) return res.json({ status: 'pairing', pairingCode: pState.code, phone: num });
    if (pState?.qr) return res.json({ status: 'pairing', qrReady: true, phone: num });
    res.json({ status: accounts.has(num) ? 'waiting' : 'not_started' });
});

// Exécuter une commande WhatsApp depuis Telegram (avec capture de la réponse)
app.post('/api/send-cmd', async (req, res) => {
    const { number, cmd, telegramUserId } = req.body;
    let num = String(number || '').replace(/[^0-9]/g, '');

    if (!num && telegramUserId) {
        for (const [n, chatId] of telegramLinks) {
            if (chatId === String(telegramUserId)) { num = n; break; }
        }
    }
    const acc = accounts.get(num);
    if (!acc?.ready) {
        return res.status(400).json({ ok: false, error: `Numéro ${num || '?'} non connecté. Utilise /pair ou /qr d'abord.` });
    }

    const chatIdForReply = String(telegramUserId || telegramLinks.get(num) || '');
    if (chatIdForReply) {
        replyCapture.set(num, { chatId: chatIdForReply, expires: Date.now() + 90000 });
    }

    try {
        const jid = num + '@s.whatsapp.net';
        await acc.sock.sendMessage(jid, { text: cmd });
        res.json({ ok: true });
    } catch (e) {
        replyCapture.delete(num);
        res.status(500).json({ ok: false, error: e.message });
    }
});

// ─── Utilitaires ───────────────────────────────────────────────────────────
app.get('/count', (req, res) => {
    res.json({ commands: commands.length, uptime: runtime(process.uptime()) });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        memory: (process.memoryUsage().rss / 1048576).toFixed(0) + ' MB',
        connectedAccounts: [...accounts.values()].filter(a => a.ready).length,
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// Démarrage
// ═══════════════════════════════════════════════════════════════════════════
async function startServer() {
    if (!acquireLock()) return;

    if (MONGODB_URI) {
        await connectdb();
    } else {
        console.warn('[DB] No MongoDB URI, database features disabled');
    }

    loadPlugins();

    app.listen(PORT, '0.0.0.0', () => {
        const _ln = (t) => '║  ' + t;
        console.log(`\n╔══════════════════════════════════════════╗`);
        console.log(_ln(`${BOT_NAME} v3.1.0 (multi-account)`));
        console.log(_ln(`Owner: ${OWNER_NAME}`));
        console.log(_ln(`Port: ${PORT}`));
        console.log(`╚══════════════════════════════════════════╝\n`);
        console.log(`[SERVER] Dashboard: http://localhost:${PORT}`);
        console.log(`[SERVER] Pair page: http://localhost:${PORT}/pair`);
        console.log(`[SERVER] API: http://localhost:${PORT}/api/status`);
    });

    if (SESSION_ID) {
        console.log('[AUTO] SESSION_ID found, auto-connecting...');
        await sleep(3000);
        await pairBot(SESSION_ID, true);
    } else {
        console.log('[AUTO] No SESSION_ID. Visit /pair to connect.');
    }

    process.on('exit', () => {
        clearInterval(memInterval);
        cleanUselessCacheAndLogs();
    });

    process.on('uncaughtException', (err) => {
        console.error('[CRASH] Uncaught Exception:', err.message);
        saveCrash(err);
    });

    process.on('unhandledRejection', (reason) => {
        console.error('[CRASH] Unhandled Rejection:', reason);
    });
}

// Restaure TOUS les comptes sauvegardés au démarrage
async function autoReconnectFromMongoDB() {
    try {
        if (!MONGODB_URI) return;
        let numbers = await getAllNumbersFromMongoDB();
        if (numbers.length === 0) {
            console.log('[AUTO] No saved sessions found');
            return;
        }
        // Keep only the most recent session if multiple exist
        if (numbers.length > 1) {
            console.log(`[AUTO] ${numbers.length} sessions found, keeping only the most recent: ${numbers[numbers.length - 1]}`);
            const keep = numbers[numbers.length - 1];
            for (const num of numbers) {
                if (num !== keep) {
                    await removeNumberFromMongoDB(num).catch(() => {});
                    // Also clean local session folder
                    const sDir = path.join(__dirname, 'sessions', num);
                    if (fs.existsSync(sDir)) fs.rmSync(sDir, { recursive: true, force: true });
                }
            }
            numbers = [keep];
        }
        console.log(`[AUTO] Found ${numbers.length} saved session(s). Auto-connecting all...`);
        await sleep(3000);
        for (const num of numbers) {
            await pairBot(num, false);   // pas de pairing code : session existante ou QR silencieux
            await sleep(2000);
        }
    } catch (e) {
        console.error('[AUTO] Auto-reconnect failed:', e.message);
    }
}

(async () => {
    try {
        await startServer();
        if (!SESSION_ID) {
            await autoReconnectFromMongoDB();
        }
    } catch (e) {
        console.error('[FATAL]', e.message);
        saveCrash(e);
        process.exit(1);
    }
})();

module.exports = app;