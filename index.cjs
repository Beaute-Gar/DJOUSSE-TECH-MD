/* ═══════════════════════════════════════════════════════════════════════════
   DJOUSSE-TECH-MD — Clean index.cjs (~800 lines)
   DJOUSSE-TECH-MD WhatsApp Bot
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

// ─── Core Imports ──────────────────────────────────────────────────────────
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    jidNormalizedUser,
    isJidBroadcast,
    isJidGroup,
    proto,
    getContentType,
    makeCacheableSignalKeyStore,
    Browsers,
    delay,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const express = require('express');
const qrcode = require('qrcode');
const NodeCache = require('node-cache');
const { rateLimit } = require('express-rate-limit');

// ─── DJOUSSE Modules ───────────────────────────────────────────────────────
const config = require('./config-djousse.cjs');
const { commands, replyHandlers } = require('./command.cjs');
const {
    connectdb, saveSessionToMongoDB, getSessionFromMongoDB,
    deleteSessionFromMongoDB, getUserConfigFromMongoDB,
    updateUserConfigInMongoDB, addNumberToMongoDB,
    removeNumberFromMongoDB, getAllNumbersFromMongoDB,
    saveOTPToMongoDB, verifyOTPFromMongoDB,
    incrementStats, getStatsForNumber,
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
const antiban = require('./lib/antiban.cjs');
const { checkRateLimit, checkGlobalRateLimit } = require('./lib/ratelimit.cjs');
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
const LIVE_MSG = config.LIVE_MSG || 'I am active and running';

// ─── EPIPE Protection ──────────────────────────────────────────────────────
const ignoreEPipe = (fn) => {
    return (...args) => {
        try { return fn(...args); } catch (e) { if (e.code !== 'EPIPE') throw e; }
    };
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
    const rssMB = m.rss / 1048576;
    const heapMB = m.heapUsed / 1048576;
    const heapTotalMB = m.heapTotal / 1048576;
    logger.memory(rssMB, heapMB, heapTotalMB);
}, 120_000);

// ─── Cache & Cleanup ───────────────────────────────────────────────────────
const msgCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

function cleanUselessCacheAndLogs() {
    msgCache.flushAll();
    const logDir = path.join(__dirname, 'logs');
    if (fs.existsSync(logDir)) {
        const files = fs.readdirSync(logDir).filter(f => f.endsWith('.log') && f !== 'djousse-tech.log');
        files.forEach(f => { try { fs.unlinkSync(path.join(logDir, f)); } catch (_) {} });
    }
    const cacheDir = path.join(__dirname, 'tmp');
    if (fs.existsSync(cacheDir)) {
        fs.readdirSync(cacheDir).forEach(f => {
            try { fs.unlinkSync(path.join(cacheDir, f)); } catch (_) {}
        });
    }
    logger.info('Cleaned cache and old logs');
}

// ─── Console Log to File ───────────────────────────────────────────────────
const botLiveLogPath = path.join(__dirname, 'bot-live.log');
const logStream = fs.createWriteStream(botLiveLogPath, { flags: 'a' });
const origLog = console.log;
const origWarn = console.warn;
const origError = console.error;
console.log = (...a) => { origLog(...a); logStream.write(`[${new Date().toISOString()}] ${a.join(' ')}\n`); };
console.warn = (...a) => { origWarn(...a); logStream.write(`[${new Date().toISOString()}] WARN ${a.join(' ')}\n`); };
console.error = (...a) => { origError(...a); logStream.write(`[${new Date().toISOString()}] ERROR ${a.join(' ')}\n`); };

// ─── Bot Singleton (bot.lock) ──────────────────────────────────────────────
const lockPath = path.join(__dirname, 'bot.lock');
function acquireLock() {
    try {
        if (fs.existsSync(lockPath)) {
            const pid = parseInt(fs.readFileSync(lockPath, 'utf8').trim(), 10);
            if (pid && isNaN(pid) === false) {
                try { process.kill(pid, 0); } catch (_) { /* dead */ return true; }
                console.error(`[LOCK] Another instance running (PID ${pid}). Exiting.`);
                process.exit(1);
            }
        }
        fs.writeFileSync(lockPath, String(process.pid));
        return true;
    } catch (_) { return true; }
}
function releaseLock() {
    try { if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath); } catch (_) {}
}
process.on('exit', releaseLock);
process.on('SIGINT', () => { releaseLock(); process.exit(0); });
process.on('SIGTERM', () => { releaseLock(); process.exit(0); });

// ─── Globals ───────────────────────────────────────────────────────────────
let sock = null;
let conn = null;
let isConnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT = 3;
let currentNumber = '';
let pairingQR = null;
let pairingCode = null;
let sockReady = false;
let sseClients = [];

// ─── Express App ───────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
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
    // Try prefix match
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
        if (command.category === 'owner' && !isOwner(m.sender) && !isSudo(m.sender)) {
            return m.reply('❌ Owner only command.');
        }

        // Build context object for plugins
        const pluginCtx = {
            conn: conn,
            sock: conn,
            mek: m,
            m: m,
            args: args,
            body: body,
            prefix: PREFIX,
            command: cmdStr,
            isOwner: isOwner(m.sender),
            isSudo: isSudo(m.sender),
            isGroup: m.isGroup,
            isAdmin: false,
            isBotAdmin: false,
            groupMetadata: null,
            participants: [],
            groupAdmins: [],
            config: config,
            runtime: runtime,
            sleep: sleep,
            getBuffer: getBuffer,
            getRandom: getRandom,
            h2k: h2k,
            isUrl: isUrl,
            fetchJson: fetchJson,
            style: style,
            randomImage: randomImage,
            fakevCard: fakevCard,
            reply: (text) => m.reply(text),
            sendMessage: (jid, content, opts) => conn.sendMessage(jid, content, opts),
        };

        // Group context
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

        await command.function(pluginCtx);
        incrementStats(currentNumber, 'commandsUsed').catch(() => {});
    } catch (e) {
        console.error(`[CMD] Error executing ${command.pattern}:`, e.message);
        try { await m.reply('❌ Command error: ' + e.message); } catch (_) {}
    }
}

function isOwner(jid) {
    const num = jid.replace(/[^0-9]/g, '');
    const ownerNum = (config.OWNER_NUMBER || config.BOT_OWNER || '').replace(/[^0-9]/g, '');
    return num === ownerNum || num === (sock?.user?.id || '').replace(/[^0-9]/g, '');
}

// ─── Auto-Features ─────────────────────────────────────────────────────────

// Auto Status React
async function autoStatusReact(conn, statusJid, statusKey) {
    try {
        const userConfig = await getUserConfigFromMongoDB(currentNumber);
        if (userConfig.AUTO_LIKE_STATUS === 'true' || userConfig.AUTO_VIEW_STATUS === 'true') {
            const emoji = AUTO_LIKE_EMOJI[Math.floor(Math.random() * AUTO_LIKE_EMOJI.length)];
            await conn.sendMessage(statusJid, {
                react: { text: emoji, key: statusKey },
            });
        }
    } catch (_) {}
}

// Auto Typing
let autoTypingInterval = null;
function startAutoTyping(conn, chatJid) {
    stopAutoTyping(conn);
    autoTypingInterval = setInterval(async () => {
        try { await conn.sendPresenceUpdate('composing', chatJid); } catch (_) {}
    }, 3000);
}
function stopAutoTyping(conn) {
    if (autoTypingInterval) { clearInterval(autoTypingInterval); autoTypingInterval = null; }
}

// Auto Recording
let autoRecordingInterval = null;
function startAutoRecording(conn, chatJid) {
    stopAutoRecording(conn);
    autoRecordingInterval = setInterval(async () => {
        try { await conn.sendPresenceUpdate('recording', chatJid); } catch (_) {}
    }, 3000);
}
function stopAutoRecording(conn) {
    if (autoRecordingInterval) { clearInterval(autoRecordingInterval); autoRecordingInterval = null; }
}

// Anti-Call
async function handleAntiCall(conn, call) {
    try {
        const userConfig = await getUserConfigFromMongoDB(currentNumber);
        if (userConfig.ANTI_CALL === 'true') {
            await conn.sendMessage(call.from, { text: REJECT_MSG });
            await conn.rejectCall(call.id, call.from);
        }
    } catch (_) {}
}

// Auto Follow Newsletter
async function autoFollowNewsletter(conn) {
    try {
        const channels = ['120363298048962083@newsletter'];
        for (const ch of channels) {
            try { await conn.newsletterFollow(ch); } catch (_) {}
        }
    } catch (_) {}
}

// Auto Join Group
async function autoJoinGroup(conn) {
    try {
        if (config.GROUP_INVITE_CODE) {
            const code = config.GROUP_INVITE_CODE.replace('https://chat.whatsapp.com/', '');
            await conn.groupAcceptInvite(code);
            console.log('[AUTO] Joined group via invite code');
        }
    } catch (_) {}
}

// ─── SSE for QR Push ───────────────────────────────────────────────────────
app.get('/sse', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
    });
    res.write('data: {"type":"connected"}\n\n');
    sseClients.push(res);
    req.on('close', () => { sseClients = sseClients.filter(c => c !== res); });
});

function pushSSE(data) {
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    sseClients = sseClients.filter(c => {
        try { c.write(payload); return true; } catch (_) { return false; }
    });
}

// ─── Pairing Logic ─────────────────────────────────────────────────────────
async function pairBot(number, usePairingCode = true) {
    if (isConnecting) return { ok: false, error: 'Already connecting' };
    isConnecting = true;
    currentNumber = number.replace(/[^0-9]/g, '');

    try {
        const sessionDir = path.join(__dirname, 'sessions', currentNumber);
        if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        const { version } = await fetchLatestBaileysVersion();

        sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
            },
            printQRInTerminal: false,
            browser: Browsers.windows(BOT_NAME),
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

        // ─── creds.update ───────────────────────────────────────────────
        sock.ev.on('creds.update', saveCreds);

        // ─── connection.update ──────────────────────────────────────────
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr && usePairingCode) {
                try {
                    pairingCode = await sock.requestPairingCode(currentNumber);
                    pairingQR = null;
                    pushSSE({ type: 'pairing_code', code: pairingCode });
                    bridge.sendStatus('pairing_code', pairingCode);
                    console.log(`[PAIR] Code: ${pairingCode}`);
                } catch (e) {
                    console.error('[PAIR] Error requesting code:', e.message);
                }
                return;
            }

            if (qr && !usePairingCode) {
                pairingQR = qr;
                pairingCode = null;
                const qrDataUrl = await qrcode.toDataURL(qr, { width: 300 });
                pushSSE({ type: 'qr', qr: qrDataUrl });
                bridge.sendStatus('qr', null, 'QR generated');
                console.log('[PAIR] QR generated');
                return;
            }

            if (connection === 'open') {
                console.log(`[CONN] ${BOT_NAME} connected!`);
                sockReady = true;
                isConnecting = false;
                reconnectAttempts = 0;
                pairingQR = null;
                pairingCode = null;
                conn = sock;

                pushSSE({ type: 'connected', number: currentNumber });
                bridge.sendStatus('connected');

                // Post-connect actions
                await sleep(2000);
                await addNumberToMongoDB(currentNumber);
                await autoFollowNewsletter(sock);
                await autoJoinGroup(sock);

                // Set profile picture if needed
                try {
                    await sock.sendPresenceUpdate('available');
                } catch (_) {}
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                console.log(`[CONN] Connection closed. Status: ${statusCode}. Reconnect: ${shouldReconnect}`);
                sockReady = false;

                if (shouldReconnect && reconnectAttempts < MAX_RECONNECT) {
                    reconnectAttempts++;
                    console.log(`[RECONNECT] Attempt ${reconnectAttempts}/${MAX_RECONNECT}...`);
                    pushSSE({ type: 'reconnecting', attempt: reconnectAttempts });
                    bridge.sendStatus('reconnecting', null, `Attempt ${reconnectAttempts}`);

                    await sleep(3000 * reconnectAttempts);
                    await pairBot(currentNumber, usePairingCode);
                } else {
                    console.log('[CONN] Max reconnect attempts reached or logged out.');
                    isConnecting = false;
                    pushSSE({ type: 'disconnected' });
                    bridge.sendStatus('disconnected');
                }
            }
        });

        // ─── messages.upsert (Plugin Dispatch) ──────────────────────────
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify') return;
            for (const rawMsg of messages) {
                try {
                    if (rawMsg.key && rawMsg.key.remoteJid === 'status@broadcast') {
                        // Auto status react
                        if (config.AUTO_STATUS_REACT) {
                            await autoStatusReact(sock, rawMsg.key.remoteJid, rawMsg.key);
                        }
                        // Auto view status
                        const userConfig = await getUserConfigFromMongoDB(currentNumber);
                        if (userConfig.AUTO_VIEW_STATUS === 'true') {
                            try { await sock.readMessages([rawMsg.key]); } catch (_) {}
                        }
                        // Auto status reply
                        if (userConfig.AUTO_STATUS_REPLY === 'true' && !rawMsg.key.fromMe) {
                            await sock.sendMessage(rawMsg.key.remoteJid, {
                                text: userConfig.AUTO_STATUS_MSG || AUTO_STATUS_MSG,
                            }, { quoted: rawMsg });
                        }
                        continue;
                    }

                    const m = sms(sock, rawMsg);
                    if (!m || !m.message) continue;

                    // Skip own messages in private mode
                    if (MODE === 'private' && !m.fromMe && !isOwner(m.sender) && !isSudo(m.sender)) continue;

                    // Dedup
                    if (msgCache.has(m.id)) continue;
                    msgCache.set(m.id, true);

                    const body = m.body || '';
                    const isCmd = body.startsWith(PREFIX);
                    const commandBody = isCmd ? body.slice(PREFIX.length).trim() : body.trim();
                    const parts = commandBody.split(/\s+/);
                    const cmdName = (parts[0] || '').toLowerCase();
                    const args = parts.slice(1);

                    // Auto typing/recording per user config
                    const userConfig = await getUserConfigFromMongoDB(currentNumber);
                    if (userConfig.AUTO_TYPING === 'true' && !m.fromMe) {
                        startAutoTyping(sock, m.chat);
                        setTimeout(() => stopAutoTyping(sock), 5000);
                    }
                    if (userConfig.AUTO_RECORDING === 'true' && !m.fromMe) {
                        startAutoRecording(sock, m.chat);
                        setTimeout(() => stopAutoRecording(sock), 5000);
                    }

                    // Read message
                    if (userConfig.READ_MESSAGE === 'true') {
                        try { await sock.readMessages([m.key]); } catch (_) {}
                    }

                    // Dispatch command
                    if (isCmd) {
                        incrementStats(currentNumber, 'messagesReceived').catch(() => {});
                        const handled = dispatchCommand(sock, m, cmdName, body, args, {
                            conn: sock, mek: m, m, args, body, prefix: PREFIX, command: cmdName,
                        });
                    }

                    // Reply handlers (for non-command messages)
                    if (!isCmd) {
                        for (const handler of replyHandlers) {
                            try {
                                if (handler.filter && typeof handler.filter === 'function') {
                                    const match = await handler.filter(m);
                                    if (match) {
                                        await handler.function({ conn: sock, mek: m, m, args, body, config, style, sleep, getBuffer });
                                        break;
                                    }
                                }
                            } catch (_) {}
                        }
                    }

                    // Stats
                    if (!m.fromMe) {
                        incrementStats(currentNumber, 'messagesReceived').catch(() => {});
                    } else {
                        incrementStats(currentNumber, 'messagesSent').catch(() => {});
                    }
                } catch (e) {
                    console.error('[MSG] Error processing message:', e.message);
                }
            }
        });

        // ─── Call Events ────────────────────────────────────────────────
        sock.ev.on('call', async (calls) => {
            for (const call of calls) {
                if (call.status === 'offer') {
                    await handleAntiCall(sock, call);
                }
            }
        });

        // ─── Groups Update ──────────────────────────────────────────────
        sock.ev.on('groups.update', async (updates) => {
            for (const update of updates) {
                if (update.id) {
                    try {
                        if (update.subject) {
                            console.log(`[GROUP] ${update.id} renamed to ${update.subject}`);
                        }
                    } catch (_) {}
                }
            }
        });

        // ─── Group Participant Update ───────────────────────────────────
        sock.ev.on('group-participants.update', async (update) => {
            try {
                const metadata = await sock.groupMetadata(update.id);
                for (const participant of update.participants) {
                    if (update.action === 'add') {
                        const welcome = `👋 Welcome to *${metadata.subject}*!\n\n> ${FOOTER}`;
                        await sock.sendMessage(update.id, { text: welcome });
                    }
                    if (update.action === 'remove') {
                        const goodbye = `👋 Goodbye from *${metadata.subject}*.\n\n> ${FOOTER}`;
                        await sock.sendMessage(update.id, { text: goodbye });
                    }
                }
            } catch (_) {}
        });

        // Save session
        sock.ev.on('creds.update', async (creds) => {
            try {
                await saveSessionToMongoDB(currentNumber, state.creds);
            } catch (_) {}
        });

        return { ok: true };
    } catch (e) {
        isConnecting = false;
        console.error('[PAIR] Fatal error:', e.message);
        saveCrash(e);
        return { ok: false, error: e.message };
    }
}

// ─── API Routes ────────────────────────────────────────────────────────────

// Pair page
app.get('/pair', (req, res) => {
    const pairPath = path.join(__dirname, 'public', 'pair.html');
    if (fs.existsSync(pairPath)) {
        res.sendFile(pairPath);
    } else {
        res.status(404).send('Pair page not found');
    }
});

// Pair API
app.post('/api/pair', async (req, res) => {
    const { number, useCode } = req.body;
    if (!number) return res.status(400).json({ error: 'Number required' });

    try {
        const result = await pairBot(String(number), useCode !== false);
        if (result.ok) {
            res.json({ ok: true, message: 'Pairing started', code: pairingCode });
        } else {
            res.status(400).json({ ok: false, error: result.error });
        }
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// Status API
app.get('/api/status', async (req, res) => {
    try {
        const stats = await getStatsForNumber(currentNumber);
        const userConfig = await getUserConfigFromMongoDB(currentNumber);
        res.json({
            ok: true,
            botName: BOT_NAME,
            ownerName: OWNER_NAME,
            number: currentNumber || 'Not connected',
            connected: sockReady,
            uptime: runtime(process.uptime()),
            memory: {
                rss: (process.memoryUsage().rss / 1048576).toFixed(0) + ' MB',
                heap: (process.memoryUsage().heapUsed / 1048576).toFixed(0) + ' MB',
            },
            commands: commands.length,
            plugins: commands.length,
            config: userConfig,
            stats: stats.slice(0, 7),
        });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// Reset session
app.post('/api/reset-session', async (req, res) => {
    try {
        const { number } = req.body;
        const target = number || currentNumber;
        await deleteSessionFromMongoDB(target);
        const sessionDir = path.join(__dirname, 'sessions', target.replace(/[^0-9]/g, ''));
        if (fs.existsSync(sessionDir)) {
            fs.rmSync(sessionDir, { recursive: true, force: true });
        }
        if (target === currentNumber) {
            if (sock) { try { sock.end(); } catch (_) {} }
            sockReady = false;
            currentNumber = '';
        }
        res.json({ ok: true, message: 'Session reset' });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// Reset all sessions
app.post('/api/reset-all-sessions', async (req, res) => {
    try {
        const numbers = await getAllNumbersFromMongoDB();
        for (const num of numbers) {
            await deleteSessionFromMongoDB(num);
            const sessionDir = path.join(__dirname, 'sessions', num);
            if (fs.existsSync(sessionDir)) {
                fs.rmSync(sessionDir, { recursive: true, force: true });
            }
        }
        if (sock) { try { sock.end(); } catch (_) {} }
        sockReady = false;
        currentNumber = '';
        res.json({ ok: true, message: 'All sessions reset' });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// Accounts list
app.get('/api/accounts', async (req, res) => {
    try {
        const numbers = await getAllNumbersFromMongoDB();
        res.json({ ok: true, accounts: numbers.map(n => ({ number: n })) });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// Count endpoint
app.get('/count', (req, res) => {
    res.json({
        commands: commands.length,
        uptime: runtime(process.uptime()),
    });
});

// Health endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        memory: (process.memoryUsage().rss / 1048576).toFixed(0) + ' MB',
    });
});

// Ready/QR endpoint
app.get('/ready/qr', (req, res) => {
    if (pairingQR) {
        qrcode.toDataURL(pairingQR, { width: 300 }, (err, url) => {
            if (err) return res.status(500).json({ error: 'QR generation failed' });
            res.json({ ready: true, qr: url });
        });
    } else if (pairingCode) {
        res.json({ ready: true, code: pairingCode });
    } else if (sockReady) {
        res.json({ ready: true, connected: true, number: currentNumber });
    } else {
        res.json({ ready: false });
    }
});

// Main page
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.send(`<html><head><title>${BOT_NAME}</title></head><body>
        <h1>${BOT_NAME}</h1><p>Bot is running. Uptime: ${runtime(process.uptime())}</p>
        <p><a href="/pair">Pair Bot</a> | <a href="/api/status">API Status</a></p>
        </body></html>`);
    }
});

// ─── Start Server ──────────────────────────────────────────────────────────
async function startServer() {
    // Acquire lock
    if (!acquireLock()) return;

    // Connect database
    if (MONGODB_URI) {
        await connectdb();
    } else {
        console.warn('[DB] No MongoDB URI, database features disabled');
    }

    // Load plugins
    loadPlugins();

    // Start Express
    app.listen(PORT, '0.0.0.0', () => {
        const _ln = (t) => '║  ' + t;
        console.log(`\n╔══════════════════════════════════════════╗`);
        console.log(_ln(`${BOT_NAME} v3.0.0`));
        console.log(_ln(`Owner: ${OWNER_NAME}`));
        console.log(_ln(`Port: ${PORT}`));
        console.log(`╚══════════════════════════════════════════╝\n`);
        console.log(`[SERVER] Dashboard: http://localhost:${PORT}`);
        console.log(`[SERVER] Pair page: http://localhost:${PORT}/pair`);
        console.log(`[SERVER] API: http://localhost:${PORT}/api/status`);
    });

    // Auto-connect if SESSION_ID is set
    if (SESSION_ID) {
        console.log('[AUTO] SESSION_ID found, auto-connecting...');
        currentNumber = SESSION_ID;
        await sleep(3000);
        await pairBot(SESSION_ID, true);
    } else {
        console.log('[AUTO] No SESSION_ID. Visit /pair to connect.');
    }

    // Cleanup on exit
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

// ─── Auto Reconnect from MongoDB on Startup ────────────────────────────────
async function autoReconnectFromMongoDB() {
    try {
        if (!MONGODB_URI) return;
        const numbers = await getAllNumbersFromMongoDB();
        if (numbers.length === 0) {
            console.log('[AUTO] No saved sessions found');
            return;
        }
        console.log(`[AUTO] Found ${numbers.length} saved session(s). Auto-connecting...`);
        await sleep(3000);
        await pairBot(numbers[0], true);
    } catch (e) {
        console.error('[AUTO] Auto-reconnect failed:', e.message);
    }
}

// ─── Main Entry ────────────────────────────────────────────────────────────
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
