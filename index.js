'use strict';
/**
 * DJOUSSE TECH MD — Point d'entrée (Baileys)
 *
 * Rôle :
 *   1. Connexion WhatsApp (pairing code ou QR explicite) avec reconnexion robuste
 *   2. Sauvegarde des credentials (sessions/djsession/)
 *   3. Délégation de TOUS le traitement métier à handler.js
 *
 * Architecture :
 *   .env · .gitignore · config.js · style.js · handler.js · index.js · package.json · sessions/djsession/
 *   guard/ (moteur de protections de groupe)
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const pino = require('pino');
const qrTerminal = require('qrcode-terminal');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  fetchLatestWaWebVersion,
} = require('@whiskeysockets/baileys');

const config = require('./config');
const handler = require('./handler');
/* Présence en direct (.seen) : routage presence.update unique */
const presence = require('./lib/presence');
/* Étiquettes Business (.label list) : définitions + associations */
const labelsCache = require('./lib/labels');
/* Cadres de la console : source unique du style (style.js) */
const { box, banner, renderStartupDashboard } = require('./style');
/* Extraction du texte : parseur unique du projet (G4) */
const { textOf } = require('./guard/src/utils/message');
const guardPerms = require('./guard/src/utils/perms');
const guardNight = require('./guard/src/nightmode');
/* Stats de connexion partagées avec handler.js (commande .diag) */
const waStats = require('./lib/waStats');
/* Journal SQLite local (data/bot.db) — cycles de connexion */
const localDb = require('./lib/db');
const { DATA_DIR } = require('./lib/dataDir');

/* ══════════════════════════════════════════════════════════════
   0. FILTRES — ignore les erreurs bruyantes de libsignal / réseau
   ══════════════════════════════════════════════════════════════ */

const IGNORED_ERRORS = [
  'Bad MAC', 'Failed to decrypt', 'Session error', 'libsignal',
  'session_cipher', 'decryptWithSessions', 'doDecryptWhisperMessage',
  'MessageCounterError', 'Closing open session', 'Closing session',
  'Key used already', 'Invalid PreKey', 'Duplicate Message',
  'rate-overlimit',
];

const isIgnored = (value) => {
  if (!value) return false;
  const str = typeof value === 'string' ? value : (value.message || String(value));
  return IGNORED_ERRORS.some((kw) => str.includes(kw));
};

/* ══════════════════════════════════════════════════════════════
   0. ÉTAT DE SESSION (bridge local)
      Statut, QR, code de pairing et dernière erreur suivis ici pour
      le tableau de bord de démarrage et les événements de connexion.
   ══════════════════════════════════════════════════════════════ */

const bridge = {
  connected: false,
  status: 'INITIALISATION',
  lastError: '',
};

const baseLog = console.log.bind(console);
const baseWarn = console.warn.bind(console);
const baseError = console.error.bind(console);

const rawLog = (...args) => baseLog(...args);
const rawError = (...args) => baseError(...args);
const rawWarn = (...args) => baseWarn(...args);

let startupDashboardShown = false;
function showStartupDashboard() {
  let storage = 'ERREUR';
  let protections = 'ERREUR';
  try {
    fs.accessSync(DATA_DIR, fs.constants.W_OK);
    if (!handler.getStore() || !handler.getScheduler()) throw new Error('stockage non initialisé');
    storage = localDb.available() ? 'OK (SQLite)' : 'OK (JSON)';
  } catch {
    storage = 'ERREUR';
  }
  try {
    guardDb.db();
    protections = 'INITIALISEES';
  } catch {
    protections = 'ERREUR';
  }

  const uniqueCommands = new Set(
    Array.from(handler.commands.values(), (command) => command.name),
  ).size;
  const lastError = bridge.lastError || (
    storage === 'ERREUR' ? 'Stockage inaccessible'
      : protections === 'ERREUR' ? 'Protections indisponibles'
        : ''
  );
  baseLog(renderStartupDashboard({
    process: 'ACTIF',
    version: config.version || 'inconnue',
    nodeVersion: process.version,
    storage,
    commands: uniqueCommands,
    plugins: handler.loadedPlugins.length,
    protections,
    ai: config.geminiKey ? 'CLE CONFIGUREE' : 'SANS CLE',
    sessionId: path.basename(config.sessionDir) || 'principale',
    connection: bridge.status,
    activeSessions: bridge.connected ? 1 : 0,
    lastError,
  }));
  startupDashboardShown = true;
}

function setBridgeStatus(status, lastError = '') {
  const changed = bridge.status !== status || bridge.lastError !== lastError;
  bridge.status = status;
  bridge.lastError = lastError;
  if (changed && startupDashboardShown) showStartupDashboard();
}

console.error = (...args) => { if (!isIgnored(args[0])) rawError(...args); };
console.warn = (...args) => { if (!isIgnored(args[0])) rawWarn(...args); };
console.log = (...args) => { if (!isIgnored(args[0])) rawLog(...args); };

process.on('uncaughtException', (err) => {
  if (isIgnored(err?.message) || isIgnored(err?.stack)) return;
  rawError('[UNCAUGHT]', err?.message || err);
});

process.on('unhandledRejection', (reason) => {
  if (isIgnored(reason?.message) || isIgnored(String(reason))) return;
  rawError('[UNHANDLED]', reason?.message || reason);
});

/* ── DJOUSSE GUARD : flush de la base de protections à l'arrêt
      (écriture atomique, debounce 300 ms → rien ne se perd) ── */
const guardDb = require('./guard/src/db');
const flushGuard = () => { try { guardDb.db().flush(); } catch (e) { /* non initialisée */ } };
process.on('SIGINT', () => { flushGuard(); process.exit(0); });
process.on('SIGTERM', () => { flushGuard(); process.exit(0); });
process.on('exit', flushGuard);

/* ══════════════════════════════════════════════════════════════
   1. LOGGER SILENCIEUX — aucun pino-pretty (7 fichiers, zéro dépendance)
   ══════════════════════════════════════════════════════════════ */

// BAILEYS_LOG=debug (ou trace) dans .env → affiche la VRAIE cause des coupures
// (les logs pino ne passent pas par le filtre console ci-dessus).
const logger = pino({ level: process.env.BAILEYS_LOG || 'silent' });
if (!process.env.BAILEYS_LOG) {
  logger.debug = () => {};
  logger.trace = () => {};
}

/* ══════════════════════════════════════════════════════════════
   2. VERSION WHATSAPP — chaîne de repli (jamais une version en dur seule)
      1. fetchLatestBaileysVersion()  → GitHub WhiskeySockets
      2. fetchLatestWaWebVersion()    → web.whatsapp.com
      3. env WA_VERSION               → surcharge manuelle
      4. config.stableWaVersion       → version connue fonctionnelle
   Les deux fonctions ne lèvent jamais d'erreur : en cas d'échec elles
   renvoient la version embarquée du paquet (souvent périmée → 405).
   D'où le test obligatoire du flag isLatest.
   ══════════════════════════════════════════════════════════════ */

async function resolveWAVersion() {
  const noteVersion = (v, source) => {
    waStats.waVersion = v ? v.join('.') : 'embarquée';
    waStats.waVersionSource = source;
    return v;
  };
  // WA_DEFAULT_VERSION=1 → on laisse Baileys utiliser sa version embarquée
  // (test de diagnostic si la version GitHub/web est rejetée au pairing)
  if (process.env.WA_DEFAULT_VERSION === '1') {
    rawLog('[WA] Version : embarquée dans Baileys (WA_DEFAULT_VERSION=1)');
    return noteVersion(undefined, 'embarquée (WA_DEFAULT_VERSION=1)');
  }
  const opts = { timeout: 8000 };
  try {
    const r = await fetchLatestBaileysVersion(opts);
    if (r?.isLatest && Array.isArray(r.version) && r.version.length === 3) {
      rawLog(`[WA] Version : ${r.version.join('.')} (github WhiskeySockets)`);
      return noteVersion(r.version, 'github WhiskeySockets');
    }
  } catch {}
  try {
    const r = await fetchLatestWaWebVersion(opts);
    if (r?.isLatest && Array.isArray(r.version) && r.version.length === 3) {
      rawLog(`[WA] Version : ${r.version.join('.')} (web.whatsapp.com)`);
      return noteVersion(r.version, 'web.whatsapp.com');
    }
  } catch {}
  if (process.env.WA_VERSION) {
    const v = process.env.WA_VERSION.split(',').map((n) => parseInt(n.trim(), 10));
    if (v.length === 3 && v.every(Number.isFinite)) {
      rawLog(`[WA] Version : ${v.join('.')} (env WA_VERSION)`);
      return noteVersion(v, 'env WA_VERSION');
    }
  }
  rawWarn(`⚠️ [WA] Sources de version injoignables — repli : ${config.stableWaVersion.join('.')}`);
  return noteVersion(config.stableWaVersion, 'repli stable (sources injoignables)');
}

/* ══════════════════════════════════════════════════════════════
   3. ANTI-DÉDOUBLON — un message ne traite qu'une seule fois
   ══════════════════════════════════════════════════════════════ */

const processedMessages = new Set();
setInterval(() => processedMessages.clear(), 5 * 60 * 1000).unref();

const STATUS_JID = 'status@broadcast';
const skipJid = (jid) => handler.isSystemJid(jid) && jid !== STATUS_JID; // source unique : handler.isSystemJid

/* ══════════════════════════════════════════════════════════════
   4. ÉTAT DE CONNEXION (un seul socket à la fois)
   ══════════════════════════════════════════════════════════════ */

let sessionEpoch = 0;          // anti-démarrage concurrent → jamais 2 sockets
let activeSock = null;
let apiCredsState = null;      // état Baileys courant → garde-fou de l'API de jumelage
let conflictCount = 0;         // 440 connectionReplaced
let handshakeFailCount = 0;    // 405 handshake rejeté
let pairingAttempts = 0;       // demandes de code de pairing depuis la connexion
let pairingCodeAt = 0;         // horodatage du dernier code émis → mesure sa durée de vie
let conflictStableTimer = null;

const CONFLICT_MAX_RETRIES = 8;
const MAX_405_RETRIES = 5;
const PAIRING_TIMEOUT = 60 * 1000;
const ladder = (arr, i) => arr[Math.min(Math.max(i, 1), arr.length) - 1];

/* ══════════════════════════════════════════════════════════════
   5. SAISIE DU NUMÉRO DE JUMELAGE (readline uniquement en terminal)
   ══════════════════════════════════════════════════════════════ */

const ask = (query) => new Promise((resolve) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(query, (ans) => { rl.close(); resolve(ans.trim()); });
});

/* ══════════════════════════════════════════════════════════════
   6. CYCLE DE CONNEXION — startSession()
   ══════════════════════════════════════════════════════════════ */

async function startSession(options = {}) {
  const epoch = ++sessionEpoch;
  setBridgeStatus('INITIALISATION');
  const sessionDir = path.resolve(__dirname, config.sessionDir);

  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
    rawLog(`[SESSION] 📁 Dossier créé : ${sessionDir}`);
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  apiCredsState = state; // l'API de jumelage refuse tout code si session déjà enregistrée
  const version = await resolveWAVersion();

  const isPairing = options.connectMethod === 'pairing';
  rawLog(`[AUTH] Méthode : ${isPairing ? 'PAIRING' : 'QR'}`);

  // PURGE DES ARTEFACTS DE PAIRING :
  //   - En QR, "me + registered:false" est l'état NORMAL après scan → ne jamais
  //     purger un me nu, sinon la session fraîchement scannée est détruite à
  //     chaque redémarrage.
  //   - En pairing, requestPairingCode écrit creds.me → au retry, Baileys tente
  //     un login au lieu d'une registration → 401 en boucle. On repart propre.
  //   - CORRECTIF : un pairing AVORTÉ laisse me + pairingCode dans creds.json.
  //     Si on repart ensuite en QR, isPairing est faux → plus aucune purge →
  //     Baileys tente un login avec ce me → 401 en boucle et le QR ne s'affiche
  //     JAMAIS. Or pairingCode n'est écrit QUE par requestPairingCode
  //     (lib/Socket/socket.js:356), jamais par un scan QR : sa présence est le
  //     marqueur fiable d'un artefact, quel que soit le mode choisi ensuite.
  const stalePairing = !state.creds.registered
    && !!state.creds.me
    && (isPairing || !!state.creds.pairingCode);
  if (stalePairing) {
    purgePairingCreds(sessionDir, state);
    rawLog(`[PAIRING] 🧹 Artefact de pairing purgé — ${isPairing ? 'registration propre' : 'retour QR propre'}.`);
  }

  // Jamais deux sockets : si un cycle plus récent a démarré pendant nos awaits
  if (epoch !== sessionEpoch) {
    rawLog('[SOCKET] ⏭️ Démarrage annulé — cycle plus récent déjà actif.');
    return null;
  }

  // Détruire l'ancien socket AVANT d'en créer un nouveau (anti-440 interne)
  if (activeSock) {
    try { activeSock.ev.removeAllListeners(); } catch {}
    try { activeSock.end(undefined); } catch {}
    try { activeSock.ws?.close(); } catch {}
    activeSock = null;
  }

  const sock = makeWASocket({
    ...(version ? { version } : {}),
    logger,
    browser: Browsers.windows('Chrome'),
    printQRInTerminal: false,
    connectTimeoutMs: 60_000,
    defaultQueryTimeoutMs: 60_000,
    /* Clés mises en cache par signal-key : évite de relire le disque
       à chaque chiffrage et accélère les envois en rafale (voir
       lib/Utils/auth-utils.d.ts → makeCacheableSignalKeyStore) */
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
    syncFullHistory: false,
    downloadHistory: false,
    markOnlineOnConnect: !!config.alwaysOnline,
    generateHighQualityLinkPreview: !!config.linkPreview,
    // Critiques pour retry, édition, votes de sondages, antidelete fiable
    getMessage: async (key) => {
      try {
        return await handler.getMessageForBaileys(key);
      } catch {
        return undefined;
      }
    },
  });
  activeSock = sock;

  /* ── Credentials : sauvegarde obligatoire à chaque update ──
        Pattern OFFICIEL Baileys (README « Example to Start ») :
            sock.ev.on('creds.update', saveCreds)
        Le mkdir maison disparaît : useMultiFileAuthState crée déjà le
        dossier (lib/Utils/use-multi-file-auth-state.js:84). Un rejet
        éventuel de l'écriture disque est attrapé par le handler global
        unhandledRejection en tête de fichier (jamais de crash). */
  sock.ev.on('creds.update', saveCreds);

  /* ── Appels entrants : rejet si activé ── */
  if (config.rejectCall) {
    sock.ev.on('call', async (calls) => {
      for (const call of calls) {
        if (call.status === 'offer') {
          try {
            await sock.rejectCall(call.id, call.from);
            rawLog(`[CALL] 📞 Appel rejeté (${call.from})`);
          } catch (e) {
            console.error('[CALL] Erreur rejet:', e.message);
          }
        }
      }
    });
  }

  /* ── PAIRING CODE — demandé une fois au premier QR émis par Baileys. ── */
  let pairingRequested = false;
  const requestPairing = async () => {
    if (pairingRequested) return;
    if (epoch !== sessionEpoch) return;
    if (sock.authState.creds.registered || !isPairing) return;
    pairingRequested = true;

    try {
      const configuredPhone = options.pairingPhone || config.pairingPhone
        || String(config.ownerNumber?.[0] || '');
      const input = process.stdin.isTTY && process.stdout.isTTY
        ? await ask(
          '\n' + box('DJOUSSE-TECH-MD', [
            'Entre ton numéro WhatsApp',
            'Avec indicatif international',
            'Exemple Cameroun : 237XXXXXXXXX',
          ]) + '\n> '
        )
        : configuredPhone;
      const phoneNumber = String(input).replace(/\D/g, '');
      if (!/^\d{8,15}$/.test(phoneNumber)) {
        throw new Error('Numéro invalide. Utilise le numéro international avec indicatif.');
      }
      rawLog('[PAIRING] Demande du code...');
      pairingAttempts++;
      const rawCode = await sock.requestPairingCode(phoneNumber);
      if (epoch !== sessionEpoch) return;
      const code = rawCode?.match(/.{1,4}/g)?.join('-') || rawCode;
      rawLog(`[PAIRING] Code généré : ${code} (tentative ${pairingAttempts})`);
      rawLog('\n' + box('CODE DE PAIRING WHATSAPP', [
        `Code : ${code}`,
        '',
        'WhatsApp → Appareils liés → Connecter un',
        'appareil → Lier avec un numéro → saisir',
        'le code ci-dessus',
      ]) + '\n');
      pairingCodeAt = Date.now();
      waStats.lastPairingCodeAt = pairingCodeAt;
      waStats.pairingAttempts = pairingAttempts;
      const emittedAt = pairingCodeAt;
      setTimeout(() => {
        if (!state.creds.registered && pairingCodeAt === emittedAt) {
          rawError('\n[PAIRING] ⏱️ Le code a expiré — relancez le bot pour en obtenir un nouveau.\n');
        }
      }, PAIRING_TIMEOUT).unref?.();
    } catch (e) {
      pairingRequested = false;
      console.error('[PAIRING] Erreur requestPairingCode:', e.message);
    }
  };

  /* ── connection.update — QR, déconnexions, reconnexion ── */
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (connection === 'connecting') {
      setBridgeStatus('INITIALISATION');
      rawLog('[WHATSAPP] Connexion en cours...');
    }

    if (qr) {
      // En mode pairing, Baileys émet un QR interne comme signal pour
      // requestPairingCode ; ce QR ne peut pas être scanné par l’utilisateur.
      setBridgeStatus('EN ATTENTE');
      if (isPairing) {
        // Le serveur envoie le « qr » quand il est prêt à lier un appareil :
        // c'est le moment officiel pour demander le code (doc Baileys).
        requestPairing();
      } else {
        rawLog('\n' + box('DJOUSSE TECH — CONNEXION QR', [
          'WhatsApp → Appareils liés → Connecter',
          'un appareil → Scanner le QR',
        ]));
        qrTerminal.generate(qr, { small: true });
      }
    }

    if (connection === 'close') {
      bridge.connected = false;
      guardNight.stop();
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const wasRegistered = !!state?.creds?.registered;
      setBridgeStatus(
        'RECONNEXION',
        statusCode == null ? 'Deconnexion WhatsApp' : `Deconnexion WhatsApp (${statusCode})`,
      );

      if (conflictStableTimer) { clearTimeout(conflictStableTimer); conflictStableTimer = null; }

      rawLog(`[SOCKET] 🔌 Fermeture (code=${statusCode ?? 'inconnu'}${lastDisconnect?.error?.message ? ` — ${lastDisconnect.error.message}` : ''})`);
      waStats.lastDisconnectCode = statusCode ?? null;
      waStats.lastDisconnectAt = Date.now();
      waStats.lastDisconnectMsg = lastDisconnect?.error?.message || '';
      localDb.logEvent({
        type: 'disconnect',
        detail: `${statusCode ?? '?'}${lastDisconnect?.error?.message ? ` · ${lastDisconnect.error.message}` : ''}`,
      });

      // Diagnostic pairing : combien de temps le dernier code a-t-il tenu ?
      // (sans ça, impossible de savoir si le 428 arrive à 1 s ou à 45 s)
      if (isPairing && !wasRegistered && pairingCodeAt) {
        const age = Math.max(0, Math.round((Date.now() - pairingCodeAt) / 1000));
        rawLog(`[PAIRING] ⏱ Code émis il y a ${age}s avant la coupure${age < 5 ? ' → coupure quasi immédiate' : ''}.`);
      }
      // loggedOut/forbidden après un login réussi → compte probablement restreint
      if ((statusCode === DisconnectReason.loggedOut || statusCode === DisconnectReason.forbidden) && wasRegistered) {
        rawError(`🚨 COMPTE RESTREINT ? — code ${statusCode} — pause de 10 min avant toute reconnexion.`);
      }
      // loggedOut sans session enregistrée = pairing rejeté → creds.me en cause
      if (statusCode === DisconnectReason.loggedOut && !wasRegistered && isPairing) {
        purgePairingCreds(sessionDir, state);
        rawLog('[PAIRING] 🧹 creds.me purgé — prochaine tentative = registration propre.');
      }

      // Un 401 qui SUIT un conflit 440 n'est PAS un logout : l'instance gagnante
      // a réécrit creds.json sur disque, celle qui perd rejoue en mémoire des
      // creds obsolètes. Recommander « supprimez sessions/djsession/ » ici efface une
      // session VALIDE — constaté le 01/10 : session enregistrée détruite après
      // un ping-pong de deux instances. On ne propose la purge qu'en vrai logout.
      if (statusCode === DisconnectReason.loggedOut && wasRegistered) {
        if (conflictCount > 0) {
          setBridgeStatus('ERREUR', `Session WhatsApp (${statusCode})`);
          rawError(`🚪 401 après ${conflictCount} conflit(s) 440 — creds périmés en mémoire, PAS un logout.`);
          rawError('   → Ne supprimez PAS sessions/djsession/. Arrêtez TOUTES les instances, puis relancez une seule.');
          return;
        }
        setBridgeStatus('ERREUR', `Session WhatsApp (${statusCode})`);
        rawError('🚪 Session déconnectée (loggedOut) — supprimez sessions/djsession/ et refaites le jumelage.');
        return;
      }

      // Escalier de reconnexion — codes nommés via DisconnectReason (officiel),
      // voir lib/Types/index.d.ts:25. Le 405 ne figure PAS dans l'enum : c'est
      // un code de fermeture WebSocket, il reste en numérique.
      let delay = 3000;
      if (statusCode === DisconnectReason.connectionReplaced) {
        conflictCount++;
        waStats.conflicts = conflictCount;
        delay = Math.min(60000, 3000 * Math.pow(2, Math.min(conflictCount, 5)));
        rawLog(`⚠️ CONFLICT (connectionReplaced/440) — tentative ${conflictCount}/${CONFLICT_MAX_RETRIES} — reconnexion dans ${delay / 1000}s...`);
        if (conflictCount >= CONFLICT_MAX_RETRIES) {
          setBridgeStatus('ERREUR', `Conflit WhatsApp (${statusCode})`);
          rawError('🛑 CONFLICT (440) persistant — une autre instance détient la session. Fermez-la puis redémarrez le bot.');
          return;
        }
      } else if (statusCode === DisconnectReason.loggedOut && !wasRegistered && isPairing) {
        delay = ladder([60000, 120000, 300000], pairingAttempts);
        rawLog(`[PAIRING] 🔁 Retry pairing dans ${delay / 1000}s... (tentative ${pairingAttempts})`);
      } else if (statusCode === 405) {
        handshakeFailCount++;
        waStats.handshakeFails = handshakeFailCount;
        delay = ladder([15000, 60000, 300000], handshakeFailCount);
        rawLog(`⚠️ HANDSHAKE REJETÉ (405) — tentative ${handshakeFailCount}/${MAX_405_RETRIES} — reconnexion dans ${delay / 1000}s...`);
        if (handshakeFailCount >= MAX_405_RETRIES) {
          setBridgeStatus('ERREUR', `Handshake WhatsApp (${statusCode})`);
          rawError('🛑 405 persistant — vérifiez le réseau puis redémarrez le bot (la version WA est re-récupérée automatiquement).');
          return;
        }
      } else if (statusCode === DisconnectReason.loggedOut && wasRegistered) {
        delay = 600000; // restriction probable → longue pause
        rawError('🛑 401 après login réussi — pause de 10 minutes.');
      } else if (statusCode === DisconnectReason.connectionLost) {
        delay = 5000;
      } else if (statusCode === DisconnectReason.restartRequired) {
        delay = 500;
        rawLog('[SOCKET] 🔄 Stream error (515) — redémarrage immédiat du socket...');
      } else if (statusCode === DisconnectReason.unavailableService) {
        delay = 30000;
      }

      // Pendant un pairing en attente, deux cas très différents :
      //   • connectionClosed (428) / connectionLost (408) = socket tombée
      //     PENDANT la liaison → transitoire, on repart vite. Pendant ces 60 s
      //     la session de pairing expire côté téléphone et le code suivant
      //     arrive quand WhatsApp l'a déjà purgée.
      //   • tout autre code (loggedOut rejet, connectionReplaced conflit…)
      //     → WhatsApp refuse : là on garde le backoff long pour ne pas se
      //     faire rate-limiter.
      if (isPairing && !wasRegistered && pairingAttempts > 0) {
        const transient = statusCode === DisconnectReason.connectionClosed
          || statusCode === DisconnectReason.connectionLost;
        if (!transient) {
          delay = Math.max(delay, 60000);
        } else {
          rawLog(`[PAIRING] 🔁 Coupure transitoire (${statusCode}) — nouveau code dans ${delay / 1000}s, sans le backoff de 60 s.`);
        }
      }

      rawLog(`[SOCKET] 🔁 Reconnexion dans ${delay / 1000}s...`);
      setTimeout(() => startSession(options), delay);
      return;
    }

    if (connection === 'open') {
      bridge.connected = true;
      setBridgeStatus('CONNECTE');
      rawLog('[SOCKET] ✅ CONNECTÉ —', sock.user?.id || 'session active');
      waStats.connects++;
      waStats.connectedSince = Date.now();
      localDb.logEvent({ type: 'connect', detail: sock.user?.id || 'session' });

      // CORRECTIF QR (prouvé en prod le 26/09/2026) : le fork ne définit jamais
      // registered=true en flux QR — sans ce marquage, chaque redémarrage voit
      // "me + registered:false" et purge la session → nouvelle rotation QR.
      if (!state.creds.registered) {
        state.creds.registered = true;
        try {
          await saveCreds();
          rawLog('[SESSION] ✔ registered=true (login validé) — session conservée aux redémarrages');
        } catch (e) {
          console.error('[SESSION] Échec marquage registered:', e.message);
        }
      }

      // ── AUTO-OWNER : le numéro qui se connecte devient OWNER + session ──
      // Désactivable : AUTO_OWNER=false dans .env
      // sock.user.id = "237659809751:xx@s.whatsapp.net" → on extrait les chiffres.
      // Ce numéro est TOUJOURS owner (en plus de OWNER_NUMBER du .env s'il diffère).
      try {
        if (config.autoOwner === false) {
          rawLog('[OWNER] AUTO_OWNER désactivé — owners = .env uniquement');
        } else {
          const rawId = String(sock.user?.id || '');
          const connectedNum = rawId.replace(/:\d+/, '').replace(/\D/g, '');
          if (connectedNum && connectedNum.length >= 8) {
            const owners = new Set(
              (config.ownerNumber || []).map((n) => String(n).replace(/\D/g, '')).filter(Boolean)
            );
            owners.add(connectedNum);
            config.ownerNumber = [...owners];
            if (handler.state) {
              handler.state.settings = handler.state.settings || {};
              handler.state.settings.sessionOwner = connectedNum;
              handler.state.settings.owners = config.ownerNumber;
              if (handler.state.settings.selfMode === undefined) {
                handler.state.settings.selfMode = false;
              }
              if (typeof handler.saveState === 'function') handler.saveState(true);
            }
            rawLog(`[OWNER] Session = +${connectedNum} → owner(s): ${config.ownerNumber.map((n) => '+' + n).join(', ')}`);
          }
        }
      } catch (e) {
        console.error('[OWNER] Auto-owner impossible:', e.message);
      }

      // Connexion stable → compteurs d'échec à zéro
      pairingAttempts = 0;
      handshakeFailCount = 0;
      if (conflictStableTimer) clearTimeout(conflictStableTimer);
      conflictStableTimer = setTimeout(() => { conflictCount = 0; conflictStableTimer = null; }, 60 * 1000);
      conflictStableTimer.unref?.();

      if (config.autoBio && sock.user?.id) {
        await sock.updateProfileStatus(`${config.botName} | En ligne`).catch(() => {});
      }

      guardNight.start(sock); // mode nuit : ferme/rouvre les groupes configurés
      try {
        const sch = handler.getScheduler && handler.getScheduler();
        if (sch) sch.start(sock);
      } catch (e) {
        console.error('[SCHED] start:', e.message);
      }

      /* ── Porté TEDDY-XMD : toujours-en-ligne (si activé) ── */
      try {
        if (handler.autoSettings && handler.startOnlineTimer) {
          const auto = handler.autoSettings(handler.state?.settings?.portedAuto);
          if (auto.alwaysonline) {
            handler.startOnlineTimer(sock);
            rawLog('[AUTO] toujours-en-ligne réactivé (réglage conservé)');
          }
        }
      } catch (e) {
        console.error('[AUTO] alwaysonline:', e.message);
      }

      rawLog(`[BOT] ${config.botName} v${config.version} — prefix "${config.prefix}" — owner +${config.ownerNumber[0]}`);
      rawLog(`[BOT] ${handler.commands.size} commandes chargées · tapez ${config.prefix}menu dans WhatsApp\n`);
    }
  });

  /* ── Messages entrants → handler
        Aligné sur le style « Guard » : on accepte notify + append sans filtre agressif.
        Si aucun [MSG] n'apparaît quand tu envoies .ping, Baileys ne reçoit PAS le DM
        (mauvais destinataire ou session à rescanner). ── */
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    const list = messages || [];
    // Log brut de TOUT ce que Baileys envoie (même types inhabituels)
    rawLog(`[UPSERT] type=${type} count=${list.length}`);

    if (type !== 'notify' && type !== 'append') return;

    for (const msg of list) {
      try {
        if (!msg?.key?.id) continue;

        const from = msg.key.remoteJid || '';
        // Statuts : on laisse passer (handleMessage gère status@broadcast)
        // On ne drop plus les append non-fromMe (comme Guard) — certains DM arrivent en append

        // Anti-doublon souple
        const dedupKey = `${from}|${msg.key.id}`;
        if (processedMessages.has(dedupKey)) continue;
        processedMessages.add(dedupKey);

        const m = msg.message || {};
        const text = textOf(m);

        const who = msg.key.fromMe
          ? 'moi'
          : (msg.key.participant || msg.key.participantAlt || msg.key.remoteJid || '?');

        if (!msg.message) {
          rawLog(`[MSG] type=${type} ${from} ← ${who} [sans message.body — ignoré]`);
          continue;
        }

        rawLog(`[MSG] type=${type} fromMe=${!!msg.key.fromMe} ${from} ← ${who}${text ? ` : ${String(text).slice(0, 80)}` : ' [média/autre]'}`);

        if (config.autoRead && !msg.key.fromMe && from !== STATUS_JID) {
          await sock.readMessages([msg.key]).catch(() => {});
        }

        await handler.handleMessage(sock, msg);
      } catch (err) {
        if (!isIgnored(err?.message)) console.error('[SOCKET] messages.upsert:', err?.message || err);
      }
    }
  });

  /* ── messages.update : éditions, votes de sondages, statut de livraison ── */
  sock.ev.on('messages.update', async (updates) => {
    try {
      await handler.handleMessagesUpdate(sock, updates);
    } catch (err) {
      if (!isIgnored(err?.message)) console.error('[SOCKET] messages.update:', err?.message || err);
    }
  });

  /* ── Arrivées / départs de membres → welcome & goodbye
        + invalidation du cache permissions guard (reprise auto
        des protections dès que le bot est promu admin) ── */
  sock.ev.on('group-participants.update', async (update) => {
    try {
      guardPerms.invalidate(update.id);
      await handler.handleGroupUpdate(sock, update);
    } catch (err) {
      if (!isIgnored(err?.message)) console.error('[SOCKET] group-participants:', err?.message || err);
    }
  });

  /* ── Métadonnées de groupe (nom, description, ouverture) → journal .glog ── */
  sock.ev.on('groups.update', async (updates) => {
    try {
      for (const u of updates || []) {
        if (u?.id) guardPerms.invalidate(u.id);
        await handler.handleGroupInfo(sock, u);
      }
    } catch (err) {
      if (!isIgnored(err?.message)) console.error('[SOCKET] groups.update:', err?.message || err);
    }
  });

  /* ── Présence des contacts (.seen) → routage unique lib/presence.js ── */
  sock.ev.on('presence.update', (update) => {
    try {
      presence.handle(update);
    } catch (err) {
      if (!isIgnored(err?.message)) console.error('[SOCKET] presence.update:', err?.message || err);
    }
  });

  /* ── Étiquettes Business (.label list) → cache lib/labels.js ── */
  sock.ev.on('labels.edit', (label) => {
    try {
      labelsCache.onEdit(label);
    } catch (err) {
      if (!isIgnored(err?.message)) console.error('[SOCKET] labels.edit:', err?.message || err);
    }
  });

  sock.ev.on('labels.association', (evt) => {
    try {
      labelsCache.onAssociation(evt);
    } catch (err) {
      if (!isIgnored(err?.message)) console.error('[SOCKET] labels.association:', err?.message || err);
    }
  });

  /* Pas de listener ev.on('error') : cet evenement n'existe pas dans
     BaileysEventMap (Baileys 6.7.24) — les erreurs remontent par
     connection.update (champ error ? Boom), gere au-dessus.
     Ancien listener supprime au lot B12 : 0 emit('error') dans baileys/lib. */

  return sock;
}

/**
 * Détache la session déjà enregistrée, À LA DEMANDE d'un opérateur.
 *
 * Sans ça, « Demander un QR » (ou « Générer le code ») relance un socket qui
 * se reconnecte silencieusement avec des creds valides : aucun QR, aucun code,
 * et l'écran qui attend tourne à vide — exactement le « rien ne fonctionne »
 * constaté le 07/10. On ne purge QUE sur demande explicite (jamais au
 * démarrage), et JAMAIS pendant une session connectée (le caller jette d'abord).
 *
 * @returns {boolean} true si une session a effectivement été détachée
 */
function purgeSessionForRelink() {
  try {
    const credsPath = path.join(path.resolve(__dirname, config.sessionDir), 'creds.json');
    if (!fs.existsSync(credsPath)) return false;
    const raw = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
    if (!raw.registered && !raw.me) return false; // rien à détacher
    delete raw.me;
    delete raw.pairingCode;
    raw.registered = false;
    fs.writeFileSync(credsPath, JSON.stringify(raw, null, 2));
    return true;
  } catch (e) {
    rawError(`[SESSION] Détachement impossible : ${e.message}`);
    return false;
  }
}

/* Nettoyage creds du pairing (me/pairingCode) — jamais en mode QR */
function purgePairingCreds(sessionDir, state) {
  try {
    const credsPath = path.join(sessionDir, 'creds.json');
    if (fs.existsSync(credsPath)) {
      const raw = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
      delete raw.me;
      delete raw.pairingCode;
      raw.registered = false;
      fs.writeFileSync(credsPath, JSON.stringify(raw, null, 2));
    }
    delete state.creds.me;
    delete state.creds.pairingCode;
    state.creds.registered = false;
  } catch (e) {
    console.error('[PAIRING] Erreur purge creds:', e.message);
  }
}

/* ══════════════════════════════════════════════════════════════
   7. DÉMARRAGE
   ══════════════════════════════════════════════════════════════ */

async function main() {
  const sessionDir = path.resolve(__dirname, config.sessionDir);

  // Session déjà enregistrée ?
  let hasCreds = false;
  try {
    const credsPath = path.join(sessionDir, 'creds.json');
    if (fs.existsSync(credsPath)) hasCreds = !!JSON.parse(fs.readFileSync(credsPath, 'utf8')).registered;
  } catch { hasCreds = false; }

  let connectMethod = config.connectMethod === 'qr' ? 'qr' : 'pairing';
  let pairingPhone = config.pairingPhone || null;

  if (hasCreds) {
    rawLog('[SESSION] Session existante détectée — reconnexion automatique...');
  }

  showStartupDashboard();

  /* API DE JUMELAGE HTTP (optionnelle, PAIRING_API=on) — le site « workspace »
     et l'app mobile en obtiennent un code SANS terminal. Démarrée AVANT le
     socket : elle répond /status immédiatement et /pair dès que la socket est
     prête. Refuse tout code si une session est déjà enregistrée (409). */
  if (config.pairingApi) {
    const { startPairingApi } = require('./lib/pairing-api');
    startPairingApi({
      getSocket: () => activeSock,
      isRegistered: () => !!(apiCredsState && apiCredsState.creds && apiCredsState.creds.registered),
      isConnected: () => bridge.connected,
      status: () => bridge.status,
      token: config.pairingApiToken,
      port: config.pairingApiPort,
      serveSite: config.serveSite,
      log: rawLog,
    });
  }

  await startSession({ connectMethod, pairingPhone });
}

/* Lancement direct (node index.js / npm start) — require() reste sans effet
   pour les tests E2E qui appellent startSession() eux-mêmes */
if (require.main === module) {
  main().catch((err) => {
    setBridgeStatus('ERREUR', 'Demarrage impossible');
    if (!startupDashboardShown) showStartupDashboard();
    rawError('Fatal:', err?.message || err);
    process.exit(1);
  });
}

module.exports = { startSession, resolveWAVersion, main };
