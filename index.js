'use strict';
/**
 * DJOUSSE TECH MD — Point d'entrée (Baileys)
 *
 * Rôle :
 *   1. Connexion WhatsApp (QR ou code de pairing) avec reconnexion robuste
 *   2. Sauvegarde des credentials (session/)
 *   3. Délégation de TOUS le traitement métier à handler.js
 *
 * Architecture : 7 fichiers seulement.
 *   .env · .gitignore · config.js · handler.js · index.js · package.json · session/
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const pino = require('pino');
const qrTerminal = require('qrcode-terminal');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require('@itsukichan/baileys');
const {
  fetchLatestBaileysVersion,
  fetchLatestWaWebVersion,
} = require('@whiskeysockets/baileys');

const config = require('./config');
const handler = require('./handler');

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

const rawError = console.error.bind(console);
const rawLog = console.log.bind(console);
const rawWarn = console.warn.bind(console);

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

/* ══════════════════════════════════════════════════════════════
   1. LOGGER SILENCIEUX — aucun pino-pretty (7 fichiers, zéro dépendance)
   ══════════════════════════════════════════════════════════════ */

const logger = pino({ level: 'silent' });
logger.debug = () => {};
logger.trace = () => {};

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
  const opts = { timeout: 8000 };
  try {
    const r = await fetchLatestBaileysVersion(opts);
    if (r?.isLatest && Array.isArray(r.version) && r.version.length === 3) {
      rawLog(`[WA] Version : ${r.version.join('.')} (github WhiskeySockets)`);
      return r.version;
    }
  } catch {}
  try {
    const r = await fetchLatestWaWebVersion(opts);
    if (r?.isLatest && Array.isArray(r.version) && r.version.length === 3) {
      rawLog(`[WA] Version : ${r.version.join('.')} (web.whatsapp.com)`);
      return r.version;
    }
  } catch {}
  if (process.env.WA_VERSION) {
    const v = process.env.WA_VERSION.split(',').map((n) => parseInt(n.trim(), 10));
    if (v.length === 3 && v.every(Number.isFinite)) {
      rawLog(`[WA] Version : ${v.join('.')} (env WA_VERSION)`);
      return v;
    }
  }
  rawWarn(`⚠️ [WA] Sources de version injoignables — repli : ${config.stableWaVersion.join('.')}`);
  return config.stableWaVersion;
}

/* ══════════════════════════════════════════════════════════════
   3. ANTI-DÉDOUBLON — un message ne traite qu'une seule fois
   ══════════════════════════════════════════════════════════════ */

const processedMessages = new Set();
setInterval(() => processedMessages.clear(), 5 * 60 * 1000).unref();

const isSystemJid = (jid) =>
  !jid || jid.includes('@broadcast') || jid.includes('status.broadcast') || jid.includes('@newsletter');

/* ══════════════════════════════════════════════════════════════
   4. ÉTAT DE CONNEXION (un seul socket à la fois)
   ══════════════════════════════════════════════════════════════ */

let sessionEpoch = 0;          // anti-démarrage concurrent → jamais 2 sockets
let activeSock = null;
let conflictCount = 0;         // 440 connectionReplaced
let handshakeFailCount = 0;    // 405 handshake rejeté
let pairingAttempts = 0;       // codes de pairing émis
let conflictStableTimer = null;

const CONFLICT_MAX_RETRIES = 8;
const MAX_405_RETRIES = 5;
const MAX_PAIRING_ATTEMPTS = 3;
const PAIRING_TIMEOUT = 60 * 1000;
const ladder = (arr, i) => arr[Math.min(Math.max(i, 1), arr.length) - 1];

/* ══════════════════════════════════════════════════════════════
   5. CHOIX MÉTHODE DE CONNEXION (readline seulement si TTY + pas de creds)
   ══════════════════════════════════════════════════════════════ */

const ask = (query) => new Promise((resolve) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(query, (ans) => { rl.close(); resolve(ans.trim()); });
});

async function askConnectionMethod() {
  rawLog('\n╔══════════════════════════════════════════════╗');
  rawLog('║       DJOUSSE TECH — CONNEXION WHATSAPP     ║');
  rawLog('╠══════════════════════════════════════════════╣');
  rawLog('║  1 │ QR Code      — Scanner avec le téléphone║');
  rawLog('║  2 │ Pairing Code — Saisir un code 8 chiffres║');
  rawLog('╚══════════════════════════════════════════════╝\n');
  const choice = await ask('Choix [1/2]: ');
  if (choice === '2') {
    const phone = await ask('Numéro WhatsApp (ex: 237693978044): ');
    const clean = phone.replace(/\D/g, '');
    if (!clean || clean.length < 8) {
      rawError('❌ Numéro invalide. Fallback QR Code.');
      return { method: 'qr' };
    }
    return { method: 'pairing', phone: clean };
  }
  return { method: 'qr' };
}

/* ══════════════════════════════════════════════════════════════
   6. CYCLE DE CONNEXION — startSession()
   ══════════════════════════════════════════════════════════════ */

async function startSession(options = {}) {
  const epoch = ++sessionEpoch;
  const sessionDir = path.join(__dirname, config.sessionDir);

  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
    rawLog(`[SESSION] 📁 Dossier créé : ${sessionDir}`);
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const version = await resolveWAVersion();

  const isPairing = options.connectMethod === 'pairing';
  rawLog(`[AUTH] Méthode : ${isPairing ? 'PAIRING' : 'QR'}`);

  // PURGE STRICTEMENT EN MODE PAIRING :
  //   - En QR, "me + registered:false" est l'état NORMAL après scan → ne jamais purger
  //     ici, sinon la session fraîchement scannée est détruite à chaque redémarrage.
  //   - En pairing, requestPairingCode écrit creds.me → au retry, Baileys tente un
  //     login au lieu d'une registration → 401 en boucle. On repart propre.
  if (isPairing && !state.creds.registered && state.creds.me) {
    purgePairingCreds(sessionDir, state);
    rawLog('[PAIRING] 🧹 Ancien creds.me purgé — registration propre.');
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
    version,
    logger,
    browser: ['DJOUSSE TECH', 'Chrome', '1.0'],
    printQRInTerminal: false,
    auth: state,
    syncFullHistory: false,
    downloadHistory: false,
    markOnlineOnConnect: false,
    getMessage: async () => undefined,
  });
  activeSock = sock;

  /* ── Credentials : sauvegarde obligatoire à chaque update ── */
  sock.ev.on('creds.update', async () => {
    try {
      if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
      await saveCreds();
    } catch (e) {
      console.error('[SESSION] ❌ Erreur sauvegarde creds:', e.message);
    }
  });

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

  /* ── connection.update — QR, déconnexions, reconnexion ── */
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      if (isPairing) {
        // En pairing, l'évent qr ne sert pas : le code est demandé en direct plus bas
        rawLog('[AUTH] Pairing en cours — QR ignoré.');
      } else {
        rawLog('\n╔══════════════════════════════════════════════╗');
        rawLog('║       DJOUSSE TECH — CONNEXION QR            ║');
        rawLog('╠══════════════════════════════════════════════╣');
        rawLog('║ WhatsApp → Appareils liés → Connecter        ║');
        rawLog('║ un appareil → Scanner le QR                  ║');
        rawLog('╚══════════════════════════════════════════════╝');
        qrTerminal.generate(qr, { small: true });
      }
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const wasRegistered = !!state?.creds?.registered;

      if (conflictStableTimer) { clearTimeout(conflictStableTimer); conflictStableTimer = null; }

      rawLog(`[SOCKET] 🔌 Fermeture (code=${statusCode ?? 'inconnu'}${lastDisconnect?.error?.message ? ` — ${lastDisconnect.error.message}` : ''})`);

      // 401/403 après un login réussi → compte probablement restreint
      if ((statusCode === 401 || statusCode === 403) && wasRegistered) {
        rawError(`🚨 COMPTE RESTREINT ? — code ${statusCode} — pause de 10 min avant toute reconnexion.`);
      }
      // 401 sans session enregistrée = pairing rejeté → creds.me en cause
      if (statusCode === 401 && !wasRegistered && isPairing) {
        purgePairingCreds(sessionDir, state);
        rawLog('[PAIRING] 🧹 creds.me purgé — prochaine tentative = registration propre.');
      }

      if (statusCode === DisconnectReason.loggedOut && wasRegistered) {
        rawError('🚪 Session déconnectée (loggedOut) — supprimez session/ et rescannez le QR.');
        return;
      }

      // Escalier de reconnexion par code explicite
      let delay = 3000;
      if (statusCode === 440) {
        conflictCount++;
        delay = Math.min(60000, 3000 * Math.pow(2, Math.min(conflictCount, 5)));
        rawLog(`⚠️ CONFLICT (440) — tentative ${conflictCount}/${CONFLICT_MAX_RETRIES} — reconnexion dans ${delay / 1000}s...`);
        if (conflictCount >= CONFLICT_MAX_RETRIES) {
          rawError('🛑 CONFLICT (440) persistant — une autre instance détient la session. Fermez-la puis redémarrez le bot.');
          return;
        }
      } else if (statusCode === 401 && !wasRegistered && isPairing) {
        delay = ladder([60000, 120000, 300000], pairingAttempts);
        rawLog(`[PAIRING] 🔁 Retry pairing dans ${delay / 1000}s... (tentative ${pairingAttempts}/${MAX_PAIRING_ATTEMPTS})`);
      } else if (statusCode === 405) {
        handshakeFailCount++;
        delay = ladder([15000, 60000, 300000], handshakeFailCount);
        rawLog(`⚠️ HANDSHAKE REJETÉ (405) — tentative ${handshakeFailCount}/${MAX_405_RETRIES} — reconnexion dans ${delay / 1000}s...`);
        if (handshakeFailCount >= MAX_405_RETRIES) {
          rawError('🛑 405 persistant — vérifiez le réseau puis redémarrez le bot (la version WA est re-récupérée automatiquement).');
          return;
        }
      } else if (statusCode === 401 && wasRegistered) {
        delay = 600000; // restriction probable → longue pause
        rawError('🛑 401 après login réussi — pause de 10 minutes.');
      } else if (statusCode === 408) {
        delay = 5000;
      } else if (statusCode === 515) {
        delay = 500;
        rawLog('[SOCKET] 🔄 Stream error (515) — redémarrage immédiat du socket...');
      } else if (statusCode === 503) {
        delay = 30000;
      }

      // Pendant un pairing en attente : jamais de reconnexion agressive (rate-limit)
      if (isPairing && !wasRegistered && pairingAttempts > 0) delay = Math.max(delay, 60000);

      rawLog(`[SOCKET] 🔁 Reconnexion dans ${delay / 1000}s...`);
      setTimeout(() => startSession(options), delay);
      return;
    }

    if (connection === 'open') {
      rawLog('[SOCKET] ✅ CONNECTÉ —', sock.user?.id || 'session active');

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

      // Connexion stable → compteurs d'échec à zéro
      pairingAttempts = 0;
      handshakeFailCount = 0;
      if (conflictStableTimer) clearTimeout(conflictStableTimer);
      conflictStableTimer = setTimeout(() => { conflictCount = 0; conflictStableTimer = null; }, 60 * 1000);
      conflictStableTimer.unref?.();

      if (config.autoBio && sock.user?.id) {
        await sock.updateProfileStatus(`${config.botName} | En ligne`).catch(() => {});
      }

      rawLog(`[BOT] ${config.botName} v${config.version} — prefix "${config.prefix}" — owner +${config.ownerNumber[0]}`);
      rawLog(`[BOT] ${handler.commands.size} commandes chargées · tapez ${config.prefix}menu dans WhatsApp\n`);
    }
  });

  /* ── Messages entrants → handler (tout le métier est dans handler.js) ── */
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      try {
        if (!msg.message || !msg.key?.id) continue;
        const from = msg.key.remoteJid;
        if (isSystemJid(from)) continue;

        // Ne jamais traiter un doublon ni un vieux message (redémarrage, backlog)
        if (processedMessages.has(msg.key.id)) continue;
        if (msg.messageTimestamp && Date.now() - Number(msg.messageTimestamp) * 1000 > 5 * 60 * 1000) continue;
        processedMessages.add(msg.key.id);

        if (config.autoRead && !msg.key.fromMe) {
          await sock.readMessages([msg.key]).catch(() => {});
        }

        await handler.handleMessage(sock, msg);
      } catch (err) {
        if (!isIgnored(err?.message)) console.error('[SOCKET] messages.upsert:', err?.message || err);
      }
    }
  });

  /* ── Arrivées / départs de membres → welcome & goodbye ── */
  sock.ev.on('group-participants.update', async (update) => {
    try {
      await handler.handleGroupUpdate(sock, update);
    } catch (err) {
      if (!isIgnored(err?.message)) console.error('[SOCKET] group-participants:', err?.message || err);
    }
  });

  sock.ev.on('error', (error) => {
    const code = error?.output?.statusCode;
    if (code === 515 || code === 503 || code === 408) return;
    if (!isIgnored(error?.message)) console.error('[SOCKET]', error?.message || error);
  });

  /* ── PAIRING CODE — demandé APRÈS tous les listeners
        (waitForSocketOpen peut bloquer, connection.update doit être prêt)
        Ne pas attendre l'event qr : il se régénère toutes les ~20s.) ── */
  if (epoch !== sessionEpoch) return sock;
  if (!state.creds.registered && isPairing && options.pairingPhone) {
    if (pairingAttempts >= MAX_PAIRING_ATTEMPTS) {
      rawError(`[PAIRING] ❌ ${MAX_PAIRING_ATTEMPTS} tentatives épuisées — relancez le bot pour un nouveau code.`);
    } else {
      try {
        const phoneNumber = String(options.pairingPhone).replace(/\D/g, '');
        if (phoneNumber.length < 8 || phoneNumber.length > 15) {
          rawError(`[PAIRING] ❌ Numéro invalide (8 à 15 chiffres attendus) : ${options.pairingPhone}`);
        } else {
          rawLog('[PAIRING] Demande du code...');
          await sock.waitForSocketOpen();
          if (epoch !== sessionEpoch) return sock;
          pairingAttempts++;
          const rawCode = await sock.requestPairingCode(phoneNumber);
          const code = rawCode?.match(/.{1,4}/g)?.join('-') || rawCode;
          rawLog(`[PAIRING] Code généré : ${code} (tentative ${pairingAttempts}/${MAX_PAIRING_ATTEMPTS})`);
          rawLog('\n╔══════════════════════════════════════════════╗');
          rawLog('║         CODE DE PAIRING WHATSAPP             ║');
          rawLog('╠══════════════════════════════════════════════╣');
          rawLog(`║  Code : ${code}`);
          rawLog('║                                              ║');
          rawLog('║  WhatsApp → Appareils liés → Connecter un    ║');
          rawLog('║  appareil → Lier avec un numéro → saisir     ║');
          rawLog('║  le code ci-dessus                           ║');
          rawLog('╚══════════════════════════════════════════════╝\n');
          setTimeout(() => {
            if (!state.creds.registered) {
              rawError('\n[PAIRING] ⏱️ Le code a expiré — relancez le bot pour en obtenir un nouveau.\n');
            }
          }, PAIRING_TIMEOUT).unref?.();
        }
      } catch (e) {
        console.error('[PAIRING] Erreur requestPairingCode:', e.message);
      }
    }
  }

  return sock;
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
  const sessionDir = path.join(__dirname, config.sessionDir);

  // Session déjà enregistrée ?
  let hasCreds = false;
  try {
    const credsPath = path.join(sessionDir, 'creds.json');
    if (fs.existsSync(credsPath)) hasCreds = !!JSON.parse(fs.readFileSync(credsPath, 'utf8')).registered;
  } catch { hasCreds = false; }

  let connectMethod = (config.connectMethod === 'pairing') ? 'pairing'
    : (config.connectMethod === 'qr') ? 'qr' : '';
  let pairingPhone = config.pairingPhone || null;

  if (hasCreds) {
    rawLog('[SESSION] Session existante détectée — reconnexion automatique...');
    if (!connectMethod) connectMethod = 'qr';
  } else if (!connectMethod) {
    if (process.stdin.isTTY && process.stdout.isTTY) {
      const choice = await askConnectionMethod();
      connectMethod = choice.method;
      pairingPhone = choice.phone || pairingPhone;
    } else {
      // Non-interactif (service) : pas de readline — env ou pairing auto
      const ownerPhone = String(config.ownerNumber?.[0] || '').replace(/\D/g, '');
      connectMethod = 'pairing';
      pairingPhone = pairingPhone || ownerPhone || null;
      if (!pairingPhone) connectMethod = 'qr';
      rawLog(`[SESSION] Mode non-interactif → ${connectMethod}${pairingPhone ? ` (téléphone: ${pairingPhone})` : ''}`);
    }
  }

  if (connectMethod === 'pairing' && !pairingPhone) {
    const ownerPhone = String(config.ownerNumber?.[0] || '').replace(/\D/g, '');
    pairingPhone = ownerPhone || null;
    if (!pairingPhone) {
      rawError('[PAIRING] ❌ Aucun numéro (PAIRING_PHONE / OWNER_NUMBER vide) → fallback QR.');
      connectMethod = 'qr';
    }
  }

  rawLog('┌──────────────────────────────────────────────┐');
  rawLog(`│   ${config.botName} v${config.version} — DJOUSSE TECH MD`.padEnd(47) + '│');
  rawLog('└──────────────────────────────────────────────┘');

  await startSession({ connectMethod, pairingPhone });
}

main().catch((err) => {
  rawError('Fatal:', err?.message || err);
  process.exit(1);
});

module.exports = { startSession, resolveWAVersion };
