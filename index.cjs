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
const qrTerm = require('qrcode-terminal');
const NodeCache = require('node-cache');
const http = require('http');
const https = require('https');
const { rateLimit } = require('express-rate-limit');

// ─── DJOUSSE Modules ───────────────────────────────────────────────────────
const config = require('./config-djousse.cjs');
const { commands, replyHandlers } = require('./command.cjs');
const {
    connectdb, saveSessionToMongoDB, getSessionFromMongoDB,
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
const readline = require('readline');

// ─── Terminal Hacker Style ─────────────────────────────────────────────────
const LINE = '━'.repeat(36);
const hackerBanner = (title) => `┏━⍟「 ☣ ${title} ☣ 」⍟━┓`;
const hackerEnd = () => `┗${LINE}⍟`;

function promptNumber(msg) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => {
        rl.question(`┃ ▸ ${msg}: `, (answer) => {
            rl.close();
            resolve(answer.trim().replace(/[^0-9]/g, ''));
        });
    });
}

function promptChoice(msg) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => {
        rl.question(`┃ ▸ ${msg}: `, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

function saveNumberToEnv(num) {
    // Ne sauvegarde PAS dans .env — c'est multi-bot
    // La session est sauvegardée dans sessions/<num>/ par Baileys
}

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

// Messages envoyés automatiquement par DJOUSSE TECH.
// Mémorisés pour éviter que le bot traite ses propres réponses.
const botSentMessageIds = new NodeCache({ stdTTL: 120, checkperiod: 30, useClones: false });

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
async function dispatchCommand(conn, m, cmdName, body, args, ctx) {
    for (const command of commands) {
        if (command.pattern && cmdName === command.pattern.toLowerCase()) {
            await executePlugin(command, conn, m, body, args, ctx);
            return true;
        }
        if (command.alias && command.alias.some(a => a.toLowerCase() === cmdName)) {
            await executePlugin(command, conn, m, body, args, ctx);
            return true;
        }
    }
    const withoutPrefix = body.startsWith(PREFIX) ? body.slice(PREFIX.length) : body;
    const parts = withoutPrefix.trim().split(/\s+/);
    const cmdFromBody = (parts[0] || '').toLowerCase();
    for (const command of commands) {
        if (command.pattern && cmdFromBody === command.pattern.toLowerCase()) {
            await executePlugin(command, conn, m, body, args, ctx);
            return true;
        }
        if (command.alias && command.alias.some(a => a.toLowerCase() === cmdFromBody)) {
            await executePlugin(command, conn, m, body, args, ctx);
            return true;
        }
    }
    return false;
}

async function executePlugin(command, conn, m, body, args, ctx) {
    try {
        const cmdStr = body.startsWith(PREFIX) ? body.slice(PREFIX.length).trim().split(/\s+/)[0] : body.trim().split(/\s+/)[0];
        logger.command(cmdStr, m.sender);
        console.log(`[EXEC] pattern=${command.pattern} chat=${m.chat} sender=${m.sender}`);

        if (command.fromMe && !m.fromMe) return;
        if (command.category === 'owner' && !isOwner(m.sender, ctx.botNum) && !isSudo(m.sender)) {
            return m.reply('❌ Owner only command.');
        }

        const pluginCtx = {
            conn, sock: conn, mek: m, m, args, body,
            from: m.chat, sender: m.sender,
            prefix: PREFIX, PREFIX, command: cmdStr,
            isOwner: isOwner(m.sender, ctx.botNum), isSudo: isSudo(m.sender),
            isGroup: m.isGroup, isAdmin: false, isBotAdmin: false,
            groupMetadata: null, participants: [], groupAdmins: [],
            config, runtime, sleep, getBuffer, getRandom, h2k, isUrl, fetchJson,
            style, randomImage, fakevCard,
            reply: async (text) => {
                const sent = await m.reply(text);
                if (sent?.key?.id) botSentMessageIds.set(sent.key.id, true);
                return sent;
            },
            sendMessage: async (jid, content, opts) => {
                const sent = await conn.sendMessage(jid, content, opts);
                if (sent?.key?.id) botSentMessageIds.set(sent.key.id, true);
                return sent;
            },
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
        try {
            const errSent = await m.reply('❌ Command error: ' + e.message);
            if (errSent?.key?.id) botSentMessageIds.set(errSent.key.id, true);
        } catch (_) {}
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
const sseKeepalive = setInterval(() => {
    const payload = `data: ${JSON.stringify({ type: 'ping' })}\n\n`;
    for (let i = sseClients.length - 1; i >= 0; i--) {
        try { sseClients[i].write(payload); } catch (_) { sseClients.splice(i, 1); }
    }
}, 15000);

app.get('/sse', (req, res) => {
    try {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
        });
        res.write('data: {"type":"listening"}\n\n');
        sseClients.push(res);
        req.on('close', () => { const i = sseClients.indexOf(res); if (i !== -1) sseClients.splice(i, 1); });
        req.on('error', () => { const i = sseClients.indexOf(res); if (i !== -1) sseClients.splice(i, 1); });
    } catch (_) {}
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

        // Sauvegarde credentials : local (Baileys) + MongoDB
        sock.ev.on('creds.update', async () => {
            saveCreds();  // local sessions/<num>/
            if (MONGODB_URI) {
                try {
                    const credsPath = path.join(sessionDir, 'creds.json');
                    if (fs.existsSync(credsPath)) {
                        const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
                        await saveSessionToMongoDB(num, creds).catch(() => {});
                    }
                } catch (_) {}
            }
        });

        // ─── connection.update ──────────────────────────────────────────
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            // ✅ Code d'appairage : une demande + régénération auto toutes les 40s
            if (qr && usePairingCode && !sock.authState.creds.registered) {
                if (!pState.requested) {
                    pState.requested = true;
                    pState.timeout = setTimeout(async () => {
                        const requestCode = async () => {
                            try {
                                const code = await sock.requestPairingCode(num);
                                pState.code = code;
                                const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
                                pushSSE({ type: 'pairing_code', code: formatted, number: num });
                                bridge.sendStatus('pairing_code', formatted);
                                console.log(`[PAIR][${num}] Code: ${formatted}`);
                                console.log('');
                                console.log('┏━⍟「 ☣ PAIRING CODE ☣ 」⍟━┓');
                                console.log('┃');
                                console.log(`┃  🔑  ${formatted}`);
                                console.log('┃');
                                console.log('┃  📱 Sur ton téléphone :');
                                console.log('┃  1. Ouvre WhatsApp');
                                console.log('┃  2. Paramètres');
                                console.log('┃  3. Appareils connectés');
                                console.log('┃  4. Associer avec le numéro');
                                console.log(`┃  5. Saisis: ${formatted}`);
                                console.log('┃');
                                console.log('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⍟');
                                console.log('');
                                if (pState.resolve) { pState.resolve({ ok: true, code }); pState.resolve = null; }
                                // Régénère tant que l'appareil n'est pas lié (le code expire ~2 min)
                                pState.renewTimer = setTimeout(() => {
                                    if (!sock.authState.creds.registered && accounts.get(num)?.sock === sock) {
                                        console.log(`[PAIR][${num}] Régénération du code...`);
                                        requestCode();
                                    }
                                }, 40000);
                            } catch (e) {
                                console.error(`[PAIR][${num}] Error requesting code:`, e.message);
                                pState.requested = false;
                            }
                        };
                        await sleep(3000); // laisse le handshake se stabiliser
                        requestCode();
                    }, 100);
                }
                return;
            }

            if (qr && !usePairingCode) {
                pState.qr = qr;
                pState.code = null;
                pushSSE({ type: 'qr_ready', number: num });
                // QR dans le terminal — style hacker
                console.log('');
                console.log('┏━⍟「 ☣ QR CODE ☣ 」⍟━┓');
                console.log('┃');
                console.log('┃ 📱 Scanne ce QR avec WhatsApp :');
                console.log('┃');
                qrTerm.generate(qr, { small: true });
                console.log('┃');
                console.log('┃ 1. Ouvre WhatsApp');
                console.log('┃ 2. Paramètres');
                console.log('┃ 3. Appareils connectés');
                console.log('┃ 4. Connecter un appareil');
                console.log('┃');
                console.log('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⍟');
                console.log('');
                return;
            }

            if (connection === 'open') {
                const botId = sock.user?.id || num;
                console.log('');
                console.log(hackerBanner(`${num} — CONNECTED ✅`));
                console.log('┃');
                console.log(`┃ 🤖 Bot      : ${BOT_NAME}`);
                console.log(`┃ 📱 Numéro   : ${botId}`);
                console.log(`┃ 💾 Session  : sauvegardée`);
                console.log(`┃ 🔄 Reconnect: auto`);
                console.log(hackerEnd());
                console.log('');
                accounts.set(num, { sock, ready: true });
                reconnectMap.delete(num);
                if (pState.timeout) clearTimeout(pState.timeout);
                if (pState.renewTimer) clearTimeout(pState.renewTimer);

                pushSSE({ type: 'connected', number: num });
                bridge.sendStatus('connected');

                await sleep(2000);
                await addNumberToMongoDB(num).catch(() => {});
                // Sauvegarde initiale des credentials en MongoDB
                if (MONGODB_URI) {
                    try {
                        const credsPath = path.join(path.join(__dirname, 'sessions', num), 'creds.json');
                        if (fs.existsSync(credsPath)) {
                            const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
                            await saveSessionToMongoDB(num, creds).catch(() => {});
                        }
                    } catch (_) {}
                }
                await autoFollowNewsletter(sock);
                await autoJoinGroup(sock);

                try { await sock.sendPresenceUpdate('available'); } catch (_) {}
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const loggedOut = statusCode === DisconnectReason.loggedOut;
                console.log('');
                console.log(`┃ ❌ [${num}] Déconnecté (code: ${statusCode})`);
                console.log('');
                if (pState.timeout) clearTimeout(pState.timeout);
                if (pState.renewTimer) clearTimeout(pState.renewTimer);

                if (pState.resolve) {
                    pState.resolve({ ok: false, error: 'Connection closed' });
                    pState.resolve = null;
                }

                if (loggedOut) {
                    console.log('');
                    console.log(hackerBanner(`${num} — LOGGED OUT`));
                    console.log('┃');
                    console.log('┃ 🚪 Session déconnectée de WhatsApp.');
                    console.log(`┃ 🗑️  Supprime: sessions/${num}/`);
                    console.log('┃ ▸ Ou relance le pairing.');
                    console.log(hackerEnd());
                    console.log('');
                    accounts.delete(num);
                    pairingState.delete(num);
                    reconnectMap.delete(num);
                    await deleteSessionFromMongoDB(num).catch(() => {});
                    // Supprime les credentials locaux corrompus
                    const sDir = path.join(__dirname, 'sessions', num);
                    if (fs.existsSync(sDir)) fs.rmSync(sDir, { recursive: true, force: true });
                    pushSSE({ type: 'disconnected', number: num });
                    // Auto-relance le pairing avec code après 3s
                    await sleep(3000);
                    console.log(`[PAIR][${num}] Auto-relance du pairing...`);
                    pairBot(num, true).catch(() => {});
                } else if (existingReconnects(num) < MAX_RECONNECT) {
                    incrementReconnects(num);
                    console.log(`┃ 🔄 [${num}] Reconnexion ${existingReconnects(num)}/${MAX_RECONNECT}...`);
                    pushSSE({ type: 'reconnecting', number: num, attempt: existingReconnects(num) });
                    await sleep(3000 * existingReconnects(num));
                    // ✅ préserve le mode : si un code avait été demandé, on régénère au reconnect
                    const keepCode = pState.code != null || usePairingCode;
                    pairBot(num, keepCode).catch(() => {});
                } else {
                    console.log(`┃ ❌ [${num}] Max reconnections atteint. Session perdue.`);
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
                    const jid = rawMsg.key?.remoteJid;
                    if (!jid || !rawMsg.message) continue;

                    const messageId = rawMsg.key?.id;
                    const isFromMe = rawMsg.key?.fromMe === true;

                    // Ignorer les messages envoyés automatiquement par le bot
                    if (isFromMe && messageId && botSentMessageIds.has(messageId)) {
                        console.log(`[BOT] Message auto ignoré : ${messageId}`);
                        continue;
                    }

                    console.log(`[MSG] JID=${jid} fromMe=${isFromMe ? 'OUI' : 'NON'}`);

                    // Statuts WhatsApp
                    if (jid === 'status@broadcast') {
                        if (config.AUTO_STATUS_REACT) {
                            await autoStatusReact(sock, rawMsg.key.remoteJid, rawMsg.key, num);
                        }
                        const userConfig = await getUserConfigFromMongoDB(num);
                        if (userConfig.AUTO_VIEW_STATUS === 'true') {
                            try { await sock.readMessages([rawMsg.key]); } catch (_) {}
                        }
                        if (userConfig.AUTO_STATUS_REPLY === 'true' && !rawMsg.key.fromMe) {
                            const statusSent = await sock.sendMessage(rawMsg.key.remoteJid, {
                                text: userConfig.AUTO_STATUS_MSG || AUTO_STATUS_MSG,
                            }, { quoted: rawMsg });
                            if (statusSent?.key?.id) botSentMessageIds.set(statusSent.key.id, true);
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

                    // ─── Affichage terminal style hacker ─────────────
                    if (body) {
                        const grp = m.chat?.endsWith('@g.us');
                        const senderName = m.sender?.split('@')[0] || '?';
                        const line = '━'.repeat(28);
                        console.log('');
                        console.log(line);
                        console.log(m.fromMe ? '📤 COMMANDE (fromMe)' : '📩 NOUVEAU MESSAGE');
                        console.log(line);
                        console.log(`Discussion : ${m.chat || '?'}`);
                        console.log(`Expéditeur : ${m.sender || '?'}`);
                        console.log(`Groupe     : ${grp ? 'OUI' : 'NON'}`);
                        console.log(`Message    : ${body}`);
                        console.log(line);
                        if (isCmd) {
                            console.log(`Commande : ${cmdName}`);
                            console.log(`Arguments: ${JSON.stringify(args)}`);
                        }
                        console.log(line);
                    }

                    const userConfig = await getUserConfigFromMongoDB(num);
                    if (userConfig.AUTO_TYPING === 'true') {
                        startAutoTyping(sock, m.chat);
                        setTimeout(() => stopAutoTyping(sock), 5000);
                    }
                    if (userConfig.AUTO_RECORDING === 'true') {
                        startAutoRecording(sock, m.chat);
                        setTimeout(() => stopAutoRecording(sock), 5000);
                    }
                    if (userConfig.READ_MESSAGE === 'true') {
                        try { await sock.readMessages([m.key]); } catch (_) {}
                    }

                    if (isCmd) {
                        incrementStats(num, 'messagesReceived').catch(() => {});
                        console.log(`[CMD] ${cmdName} args=${JSON.stringify(args)} from=${m.sender} jid=${m.chat}`);
                        await dispatchCommand(sock, m, cmdName, body, args, {
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
                    console.error(`┃ ❌ Erreur message: ${e.message}`);
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
                        const welcomeSent = await sock.sendMessage(update.id, { text: `👋 Welcome to *${metadata.subject}*!\n\n> ${FOOTER}` });
                        if (welcomeSent?.key?.id) botSentMessageIds.set(welcomeSent.key.id, true);
                    }
                    if (update.action === 'remove') {
                        const goodbyeSent = await sock.sendMessage(update.id, { text: `👋 Goodbye from *${metadata.subject}*.\n\n> ${FOOTER}` });
                        if (goodbyeSent?.key?.id) botSentMessageIds.set(goodbyeSent.key.id, true);
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
    const acc = num ? accounts.get(num) : null;
    let qr = pState?.qr;
    console.log(`[QR-IMG] number=${num} qr=${qr ? 'YES' : 'NO'} acc=${acc ? 'YES' : 'NO'} ready=${acc?.ready}`);

    // Si pas de QR en cache mais le bot tourne, retourne un placeholder
    if (!qr && acc?.sock) {
        try {
            // Force une nouvelle génération de QR
            const eventListeners = acc.sock.ev.listeners('connection.update');
            if (eventListeners.length > 0) {
                // Le QR sera disponible au prochain cycle
                console.log(`[QR-IMG] QR not ready yet, retrying...`);
                return res.status(202).json({ error: 'QR generating...', ready: false, retry: true });
            }
        } catch (_) {}
    }

    if (!qr) return res.status(404).json({ error: 'QR not ready', ready: false });
    try {
        const buf = await qrcode.toBuffer(qr, { width: 512, margin: 2 });
        console.log(`[QR-IMG] Sending QR image for ${num}`);
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

app.post('/api/purge-db', async (req, res) => {
    try {
        const { Session, UserConfig, OTP, ActiveNumber, Stats } = require('./lib/database.cjs');
        const s = await Session.deleteMany({});
        const u = await UserConfig.deleteMany({});
        const o = await OTP.deleteMany({});
        const a = await ActiveNumber.deleteMany({});
        const st = await Stats.deleteMany({});
        const sessDir = path.join(__dirname, 'sessions');
        if (fs.existsSync(sessDir)) fs.rmSync(sessDir, { recursive: true, force: true });
        for (const [num, acc] of accounts) {
            if (acc?.sock) { try { acc.sock.ev.removeAllListeners('connection.update'); acc.sock.end(); } catch (_) {} }
        }
        accounts.clear(); pairingState.clear(); reconnectMap.clear();
        res.json({
            ok: true,
            message: 'Database + sessions purged',
            deleted: { sessions: s.deletedCount, userConfigs: u.deletedCount, otps: o.deletedCount, activeNumbers: a.deletedCount, stats: st.deletedCount }
        });
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
        console.warn('┃ ⚠️  Pas de MongoDB URI — mode SQLite local');
    }

    loadPlugins();

    const isRender = !!process.env.RENDER;

    // ─── Démarrage serveur ───────────────────────────────────────────
    app.listen(PORT, '0.0.0.0', () => {
        const line = '━'.repeat(36);
        console.log('');
        console.log(hackerBanner('BOOT SEQUENCE'));
        console.log('┃');
        console.log(`┃ 🤖 Bot      : ${BOT_NAME}`);
        console.log(`┃ 📡 Port     : ${PORT}`);
        console.log(`┃ 📦 Commandes: ${commands.length}`);
        console.log(`┃ 🔧 SQLite   : ✅`);
        console.log(`┃ 🌐 Dashboard: http://localhost:${PORT}`);
        console.log(`┃ 🔗 Pair     : http://localhost:${PORT}/pair`);
        console.log(`┃ 📊 API      : http://localhost:${PORT}/api/status`);
        console.log('┃');
        console.log('┗' + line + '⍟');
        console.log('');
    });

    // ─── Auto-connect toutes les sessions sauvegardées ──────────────
    const sessionsDir = path.join(__dirname, 'sessions');
    if (fs.existsSync(sessionsDir)) {
        const savedNums = fs.readdirSync(sessionsDir).filter(d => {
            const full = path.join(sessionsDir, d);
            return fs.statSync(full).isDirectory() && /^\d+$/.test(d);
        });
        if (savedNums.length > 0) {
            console.log(`┃ 🔄 Auto-connexion: ${savedNums.length} session(s) sauvegardée(s)...`);
            for (const num of savedNums) {
                console.log(`┃ 📱 → ${num}`);
                await pairBot(num, false);
                await sleep(1500);
            }
            console.log('');
        }
    }

    // ─── Mode Render : pas de menu ──────────────────────────────────
    if (isRender) {
        return;
    }

    // ─── Mode Local : TOUJOURS demander un nouveau numéro ───────────
    const line = '━'.repeat(36);
    console.log(hackerBanner('NOUVELLE CONNEXION'));
    console.log('┃');
    console.log('┃  [1] QR Code');
    console.log('┃  [2] Code de jumelage (8 caractères)');
    console.log('┃');
    console.log(hackerEnd());
    console.log('');

    const method = await promptChoice('Choisis (1 ou 2)');

    let connectNumber = '';
    let usePairingCode = true;

    if (method === '1') {
        usePairingCode = false;
        console.log('');
        connectNumber = await promptNumber('Numéro WhatsApp (ex: 237693978044)');
        if (!connectNumber || connectNumber.length < 8) {
            console.log('┃ ❌ Numéro invalide.');
            connectNumber = '';
        } else {
            console.log('');
            console.log('┃ 📷 Mode QR Code sélectionné.');
            console.log('');
        }

    } else if (method === '2') {
        usePairingCode = true;
        console.log('');
        connectNumber = await promptNumber('Numéro WhatsApp (ex: 237693978044)');
        if (!connectNumber || connectNumber.length < 8) {
            console.log('┃ ❌ Numéro invalide.');
            connectNumber = '';
        }

    } else {
        console.log('┃ ❌ Choix invalide.');
        process.exit(1);
    }

    if (connectNumber) {
        await sleep(1000);
        await pairBot(connectNumber, usePairingCode);
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

// Restaure TOUS les comptes sauvegardés au démarrage (MongoDB + local)
async function autoReconnectFromMongoDB() {
    try {
        // 1) Récupère les numéros : Render = MongoDB, Local = scan sessions/
        const isRender = !!process.env.RENDER;
        let numbers = [];
        if (isRender && MONGODB_URI) {
            numbers = await getAllNumbersFromMongoDB();
        }

        // 2) Fallback : scan le dossier sessions/ local
        const sessionsDir = path.join(__dirname, 'sessions');
        if (numbers.length === 0 && fs.existsSync(sessionsDir)) {
            const dirs = fs.readdirSync(sessionsDir).filter(d => {
                const full = path.join(sessionsDir, d);
                return fs.statSync(full).isDirectory() && /^\d+$/.test(d);
            });
            if (dirs.length > 0) {
                numbers = dirs;
                console.log(`┃ 📂 ${dirs.length} session(s) locale(s) trouvée(s)`);
            }
        }

        if (numbers.length === 0) {
            console.log('┃ ℹ️  Aucune session sauvegardée');
            return;
        }

        // Keep only the most recent session if multiple exist
        if (numbers.length > 1) {
            console.log(`┃ 📋 ${numbers.length} sessions trouvées, garde la plus récente: ${numbers[numbers.length - 1]}`);
            const keep = numbers[numbers.length - 1];
            for (const num of numbers) {
                if (num !== keep) {
                    if (MONGODB_URI) await removeNumberFromMongoDB(num).catch(() => {});
                    const sDir = path.join(__dirname, 'sessions', num);
                    if (fs.existsSync(sDir)) fs.rmSync(sDir, { recursive: true, force: true });
                }
            }
            numbers = [keep];
        }

        console.log(`┃ 📂 ${numbers.length} session(s) trouvée(s). Auto-connexion...`);
        await sleep(3000);
        for (const num of numbers) {
            const sessPath = path.join(__dirname, 'sessions', num, 'creds.json');
            // Si pas de creds locaux, restaure depuis MongoDB (Render uniquement)
            if (!fs.existsSync(sessPath) && isRender && MONGODB_URI) {
                console.log(`[AUTO] Restoring ${num} from MongoDB...`);
                try {
                    const creds = await getSessionFromMongoDB(num);
                    if (creds) {
                        const sessionDir = path.join(__dirname, 'sessions', num);
                        if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
                        fs.writeFileSync(path.join(sessionDir, 'creds.json'), JSON.stringify(creds, null, 2));
                        console.log(`[AUTO] Restored creds for ${num} from MongoDB`);
                    } else {
                        console.log(`[AUTO] No session in MongoDB for ${num}, skipping`);
                        continue;
                    }
                } catch (e) {
                    console.error(`[AUTO] Failed to restore ${num} from MongoDB:`, e.message);
                    continue;
                }
            }
            if (!fs.existsSync(sessPath)) {
                console.log(`┃ ⚠️  Pas de credentials pour ${num}, skip`);
                continue;
            }
            await pairBot(num, false);
            await sleep(2000);
        }
    } catch (e) {
        console.error('┃ ❌ Auto-reconnect échoué:', e.message);
    }
}

(async () => {
    try {
        await startServer();
        // autoReconnect géré par startServer (scan sessions/)
    } catch (e) {
        console.error('[FATAL]', e.message);
        saveCrash(e);
        process.exit(1);
    }
})();

// ─── Menu Hacker ───────────────────────────────────────────────────────────
app.get('/api/menu', (req, res) => {
    const cats = {};
    let i = 0;
    for (const cmd of commands) {
        const cat = (cmd.category || 'other').toUpperCase();
        if (!cats[cat]) cats[cat] = [];
        if (cmd.pattern) {
            cats[cat].push(cmd.pattern.toLowerCase());
            i++;
        }
        if (cmd.alias) {
            for (const a of cmd.alias) {
                cats[cat].push(a.toLowerCase());
                i++;
            }
        }
    }
    const result = {};
    for (const [cat, list] of Object.entries(cats)) {
        result[cat] = [...new Set(list)].sort();
    }
    res.json({
        ok: true,
        botName: BOT_NAME,
        ownerName: OWNER_NAME,
        total: i,
        categories: Object.keys(result).sort(),
        commands: result,
        uptime: process.uptime(),
        memory: (process.memoryUsage().rss / 1048576).toFixed(1) + ' MB',
        connectedAccounts: [...accounts.values()].filter(a => a.ready).length,
    });
});

app.get('/menu', (req, res) => {
    const menuPath = path.join(__dirname, 'public', 'menu.html');
    if (fs.existsSync(menuPath)) return res.sendFile(menuPath);
    res.status(404).send('Menu page not found');
});

module.exports = app;