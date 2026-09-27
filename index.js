/**
 * DJOUSSE TECH MD — Command Center Entry Point
 * Intègre: TUI + Session Manager + Event Bus + AINORIA
 */

process.env.PUPPETEER_SKIP_DOWNLOAD = 'true';
process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = 'true';

require('dotenv').config();

const { TUI } = require('./lib/tui.cjs');
const tui = new TUI({ version: require('./package.json').version });
const bus = require('./src/core/eventBus');
const sessionManager = require('./src/sessions/sessionManager');
const ainoria = require('./src/ainoria/ainoria');

const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers
} = require('@itsukichan/baileys');
// Version WA officielle : la version du fork (baileys-version.json) est périmée
// et WhatsApp rejette la connexion (failure reason 405) — cf. diagnostic 26/09/2026.
const { fetchLatestBaileysVersion, fetchLatestWaWebVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const config = require('./config');
const handler = require('./handler');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ─── TUI : compteurs + statuts (wiring unique, jamais par reconnexion) ───
bus.on('message:received', () => tui.incrementMessagesReceived());
bus.on('command:executed', () => tui.incrementCommands());
const _setStatus = sessionManager.setStatus.bind(sessionManager);
sessionManager.setStatus = (sessionId, status) => {
  _setStatus(sessionId, status);
  tui.setStatus(status);
};

const processedMessages = new Set();
setInterval(() => processedMessages.clear(), 5 * 60 * 1000);

// ─── Anti-boucle reconnexion (440 CONFLICT) + timers une seule fois ───
let conflictCount = 0;
let conflictStableTimer = null;
const CONFLICT_MAX_RETRIES = 8;
// ─── Pairing : MAX_PAIRING_ATTEMPTS = émissions de code (requestPairingCode),
//     les reconnexions normales ne comptent PAS comme tentative ───
let pairingAttempts = 0;
let pairingCodeRequested = false; // verrou : un seul code actif à la fois
let pairingTimeoutTimer = null;   // expiration du code en attente
let handshakeFailCount = 0;       // échecs consécutifs 405 (handshake rejeté)
let sessionEpoch = 0;             // anti-démarrage concurrent → jamais 2 sockets
const MAX_PAIRING_ATTEMPTS = 3;
const PAIRING_TIMEOUT = 60 * 1000;
const MAX_405_RETRIES = 5;
let weeklyStatsInterval = null;
let statusTestRan = false;
let activeSock = null;
let activeWatchdog = null;

/* ═══════════════════════════════════════════════════════════════
   FILTRE : Ignore les erreurs Bad MAC de libsignal
   ═══════════════════════════════════════════════════════════════ */

const IGNORED_ERRORS = [
  'Bad MAC', 'Failed to decrypt', 'Session error', 'libsignal',
  'session_cipher', 'decryptWithSessions', 'doDecryptWhisperMessage',
  'MessageCounterError', 'Closing open session', 'Closing session',
  'Key used already', 'Invalid PreKey', 'Duplicate Message',
];

function isIgnoredError(msg) {
  if (!msg) return false;
  const str = typeof msg === 'string' ? msg : (msg.message || JSON.stringify(msg));
  return IGNORED_ERRORS.some(kw => str.includes(kw));
}

const originalConsoleError = console.error.bind(console);
console.error = (...args) => {
  if (isIgnoredError(args[0])) return;
  originalConsoleError(...args);
};

const originalConsoleWarn = console.warn.bind(console);
console.warn = (...args) => {
  if (isIgnoredError(args[0])) return;
  originalConsoleWarn(...args);
};

const originalConsoleLog = console.log.bind(console);
console.log = (...args) => {
  if (args[0] && typeof args[0] === 'object' && args[0].stack && isIgnoredError(args[0].stack)) return;
  if (typeof args[0] === 'string' && isIgnoredError(args[0])) return;
  originalConsoleLog(...args);
};

/* ═══════════════════════════════════════════════════════════════
   READLINE — Choix de méthode de connexion
   ═══════════════════════════════════════════════════════════════ */
const readline = require('readline');

function askQuestion(query) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(query, ans => { rl.close(); resolve(ans.trim()); }));
}

async function askConnectionMethod() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║       DJOUSSE TECH — CONNEXION WHATSAPP     ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║  1 │ QR Code     — Scanner avec le téléphone ║');
  console.log('║  2 │ Pairing Code — Saisir un code 8 chiffres║');
  console.log('╚══════════════════════════════════════════════╝\n');
  const choice = await askQuestion('Choix [1/2]: ');
  if (choice === '2') {
    const phone = await askQuestion('Numéro WhatsApp (ex: 237693978044): ');
    const clean = phone.replace(/[^0-9]/g, '');
    if (!clean || clean.length < 8) {
      console.log('❌ Numéro invalide. Fallback QR Code.');
      return { method: 'qr' };
    }
    return { method: 'pairing', phone: clean };
  }
  return { method: 'qr' };
}

process.on('uncaughtException', (err) => {
  if (isIgnoredError(err.message) || isIgnoredError(err.stack)) return;
  originalConsoleError('[UNCAUGHT]', err.message);
});

process.on('unhandledRejection', (reason) => {
  const msg = reason?.message || String(reason);
  if (isIgnoredError(msg)) return;
  originalConsoleError('[UNHANDLED]', msg);
});

// ─── Arrêt auto des schedulers en cas de restriction ───
process.on('whatsapp:stop-all', ({ reason } = {}) => {
  console.log(`[SOCKET] 🛑 Arrêt de tous les schedulers — ${reason || 'inconnu'}`);
  try {
    const statusQuotes = require('./utils/statusQuotes');
    statusQuotes.stopScheduler('default');
    statusQuotes.stopCacheRefresh();
  } catch {}
});

const createSuppressedLogger = (level = 'silent') => {
  let logger;
  try {
    logger = pino({
      level,
      transport: process.env.NODE_ENV === 'production' ? undefined : {
        target: 'pino-pretty',
        options: { colorize: true, ignore: 'pid,hostname' }
      }
    });
  } catch (err) {
    logger = pino({ level });
  }
  logger.debug = () => {};
  logger.trace = () => {};
  return logger;
};

const store = {
  messages: new Map(),
  maxPerChat: 20,
  bind: (ev) => {
    ev.on('messages.upsert', ({ messages }) => {
      for (const msg of messages) {
        if (!msg.key?.id) continue;
        const jid = msg.key.remoteJid;
        if (!store.messages.has(jid)) store.messages.set(jid, new Map());
        const chatMsgs = store.messages.get(jid);
        chatMsgs.set(msg.key.id, msg);
        if (chatMsgs.size > store.maxPerChat) {
          const oldestKey = chatMsgs.keys().next().value;
          chatMsgs.delete(oldestKey);
        }
      }
    });
  },
  loadMessage: async (jid, id) => store.messages.get(jid)?.get(id) || null
};

/* ═══════════════════════════════════════════════════════════════
   VERSION WHATSAPP — chaîne de repli (jamais de version en dur seule)
   1. fetchLatestBaileysVersion()  → GitHub WhiskeySockets (compatible avec
      la version installée — validée par test QR le 26/09/2026)
   2. fetchLatestWaWebVersion()    → endpoint officiel web.whatsapp.com
      (si GitHub inaccessible)
   3. env WA_VERSION               → surcharge manuelle (ex: "2,3000,1043857760")
   4. STABLE_WA_VERSION            → version connue fonctionnelle (test QR reçu)
   Les deux fonctions ne lèvent JAMAIS d'erreur : en cas d'échec elles renvoient
   silencieusement la version embarquée du paquet [2,3000,1023223821] (périmée,
   → rejet 405). D'où le test obligatoire du flag isLatest.
   ═══════════════════════════════════════════════════════════════ */
const STABLE_WA_VERSION = [2, 3000, 1043857760];

async function resolveWAVersion() {
  const opts = { timeout: 8000 };
  try {
    const r = await fetchLatestBaileysVersion(opts);
    if (r?.isLatest && Array.isArray(r.version) && r.version.length === 3) {
      console.log(`[WA] Version : ${r.version.join('.')} (github WhiskeySockets)`);
      return r.version;
    }
  } catch {}
  try {
    const r = await fetchLatestWaWebVersion(opts);
    if (r?.isLatest && Array.isArray(r.version) && r.version.length === 3) {
      console.log(`[WA] Version : ${r.version.join('.')} (web.whatsapp.com/sw.js)`);
      return r.version;
    }
  } catch {}
  if (process.env.WA_VERSION) {
    const v = process.env.WA_VERSION.split(',').map(n => parseInt(n.trim(), 10));
    if (v.length === 3 && v.every(Number.isFinite)) {
      console.log(`[WA] Version : ${v.join('.')} (env WA_VERSION)`);
      return v;
    }
  }
  console.warn(`⚠️ [WA] Sources de version injoignables — repli version connue: ${STABLE_WA_VERSION.join('.')}`);
  return STABLE_WA_VERSION;
}

async function startSession(sessionId, options = {}) {
  const epoch = ++sessionEpoch;
  const sessionDir = path.join(__dirname, sessionId);
  // ═══ CORRECTIF : garantir l'existence du dossier session ═══
  // Protège les écritures (saveCreds/purge) si le dossier a été supprimé
  // pendant que le bot tournait — le fork mkdir aussi, ceci est redondant
  // mais infaillible avant la moindre écriture.
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
    console.log(`[SESSION] 📁 Dossier recréé : ${sessionDir}`);
  }
  sessionManager.createSession(sessionId, { ...options, status: 'INITIALIZING' });

  // Handle session ID import
  if (options.sessionID && options.sessionID.startsWith('DJOUSSE!')) {
    try {
      const [, b64data] = options.sessionID.split('!');
      if (b64data) {
        const cleanB64 = b64data.replace('...', '');
        const compressedData = Buffer.from(cleanB64, 'base64');
        const decompressedData = zlib.gunzipSync(compressedData);
        if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
        fs.writeFileSync(path.join(sessionDir, 'creds.json'), decompressedData, 'utf8');
      }
    } catch (e) {
      bus.emit('system:error', { source: 'session', error: e.message });
    }
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const version = await resolveWAVersion();
  const suppressedLogger = createSuppressedLogger('silent');

  // Déterminer la méthode de connexion (QR et pairing strictement séparés)
  const connectMethod = options.connectMethod || 'qr';
  const isPairing = connectMethod === 'pairing';
  console.log(`[AUTH] Méthode : ${isPairing ? 'PAIRING' : 'QR'}`);

  // creds.me présent mais registered:false → Baileys appellerait
  // generateLoginNode au lieu de generateRegistrationNode → rejet 401 en boucle.
  // Purge ciblée me/pairingCode pour repartir d'une registration propre.
  // Garde-fou PROBLÈME 8 : ne s'exécute QUE si registered:false —
  // une session valide (registered:true) n'est JAMAIS supprimée ici.
  if (!state.creds.registered && state.creds.me) {
    try {
      const credsPath = path.join(sessionDir, 'creds.json');
      const raw = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
      delete raw.me;
      delete raw.pairingCode;
      raw.registered = false;
      fs.writeFileSync(credsPath, JSON.stringify(raw, null, 2));
      delete state.creds.me;
      delete state.creds.pairingCode;
      state.creds.registered = false;
      console.log('[PAIRING] 🧹 Ancien creds.me purgé (retry après échec) — registration propre.');
    } catch (e) {
      console.error('[PAIRING] Erreur purge creds:', e.message);
    }
  }

  sessionManager.setStatus(sessionId, 'CONNECTING');
  bus.emit('session:connecting', { sessionId });

  // Protection sockets dupliqués : si un démarrage plus récent s'est lancé
  // pendant nos awaits (auth/version), on abandonne ce cycle.
  if (epoch !== sessionEpoch) {
    console.log('[SOCKET] ⏭️ Démarrage annulé — un cycle plus récent est déjà actif (anti-doublon).');
    return null;
  }

  // Détruire l'ancien socket AVANT d'en créer un nouveau (évite les conflits 440 internes)
  if (activeWatchdog) {
    clearInterval(activeWatchdog);
    activeWatchdog = null;
  }
  if (activeSock) {
    try { activeSock.ev.removeAllListeners(); } catch {}
    try { activeSock.end(undefined); } catch {}
    try { activeSock.ws?.close(); } catch {}
    activeSock = null;
    global.__activeSock = null;
  }

  const sock = makeWASocket({
    version,
    logger: suppressedLogger,
    browser: ['DJOUSSE TECH', 'Chrome', '1.0'],
    printQRInTerminal: false,
    auth: state,
    syncFullHistory: false,
    downloadHistory: false,
    markOnlineOnConnect: false,
    getMessage: async () => undefined
  });
  activeSock = sock;
  global.__activeSock = sock;
  // Compteur TUI « messages envoyés » : point d'unique, pass-through strict
  const _sendMessage = sock.sendMessage.bind(sock);
  sock.sendMessage = async (...sendArgs) => {
    const _res = await _sendMessage(...sendArgs);
    tui.incrementMessagesSent();
    return _res;
  };

  store.bind(sock.ev);
  sessionManager.setSocket(sessionId, sock);
  // Sauvegarde des credentials à chaque creds.update (obligatoire — sans elle,
  // la progression est perdue). Anti-ENOENT : recrée le dossier s'il a disparu
  // pendant la session (suppression externe pendant exécution), sinon
  // le rejet devient [UNHANDLED] et les credentials ne sont pas écrits.
  sock.ev.on('creds.update', async () => {
    try {
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
        console.log('[SESSION] 📁 Dossier session recréé avant sauvegarde creds.');
      }
      await saveCreds();
    } catch (e) {
      console.error('[SESSION] ❌ Erreur sauvegarde creds:', e.message);
    }
  });

  let lastActivity = Date.now();
  const INACTIVITY_TIMEOUT = 30 * 60 * 1000;

  sock.ev.on('messages.upsert', () => { lastActivity = Date.now(); });

  const watchdogInterval = setInterval(async () => {
    if (Date.now() - lastActivity > INACTIVITY_TIMEOUT && (sock.ws?.isOpen === true || sock.ws?.socket?.readyState === 1)) {
      bus.emit('session:reconnecting', { sessionId, reason: 'inactivity' });
      await sock.end(undefined, undefined, { reason: 'inactive' });
      clearInterval(watchdogInterval);
      setTimeout(() => startSession(sessionId, options), 5000);
    }
  }, 5 * 60 * 1000);
  activeWatchdog = watchdogInterval;

  sock.ev.on('connection.update', (update) => {
    if (update.connection === 'open') lastActivity = Date.now();
    else if (update.connection === 'close') clearInterval(watchdogInterval);
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      // En mode pairing : ignorer l'event qr (le code est déjà demandé en direct)
      if (isPairing) {
        sessionManager.setStatus(sessionId, 'WAITING_FOR_PAIRING');
      } else {
        sessionManager.setStatus(sessionId, 'WAITING_FOR_QR');
        bus.emit('session:qr', { sessionId });
        console.log('\n╔══════════════════════════════════════════════╗');
        console.log('║       DJOUSSE TECH — CONNEXION QR            ║');
        console.log('╠══════════════════════════════════════════════╣');
        console.log('║ WhatsApp                                     ║');
        console.log('║ → Appareils liés                             ║');
        console.log('║ → Connecter un appareil                      ║');
        console.log('║ → Scanner le QR                              ║');
        console.log('╚══════════════════════════════════════════════╝');
        qrcode.generate(qr, { small: true });
      }
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const wasRegisteredClose = !!(state?.creds?.registered);
      // Nettoyer le timer d'expiration du code pairing (le cycle se termine ici)
      if (pairingTimeoutTimer) { clearTimeout(pairingTimeoutTimer); pairingTimeoutTimer = null; }
      // 401 pendant pairing (non-enregistré) → on autorise le retry pour un nouveau code,
      // MAIS sans dépasser MAX_PAIRING_ATTEMPTS (sinon boucle infinie de codes)
      const pairingExhausted = isPairing && !wasRegisteredClose && pairingAttempts >= MAX_PAIRING_ATTEMPTS;
      const shouldReconnect = !pairingExhausted && (statusCode !== DisconnectReason.loggedOut || !wasRegisteredClose);
      const failData = lastDisconnect?.error?.data ? ` | attrs: ${JSON.stringify(lastDisconnect.error.data)}` : '';
      console.log(`[SOCKET] 🔌 Fermeture (code=${statusCode ?? 'inconnu'}${lastDisconnect?.error?.message ? ` — ${lastDisconnect.error.message}` : ''}${failData}`);

      // La connexion n'a pas tenu 60s → on n'autorise pas le reset du compteur 440
      if (conflictStableTimer) {
        clearTimeout(conflictStableTimer);
        conflictStableTimer = null;
      }

      // ─── Détection restriction WhatsApp ───
      // 440 = conflict (session remplacée / autre instance) → reconnexion avec backoff, PAS restriction
      // 401 = logged out, 403 = banned → restriction UNIQUEMENT si la session était enregistrée.
      // En pairing (registered: false), un 401 = rejet du pairing (rate-limit / code expiré),
      // PAS une restriction de compte → ne pas poser le flag.
      const wasRegistered = !!(state?.creds?.registered);
      if ((statusCode === 401 || statusCode === 403) && wasRegistered) {
        console.error(`🚨 COMPTE RESTREINT — code ${statusCode}`);
        try {
          const antiBan = require('./lib/anti-ban.cjs');
          antiBan.setRestricted(`Connection closed with code ${statusCode}`, statusCode);
          process.emit('whatsapp:stop-all', { reason: `restriction_${statusCode}` });
        } catch {}
      } else if (statusCode === 401 && !wasRegistered) {
        console.error(`[PAIRING] ❌ Pairing rejeté (code 401) — session non enregistrée. Reset creds.me pour retry propre.`);
        try {
          const antiBan = require('./lib/anti-ban.cjs');
          antiBan.clearRestricted();
        } catch {}
        // BUG Baileys: requestPairingCode sauvegarde creds.me → au retry,
        // validateConnection appelle generateLoginNode au lieu de
        // generateRegistrationNode → WhatsApp rejette en 401 en boucle.
        // Fix: retirer me/pairingCode pour repartir de l'état "non connecté".
        try {
          const credsPath = path.join(sessionDir, 'creds.json');
          if (fs.existsSync(credsPath)) {
            const raw = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
            delete raw.me;
            delete raw.pairingCode;
            raw.registered = false;
            fs.writeFileSync(credsPath, JSON.stringify(raw, null, 2));
            console.log('[PAIRING] 🧹 creds.me/pairingCode purgés — prochaine tentative = registration propre.');
          }
        } catch (e) {
          console.error('[PAIRING] Erreur reset creds:', e.message);
        }
      }

      if (statusCode === DisconnectReason.loggedOut && wasRegisteredClose) {
        sessionManager.setStatus(sessionId, 'LOGGED_OUT');
        bus.emit('session:logged-out', { sessionId });
      } else {
        sessionManager.setStatus(sessionId, 'DISCONNECTED');
        bus.emit('session:disconnected', { sessionId, statusCode });
        if (pairingExhausted) {
          // PROBLÈME 5 : après MAX_PAIRING_ATTEMPTS codes émis → STOP (pas de boucle)
          console.error(`[PAIRING] ❌ ${MAX_PAIRING_ATTEMPTS} tentatives épuisées — Le code de pairing a expiré.`);
          console.error('   Veuillez relancer une nouvelle tentative (vérifiez le numéro, puis redémarrez le bot).');
          bus.emit('session:pairing-failed', { sessionId, attempts: pairingAttempts });
        } else if (shouldReconnect) {
          // Décision par code explicite (cf. DisconnectReason) — pas de reconnect() aveugle :
          //   440 connectionReplaced → backoff exponentiel (autre instance détient la session)
          //   401 loggedOut          → registered: LOGGED_OUT / non-enregistré: rejet pairing (escalier)
          //   405 <failure>          → handshake rejeté (version/rate-limit) : escalier puis STOP
          //   408 timedOut           → coupure réseau transitoire : reconnexion courte
          //   428 connectionClosed   → serveur a fermé : reconnexion standard (3s)
          //   515 restartRequired    → redémarrage normal du socket : rapide
          //   503 unavailableService → service WhatsApp indisponible : attendre 30s
          let delay = 3000;
          if (statusCode === 440) {
            conflictCount++;
            delay = Math.min(60000, 3000 * Math.pow(2, Math.min(conflictCount, 5)));
            console.log(`⚠️ CONFLICT (440) — tentative ${conflictCount}/${CONFLICT_MAX_RETRIES} — reconnexion dans ${delay / 1000}s...`);
            if (conflictCount >= CONFLICT_MAX_RETRIES) {
              console.error('🛑 CONFLICT (440) persistant — un autre appareil ou une autre instance détient la session.');
              console.error('   → Fermez l\'autre session/instance, puis redémarrer le bot.');
              sessionManager.setStatus(sessionId, 'CONFLICT');
              bus.emit('session:disconnected', { sessionId, statusCode, fatal: true });
              return;
            }
          } else if (statusCode === 401 && !wasRegisteredClose) {
            // Pairing rejeté → cooldown escalier pour éviter le rate-limit WhatsApp.
            // pairingAttempts est incrémenté à l'ÉMISSION du code (bloc pairing),
            // PAS ici : une reconnexion normale ne compte pas comme tentative.
            const pairingDelays = [60000, 120000, 300000];
            delay = pairingDelays[Math.min(Math.max(pairingAttempts, 1), pairingDelays.length) - 1];
            console.log(`[PAIRING] 🔁 Retry pairing dans ${delay / 1000}s... (tentative ${pairingAttempts}/${MAX_PAIRING_ATTEMPTS})`);
          } else if (statusCode === 405) {
            handshakeFailCount++;
            const ladder405 = [15000, 60000, 300000];
            delay = ladder405[Math.min(handshakeFailCount, ladder405.length) - 1];
            console.log(`⚠️ HANDSHAKE REJETÉ (405) — tentative ${handshakeFailCount}/${MAX_405_RETRIES} — reconnexion dans ${delay / 1000}s...`);
            if (handshakeFailCount >= MAX_405_RETRIES) {
              console.error('🛑 405 persistant — vérifiez la connexion réseau puis redémarrez le bot (la version WA est re-récupérée automatiquement).');
              bus.emit('session:disconnected', { sessionId, statusCode, fatal: true });
              return;
            }
          } else if (statusCode === 408) {
            delay = 5000;
          } else if (statusCode === 515) {
            // restartRequired : WhatsApp demande un redémarrage de stream —
            // normal (1ère connexion / companion). Reconnexion quasi immédiate,
            // sans perdre la progression (creds déjà écrits par creds.update).
            delay = 500;
            console.log('[SOCKET] 🔄 Stream error (515) — redémarrage immédiat du socket...');
          } else if (statusCode === 503) {
            delay = 30000;
          }
          // PROBLÈME 5bis : pendant un pairing en attente, JAMAIS de reconnexion agressive
          if (isPairing && !wasRegisteredClose && pairingAttempts > 0) {
            delay = Math.max(delay, 60000);
          }
          sessionManager.setStatus(sessionId, 'RECONNECTING');
          bus.emit('session:reconnecting', { sessionId, statusCode });
          console.log(`[SOCKET] 🔁 Reconnexion dans ${delay / 1000}s...`);
          setTimeout(() => startSession(sessionId, options), delay);
        }
      }
    } else if (connection === 'open') {
      console.log('[SOCKET] ✅ CONNECTÉ —', sock.user?.id || 'session active');
      // Connexion réussie → tous les compteurs d'échec repartent à zéro
      pairingAttempts = 0;
      pairingCodeRequested = false;
      handshakeFailCount = 0;
      if (pairingTimeoutTimer) { clearTimeout(pairingTimeoutTimer); pairingTimeoutTimer = null; }
      // Reset du compteur 440 UNIQUEMENT après 60s de connexion stable
      // (un open immédiat suivi d'un 440 ne doit pas remettre le compteur à zéro)
      if (conflictStableTimer) clearTimeout(conflictStableTimer);
      conflictStableTimer = setTimeout(() => {
        conflictCount = 0;
        conflictStableTimer = null;
      }, 60 * 1000);
      const phone = sock.user.id.split(':')[0];
      sessionManager.updateSession(sessionId, { phone, status: 'CONNECTED' });
      sessionManager.setStatus(sessionId, 'CONNECTED');
      tui.setPhone(phone);
      bus.emit('session:connected', { sessionId, phone });

      if (config.autoBio) {
        await sock.updateProfileStatus(`${config.botName} | Actif 24/7`).catch(() => {});
      }

      handler.initializeAntiCall(sock);

      // Initialize anti-ban system
      try {
        const antiBan = require('./lib/anti-ban.cjs');
        antiBan.init(sock);
        // Connexion réussie → la restriction précédente (401/403) est levée
        antiBan.clearRestricted();
      } catch (e) {}

      // Initialize human presence simulation
      try {
        const presence = require('./lib/presence.cjs');
        presence.init(sock);
      } catch (e) {}

      // Initialize silent automatisms (auto-read, backup, health, purge)
      try {
        const silentAuto = require('./lib/silent-automations.cjs');
        silentAuto.init(sock);
      } catch (e) {}

      // Initialize reaction automatisms
      try {
        const reactionAuto = require('./lib/reaction-automations.cjs');
        reactionAuto.init(sock);
      } catch (e) {}

      // Initialize status rotator
      try {
        const statusRotator = require('./lib/status-rotator.cjs');
        statusRotator.startRotator(() => sock);
      } catch (e) {}

      // Initialize weekly stats check (timer unique — pas de fuite à chaque reconnexion)
      try {
        const { sendWeeklyStats } = require('./lib/weekly-stats.cjs');
        if (weeklyStatsInterval) clearInterval(weeklyStatsInterval);
        weeklyStatsInterval = setInterval(() => sendWeeklyStats(sock), 300000); // Check every 5 min
      } catch (e) {}

      // Initialize reminder scheduler
      try {
        const { startReminderScheduler } = require('./lib/reminder-scheduler.cjs');
        startReminderScheduler(() => sock);
      } catch (e) {}

      // Initialize auto view-once saver
      try {
        const viewOnceSaver = require('./lib/view-once.cjs');
        viewOnceSaver.init(sock);
      } catch (e) {}

      // Auto-initialize status reaction listener (exact copy from iluser/autoreact-whatsapp)
      try {
        const autoreact = require('./lib/autoreact.cjs');
        autoreact.init(sock);
      } catch (e) {
        console.log('[AUTO-REACT] Init skipped:', e.message);
      }

      // Initialize Status Quotes (FORCÉ — indépendant de config.statusQuotes)
      try {
        const statusQuotes = require('./utils/statusQuotes');
        statusQuotes.startCacheRefresh(config.statusQuotes?.cacheRefreshHours || 6);

        // Force enabled = true dans le fichier session
        statusQuotes.updateSessionConfig(sessionId, { enabled: true });
        console.log('[STATUS-QUOTE] ✅ Config session forcée: enabled=true');

        // Redémarre le scheduler avec le socket courant (l'ancien timer tient un sock mort après reconnexion)
        statusQuotes.stopScheduler(sessionId);
        statusQuotes.startScheduler(sock, sessionId);

        // Test de publication une seule fois par processus (pas à chaque reconnexion)
        if (!statusTestRan) {
          statusTestRan = true;
          setTimeout(async () => {
            try {
              console.log('[STATUS-QUOTE] 🧪 Test de publication automatique…');
              await statusQuotes.forcePublishNow(sock, sessionId);
            } catch (e) {
              console.error('[STATUS-QUOTE] Test échoué:', e.message);
            }
          }, 2 * 60 * 1000); // 2 minutes
        }

      } catch (e) {
        console.error('[STATUS-QUOTE] Init error:', e.message, e.stack);
      }

      // 🧪 Auto-test .menu : si le fichier database/SELF_TEST existe → simule ".menu" envoyé par le owner
      try {
        const selfTestTrigger = path.join(__dirname, 'database', 'SELF_TEST');
        if (fs.existsSync(selfTestTrigger)) {
          fs.unlinkSync(selfTestTrigger);
          console.log('[SELF-TEST] 🧪 Déclenchement — simulation de ".menu" (owner)…');
          setTimeout(async () => {
            try {
              const selfJid = `${sock.user?.id?.split(':')[0]}@s.whatsapp.net`;
              const fakeMsg = {
                key: {
                  remoteJid: selfJid,
                  fromMe: false,
                  id: `SELFTEST${Date.now().toString(36).toUpperCase()}`
                },
                message: { conversation: `${config.prefix}menu` },
                messageTimestamp: Math.floor(Date.now() / 1000)
              };
              await handler.handleMessage(sock, fakeMsg);
              console.log('[SELF-TEST] ✅ .menu exécuté — la réponse doit arriver dans le chat "vous-même"');
            } catch (e) {
              console.error('[SELF-TEST] ❌', e.message);
            }
          }, 5000);
        }
      } catch (e) {
        console.error('[SELF-TEST] ❌', e.message);
      }

      // Clean old messages
      const now = Date.now();
      for (const [jid, chatMsgs] of store.messages.entries()) {
        const timestamps = Array.from(chatMsgs.values()).map(m => m.messageTimestamp * 1000 || 0);
        if (timestamps.length > 0 && now - Math.max(...timestamps) > 24 * 60 * 60 * 1000) {
          store.messages.delete(jid);
        }
      }
    }
  });

  const isSystemJid = (jid) => {
    if (!jid) return true;
    return jid.includes('@broadcast') || jid.includes('status.broadcast') || jid.includes('@newsletter');
  };

  sock.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message || !msg.key?.id) continue;
      const from = msg.key.remoteJid;
      if (!from || isSystemJid(from)) continue;

      const msgId = msg.key.id;
      if (processedMessages.has(msgId)) continue;

      const MESSAGE_AGE_LIMIT = 5 * 60 * 1000;
      if (msg.messageTimestamp) {
        const messageAge = Date.now() - (msg.messageTimestamp * 1000);
        if (messageAge > MESSAGE_AGE_LIMIT) continue;
      }

      processedMessages.add(msgId);
      sessionManager.incrementStat(sessionId, 'messagesReceived');

      // Diagnostic : tracer chaque message reçu
      try {
        const preview = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').slice(0, 60);
        console.log(`[MSG] ${msg.key.fromMe ? 'fromMe' : 'REÇU'} → ${from}${preview ? ` :: ${preview}` : ''}`);
      } catch {}

      bus.emit('message:received', {
        sessionId,
        from,
        sender: msg.key.participant || msg.key.remoteJid,
        isGroup: from.endsWith('@g.us'),
        messageId: msgId,
      });

      handler.handleMessage(sock, msg).catch(err => {
        if (!err.message?.includes('rate-overlimit')) {
          sessionManager.incrementStat(sessionId, 'errors');
          bus.emit('system:error', { source: 'handler', sessionId, error: err.message });
        }
      });

      setImmediate(async () => {
        if (config.autoRead && from.endsWith('@g.us')) {
          try { await sock.readMessages([msg.key]); } catch (e) {}
        }
        if (from.endsWith('@g.us')) {
          try {
            const groupMetadata = await handler.getGroupMetadata(sock, msg.key.remoteJid);
            if (groupMetadata) {
              await handler.handleAntilink?.(sock, msg, groupMetadata);
            }
          } catch (error) {}
        }
      });
    }
  });

  sock.ev.on('group-participants.update', async (update) => {
    await handler.handleGroupUpdate(sock, update);
  });

  // Anti-delete: intercepte les messages supprimés et les renvoie
  sock.ev.on('messages.update', async (updates) => {
    if (!config.ANTI_DELETE) return;
    for (const update of updates) {
      try {
        if (!update.update?.message) continue;
        const key = update.key;
        if (!key?.id || !key?.remoteJid) continue;
        if (key.remoteJid === 'status@broadcast') continue;
        if (key.fromMe) continue;

        const original = await store.loadMessage(key.remoteJid, key.id);
        if (!original || !original.message) continue;

        const sender = key.participant || key.remoteJid;
        const chatJid = key.remoteJid;
        const isGroup = chatJid.endsWith('@g.us');

        const { getContentType } = require('@itsukichan/baileys');
        const msgType = getContentType(original.message);
        if (!msgType) continue;

        const caption = original.message[msgType]?.caption || '';
        const text = original.message.conversation || original.message.extendedTextMessage?.text || '';
        const displayText = caption || text;

        const tag = sender.split('@')[0];
        const header = `🗑️ *Message supprimé détecté*\n👤 De: @${tag}\n⏰ Heure: ${new Date(original.messageTimestamp * 1000).toLocaleTimeString('fr-FR')}\n`;

        if (['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'].includes(msgType)) {
          const buffer = await sock.downloadMediaMessage({ key: original.key, message: original.message });
          if (buffer) {
            const mediaType = msgType.replace('Message', '').toLowerCase();
            const sendObj = { [mediaType]: buffer, caption: header + (caption ? `\n📝 ${caption}` : '') };
            if (msgType === 'audioMessage') sendObj.mimetype = 'audio/mpeg';
            await sock.sendMessage(chatJid, sendObj, { quoted: original });
          }
        } else if (displayText) {
          await sock.sendMessage(chatJid, { text: header + `\n💬 ${displayText}`, mentions: [sender] }, { quoted: original });
        }
      } catch (e) {}
    }
  });

  sock.ev.on('error', (error) => {
    const statusCode = error?.output?.statusCode;
    if (statusCode === 515 || statusCode === 503 || statusCode === 408) return;
    bus.emit('system:error', { source: 'socket', sessionId, error: error.message || String(error) });
  });

  // ─── PAIRING CODE — appel DIRECT (référence Baileys) ─────────────
  // Placé APRÈS tous les listeners : waitForSocketOpen peut bloquer,
  // et connection.update doit être prêt pendant l'attente.
  // Ne PAS attendre l'event qr : il se régénère toutes les ~20s et
  // invalide le code précédent avant que l'utilisateur puisse l'entrer.
  if (epoch !== sessionEpoch) return sock; // cycle remplacé pendant un await → jamais 2 codes
  pairingCodeRequested = false;            // verrou : un seul code actif par cycle
  if (!state.creds.registered && isPairing && options.pairingPhone) {
    if (pairingAttempts >= MAX_PAIRING_ATTEMPTS) {
      console.error(`[PAIRING] ❌ ${MAX_PAIRING_ATTEMPTS} tentatives épuisées — aucune nouvelle demande de code.`);
      console.error('   Veuillez relancer une nouvelle tentative.');
    } else if (pairingCodeRequested) {
      // verrou actif : ne jamais afficher deux codes simultanément
    } else {
      try {
        // E.164 sans + ( ) - espaces — déjà valide si chiffres seuls
        const phoneNumber = String(options.pairingPhone).replace(/\D/g, '');
        if (!phoneNumber || phoneNumber.length < 8 || phoneNumber.length > 15) {
          console.error(`[PAIRING] ❌ Numéro invalide (8 à 15 chiffres attendus): ${options.pairingPhone}`);
        } else {
          console.log('[PAIRING] Demande du code...');
          await sock.waitForSocketOpen();
          if (epoch !== sessionEpoch) return sock; // remplacé pendant l'attente du socket
          pairingAttempts++;          // tentative = émission d'un code (pas une reconnexion)
          pairingCodeRequested = true; // verrou activé
          const rawCode = await sock.requestPairingCode(phoneNumber);
          const code = rawCode?.match(/.{1,4}/g)?.join('-') || rawCode;
          sessionManager.setStatus(sessionId, 'WAITING_FOR_PAIRING');
          bus.emit('session:pairing-code', { sessionId });
          console.log(`[PAIRING] Code généré : ${code} (tentative ${pairingAttempts}/${MAX_PAIRING_ATTEMPTS})`);
          console.log('\n╔══════════════════════════════════════════════╗');
          console.log('║         CODE DE PAIRING WHATSAPP            ║');
          console.log('╠══════════════════════════════════════════════╣');
          console.log(`║  Code: ${code}                         ║`);
          console.log('║                                              ║');
          console.log('║  1. WhatsApp > Appareils lies                ║');
          console.log('║  2. "Connecter un appareil"                  ║');
          console.log('║  3. "Lier avec un numero"                    ║');
          console.log('║  4. Entrez le code ci-dessus                 ║');
          console.log('╚══════════════════════════════════════════════╝\n');
          // PAIRING_TIMEOUT : informe l'utilisateur sans créer de boucle de reconnexion
          if (pairingTimeoutTimer) clearTimeout(pairingTimeoutTimer);
          pairingTimeoutTimer = setTimeout(() => {
            if (!state.creds.registered) {
              console.error('\n[PAIRING] ⏱️ Le code de pairing a expiré.');
              console.error('   Veuillez relancer une nouvelle tentative.\n');
            }
            pairingTimeoutTimer = null;
          }, PAIRING_TIMEOUT);
        }
      } catch (e) {
        console.error('[PAIRING] Erreur requestPairingCode:', e.message);
      }
    }
  }

  return sock;
}

async function main() {
  // Vérifier si déjà ENREGISTRÉ (registered: true) — un creds.json vide
  // avec registered:false ne doit pas être considéré comme une session valide
  const sessionId = config.sessionName || 'session';
  const sessionDir = path.join(__dirname, sessionId);
  let hasCreds = false;
  try {
    const credsPath = path.join(sessionDir, 'creds.json');
    if (fs.existsSync(credsPath)) {
      const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
      hasCreds = !!creds.registered;
    }
  } catch {
    hasCreds = false;
  }

  let connectMethod = 'qr';
  let pairingPhone = null;

  // Demander la méthode AVANT le TUI (évite conflit stdin)
  if (!hasCreds) {
    if (process.stdin.isTTY && process.stdout.isTTY) {
      const choice = await askConnectionMethod();
      connectMethod = choice.method;
      pairingPhone = choice.phone || null;
    } else {
      // Non-interactif (sans TTY / service) : pas de readline — env ou fallback pairing auto
      const envMethod = (process.env.CONNECT_METHOD || '').toLowerCase();
      const envPhone = (process.env.PAIRING_PHONE || '').replace(/[^0-9]/g, '');
      const ownerPhone = String(config.ownerNumber?.[0] || '').replace(/[^0-9]/g, '');
      connectMethod = envMethod === 'qr' ? 'qr' : 'pairing';
      pairingPhone = connectMethod === 'pairing' ? (envPhone || ownerPhone || null) : null;
      if (connectMethod === 'pairing' && !pairingPhone) {
        connectMethod = 'qr';
      }
      console.log(`[SESSION] Mode non-interactif → ${connectMethod}${pairingPhone ? ` (téléphone: ${pairingPhone})` : ''}`);
      console.log(connectMethod === 'qr'
        ? '[SESSION] Le QR s\'affichera ci-dessous (WhatsApp > Appareils liés > Scanner).'
        : '[SESSION] Le code de pairing s\'affichera ci-dessous.');
    }
  } else {
    console.log('[SESSION] Session existante détectée, reconnexion automatique...');
  }

  // Start TUI (après le choix)
  tui.start();

  // Initialize AINORIA
  await ainoria.initialize();

  // Load existing sessions
  const db = sessionManager.loadSessionsDB();
  if (db.sessions && db.sessions.length > 0) {
    for (const s of db.sessions) {
      bus.emit('session:loaded', { sessionId: s.id });
    }
  }

  try {
    await startSession(sessionId, {
      sessionID: config.sessionID,
      owner: config.ownerNumber?.[0],
      connectMethod,
      pairingPhone,
    });
  } catch (err) {
    bus.emit('system:error', { source: 'startup', error: err.message });
  }
}

// Global error handlers
process.on('uncaughtException', (err) => {
  bus.emit('system:error', { source: 'uncaught', error: err.message, stack: err.stack });
  if (err.code === 'ENOSPC') {
    const { cleanupOldFiles } = require('./utils/cleanup');
    cleanupOldFiles();
  }
});

process.on('unhandledRejection', (err) => {
  if (err?.message?.includes('rate-overlimit')) return;
  bus.emit('system:error', { source: 'unhandled', error: err?.message || String(err) });
});

main().catch(err => {
  console.error('Fatal:', err);
  tui.shutdown(1);
});

module.exports = { store, bus, sessionManager, ainoria };
