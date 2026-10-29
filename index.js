'use strict';
/**
 * DJOUSSE VIRTUAL GATEWAY — index.js
 *
 * Passerelle HTTP de jumelage WhatsApp (Express + Baileys + MongoDB Atlas).
 *
 *   GET  /         → healthcheck simple
 *   GET  /status   → {ok, connected, connection, sessions, active}  (jeton x-api-token)
 *   POST /pair     → {success, code} — code de jumelage 8 caractères
 *
 * ── Robustesse ────────────────────────────────────────────────────────
 * • Une SEULE connexion MongoDB, établie puis mise en cache : toutes les
 *   lectures/écritures attendent la même promesse. Fini le
 *   « Topology is closed » dû à deux appels concurrents pendant la
 *   négociation (boot de djsession + requête /pair).
 * • Sessions strictement isolées : chaque numéro possède sa collection
 *   et son dossier propres (session_<num>), la session principale
 *   « djsession » n'est jamais mélangée aux tentatives de jumelage.
 * • Une seule socket vivante par session (verrou d'initialisation +
 *   contrôle d'identité à la fermeture) : plus de duel
 *   « connection replaced » entre deux instances de la même session.
 * • Reconnexion automatique avec back-off plafonné ; en 401/500/411/403
 *   (session révoquée ou invalide) les données sont purgées pour
 *   repartir sur une base propre ; en 440 (connexion remplacée) on
 *   n'entre surtout pas en boucle.
 * • Jumelage synchronisé sur l'événement qr (signal post-handshake
 *   officiellement utilisé par l'exemple Baileys) : un appel prématuré
 *   de requestPairingCode échoue en 428 ET altère creds.me avant
 *   l'envoi, ce qui sabote le handshake (nœud « login » au lieu de
 *   « registration » → boucle 401/428). Un clic multiple réutilise le
 *   même code au lieu d'invalider celui déjà affiché.
 * • Pairage auditable : les réponses IQ de WhatsApp au companion_hello
 *   (acceptation ou 400 bad-request) sont journalisées — elles étaient
 *   jusqu'ici invisibles (logger silencieux). Version WA Web rafraîchie
 *   au démarrage (fetchLatestBaileysVersion) et triplet browser conforme
 *   à la config confirmée pour le pairage (Baileys #1761).
 * • Aucune erreur de socket ne fait planter le process : listeners
 *   encapsulés + garde-fous unhandledRejection / uncaughtException,
 *   et res.headersSent avant toute réponse d'erreur.
 * • Jeton x-api-token et formats de réponse conservés : compatibles
 *   avec le site (web/public/js/api.js) et le proxy Vercel (web/api/*).
 * • Cerveau du bot RESTAURÉ : messages.upsert → handler.handleMessage,
 *   messages.update → handleMessagesUpdate, group-participants.update →
 *   handleGroupUpdate, groups.update → handleGroupInfo, presence.update →
 *   lib/presence (.seen), labels.* → lib/labels, rejet d'appels
 *   (REJECT_CALL), stats .diag (waStats), auto-owner, auto-bio, mode
 *   nuit, scheduler. Câblage repris de l'entrée historique du bot —
 *   la passerelle « gateway » ne faisait que journaliser les messages,
 *   aucune commande n'était donc traitée sur Render.
 *
 * Variables d'environnement : MONGO_URI, MONGO_DB (défaut whatsapp_bot),
 * PAIRING_API_TOKEN, PORT.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const pino = require('pino');
const { MongoClient } = require('mongodb');
const {
  default: makeWASocket,
  DisconnectReason,
  initAuthCreds,
  BufferJSON,
  proto,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} = require('@whiskeysockets/baileys');
const path = require('path');
const fs = require('fs');

/* ── Cerveau du bot : chargé UNE fois, partagé par toutes les sessions
      (chemins confirmés de l'entrée hybride historique, bd31531). */
const config = require('./src/config/config');
const handler = require('./src/handlers/handler');
const presence = require('./src/lib/presence');
const labelsCache = require('./src/lib/labels');
const waStats = require('./src/lib/waStats');
const guardPerms = require('./src/guard/utils/perms');
const guardNight = require('./src/guard/nightmode');
const { textOf } = require('./src/guard/utils/message');

const app = express();
const PORT = process.env.PORT || 10000;
const DEFAULT_SESSION = 'djsession';
const MONGO_DB = process.env.MONGO_DB || 'whatsapp_bot';
const MAX_RECONNECT_ATTEMPTS = 6;

/* Codes Baileys définitifs : la session est morte, il faut purger. */
const PURGE_CODES = [
  DisconnectReason.loggedOut,            // 401 — déconnecté / révoqué
  DisconnectReason.badSession,          // 500 — session corrompue
  DisconnectReason.multideviceMismatch, // 411 — incompatibilité multi-appareils
  DisconnectReason.forbidden,           // 403 — accès refusé
];

app.use(cors());
app.use(express.json());

/* ─────────────────────── MongoDB Atlas ───────────────────────
   Une connexion unique partagée : la première initialisation lance la
   promesse, tous les autres appels attendent CETTE promesse (aucune
   requête ne part pendant la négociation). Si Atlas est injoignable on
   retombe proprement sur le stockage local sans planter, et la
   prochaine tentative réessaiera la connexion. */

const mongoUri = process.env.MONGO_URI;
let mongoClient = null;
let mongoPromise = null;

function ensureMongo() {
  if (!mongoUri) return Promise.resolve(null);
  if (!mongoPromise) {
    mongoPromise = (async () => {
      const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 10000 });
      await client.connect();
      mongoClient = client;
      console.log('[MONGODB] Connecté à MongoDB Atlas avec succès.');
      return client;
    })().catch((err) => {
      console.error('[MONGODB] Connexion impossible :', err?.message || err);
      mongoClient = null;
      mongoPromise = null; // nouvelle tentative au prochain accès
      return null;
    });
  }
  return mongoPromise;
}

/* ───────────── Version de WhatsApp Web ─────────────
   La version codée en dur dans Baileys 6.7.24 vieillit et fait échouer
   l'enregistrement/pairage (405, bad-request…). On la rafraîchit une
   fois au démarrage, avec repli silencieux sur la version interne. */

let waVersionPromise = null;

function resolveWaVersion() {
  if (!waVersionPromise) {
    waVersionPromise = (async () => {
      try {
        const { version, isLatest } = await fetchLatestBaileysVersion();
        console.log(`[WA] Version WhatsApp Web : ${version.join('.')} (à jour : ${isLatest})`);
        if (Array.isArray(version) && version.length) {
          waStats.waVersion = version.join('.');
          waStats.waVersionSource = isLatest ? 'dernière publiée' : 'dernière connue';
          return version;
        }
        waStats.waVersion = 'embarquée';
        waStats.waVersionSource = 'Baileys interne';
        return null;
      } catch (err) {
        console.warn('[WA] Version dynamique indisponible — version interne de Baileys utilisée :', err?.message || err);
        waStats.waVersion = 'embarquée';
        waStats.waVersionSource = 'Baileys interne';
        return null;
      }
    })();
  }
  return waVersionPromise;
}

/* Arrêt propre (Render envoie SIGTERM avant de redéployer). */
function shutdown(signal) {
  console.log(`[HTTP] Arrêt demandé (${signal}).`);
  const done = () => process.exit(0);
  if (!mongoClient) return done();
  Promise.resolve(mongoClient.close()).catch(() => {}).then(done);
  setTimeout(done, 3000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

/* Filet de sécurité : une promesse fuyante ne doit jamais tuer le
   service de jumelage (la cause n°1 de « planlage » soudain). */
process.on('unhandledRejection', (reason) => {
  console.error('[PROCESS] Rejet de promesse non géré (ignoré) :', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[PROCESS] Exception non capturée (ignorée) :', err);
});

/* ─────────────────── Sessions WhatsApp ─────────────────── */

const activeSessions = new Map();  // sessionId → socket Baileys
const initLocks = new Map();       // sessionId → promesse d'init en cours
const reconnectState = new Map();  // sessionId → {attempts, timer}

/**
 * État d'authentification d'une session : MongoDB si possible,
 * stockage local éphémère en secours. Fournit aussi `purge()`
 * pour effacer proprement la session (révocation 401/500...).
 */
async function createAuthState(sessionId) {
  const client = await ensureMongo();

  if (client) {
    const collection = client.db(MONGO_DB).collection(`session_${sessionId}`);

    const writeData = async (data, id) => {
      try {
        const serialized = JSON.parse(JSON.stringify(data, BufferJSON.replacer));
        await collection.updateOne({ _id: id }, { $set: { data: serialized } }, { upsert: true });
      } catch (err) {
        console.error(`[MONGODB] Échec d'écriture pour ${id} :`, err?.message || err);
      }
    };

    const readData = async (id) => {
      try {
        const doc = await collection.findOne({ _id: id });
        if (!doc || !doc.data) return null;
        return JSON.parse(JSON.stringify(doc.data), BufferJSON.reviver);
      } catch {
        return null;
      }
    };

    const removeData = async (id) => {
      try { await collection.deleteOne({ _id: id }); } catch { /* ignoré */ }
    };

    const creds = (await readData('creds')) || initAuthCreds();

    return {
      kind: 'mongodb',
      state: {
        creds,
        keys: {
          get: async (type, ids) => {
            const data = {};
            for (const id of ids) {
              let value = await readData(`${type}-${id}`);
              if (type === 'app-state-sync-key' && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value;
            }
            return data;
          },
          set: async (data) => {
            const tasks = [];
            for (const category of Object.keys(data)) {
              for (const id of Object.keys(data[category])) {
                const value = data[category][id];
                const key = `${category}-${id}`;
                if (value) tasks.push(writeData(value, key));
                else tasks.push(removeData(key));
              }
            }
            await Promise.all(tasks);
          },
        },
      },
      saveCreds: () => writeData(creds, 'creds'),
      purge: async () => { await collection.deleteMany({}); },
    };
  }

  // Secours local : le jumelage reste possible même sans Atlas.
  console.warn(`[WARN] ${mongoUri ? 'MongoDB injoignable' : 'MONGO_URI absent'} — session ${sessionId} en stockage local éphémère.`);
  const dir = path.join(__dirname, 'storage', 'sessions', sessionId);
  const { state, saveCreds } = await useMultiFileAuthState(dir);
  return {
    kind: 'local',
    state,
    saveCreds,
    purge: async () => { await fs.promises.rm(dir, { recursive: true, force: true }); },
  };
}

/* ─────────── Énumération des sessions enregistrées ───────────
   Sert à BOOT_SESSION=all : on reprend TOUTES les sessions qui possèdent
   un creds.registered=true (un compte WhatsApp par client), au lieu de
   n'ouvrir qu'une seule socket au démarrage. */

async function listRegisteredSessions() {
  const found = new Set();

  const client = await ensureMongo();
  if (client) {
    try {
      const db = client.db(MONGO_DB);
      const cols = await db.listCollections({}, { nameOnly: true }).toArray();
      for (const col of cols) {
        if (!col.name.startsWith('session_')) continue;
        const id = col.name.slice('session_'.length);
        if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) continue;
        const doc = await db.collection(col.name).findOne({ _id: 'creds' });
        if (doc?.data?.registered === true) found.add(id);
      }
    } catch (err) {
      console.error('[SESSIONS] Énumération MongoDB impossible :', err?.message || err);
    }
  }

  /* Repli local : sessions enregistrées hors Atlas (ou sans Mongo). */
  try {
    const base = path.join(__dirname, 'storage', 'sessions');
    for (const ent of await fs.promises.readdir(base, { withFileTypes: true })) {
      if (!ent.isDirectory() || found.has(ent.name)) continue;
      try {
        const raw = await fs.promises.readFile(path.join(base, ent.name, 'creds.json'), 'utf8');
        if (JSON.parse(raw)?.registered === true) found.add(ent.name);
      } catch { /* dossier sans creds.json valide */ }
    }
  } catch { /* dossier storage/sessions absent */ }

  return [...found];
}

/** Reconnexion différée avec back-off exponentiel (3 s → 60 s) et plafond d'essais. */
function scheduleReconnect(sessionId, oldSock) {
  /* Un socket JAMAIS enregistré (me absent / registered=false) ne pourra
     jamais se reconnecter : WhatsApp refuse indéfiniment (408). Chaque
     tentative ne produit donc qu'un handshake inutile — sur une instance
     Render à 0,1 vCPU c'est du CPU et de la RAM gaspillés, et cela masque
     les vraies erreurs dans les logs. Le jumelage se refait via /pair. */
  if (oldSock && !oldSock.authState?.creds?.registered) {
    console.log(`[SOCKET:${sessionId}] Session non enregistrée — reconnexion abandonnée (jumelage via /pair requis).`);
    if (activeSessions.get(sessionId) === oldSock) activeSessions.delete(sessionId);
    reconnectState.delete(sessionId);
    return;
  }

  const state = reconnectState.get(sessionId) || { attempts: 0, timer: null };
  if (state.timer) return;
  state.attempts += 1;
  reconnectState.set(sessionId, state);

  if (state.attempts > MAX_RECONNECT_ATTEMPTS) {
    console.warn(`[SOCKET:${sessionId}] Abandon des reconnections (${state.attempts - 1} échecs) — une nouvelle requête /pair relancera la session.`);
    reconnectState.delete(sessionId);
    if (oldSock && activeSessions.get(sessionId) === oldSock) activeSessions.delete(sessionId);
    return;
  }

  const delay = Math.min(60000, 3000 * Math.pow(2, state.attempts - 1));
  state.timer = setTimeout(async () => {
    state.timer = null;
    const current = activeSessions.get(sessionId);
    if (current && current !== oldSock) return; // une instance plus récente a pris le relais
    if (current === oldSock) activeSessions.delete(sessionId);
    try {
      console.log(`[SOCKET:${sessionId}] Reconnexion (tentative ${state.attempts}/${MAX_RECONNECT_ATTEMPTS})...`);
      await initWhatsAppSession(sessionId);
    } catch (err) {
      console.error(`[SOCKET:${sessionId}] Échec de reconnexion :`, err?.message || err);
      scheduleReconnect(sessionId, null);
    }
  }, delay);
}

/** Traite les changements d'état d'une socket — ne doit jamais throw. */
function handleConnectionUpdate(sessionId, sock, auth, update) {
  const { connection, lastDisconnect } = update;

  // Signal post-handshake : WhatsApp a confirmé la connexion (et non
  // un simple ouverture TCP). Utilisé pour débloquer le jumelage.
  if (update.qr) {
    if (!qrSeen.has(sock)) {
      qrSeen.add(sock);
      console.log(`[SOCKET:${sessionId}] Handshake WhatsApp confirmé — prêt pour le code de jumelage.`);
    }
    return;
  }

  if (connection === 'open') {
    console.log(`[SOCKET:${sessionId}] WhatsApp CONNECTÉ avec succès !`);

    /* Numéro réellement lié (identité WhatsApp, pas la valeur de .env) :
       PAIRING_PHONE est mis à jour en mémoire pour que .diag / .pair
       affichent le compte qui vient de se connecter. */
    const connectedNumber = sock?.user?.id
      ? String(sock.user.id).split(/[:@]/)[0].replace(/\D/g, '')
      : '';
    if (connectedNumber) {
      config.pairingPhone = connectedNumber;
      console.log(`[PAIRING_PHONE] +${connectedNumber} (session ${sessionId})`);
    }

    const state = reconnectState.get(sessionId);
    if (state) {
      if (state.timer) clearTimeout(state.timer);
      reconnectState.delete(sessionId);
    }
    onSocketOpen(sessionId, sock); // stats + auto-owner/bio + nuit + scheduler
    return;
  }

  if (connection !== 'close') return;

  // Une instance plus récente a déjà remplacé cette socket : on ignore.
  if (activeSessions.get(sessionId) !== sock) return;

  const code = lastDisconnect?.error?.output?.statusCode;
  console.log(`[SOCKET:${sessionId}] Connexion fermée (code ${code ?? 'inconnu'}).`);

  // Stats lues par la commande .diag
  waStats.lastDisconnectCode = code ?? null;
  waStats.lastDisconnectAt = Date.now();
  waStats.lastDisconnectMsg = lastDisconnect?.error?.message || '';
  if (code === DisconnectReason.connectionReplaced) waStats.conflicts += 1;
  if (code === 405) waStats.handshakeFails += 1;

  if (PURGE_CODES.includes(code)) {
    activeSessions.delete(sessionId);
    console.log(`[SOCKET:${sessionId}] Session révoquée (${code}) — purge des données pour un jumelage propre.`);
    auth.purge()
      .catch((err) => console.error(`[SOCKET:${sessionId}] Purge impossible :`, err?.message || err))
      .finally(() => scheduleReconnect(sessionId, sock));
    return;
  }

  if (code === DisconnectReason.connectionReplaced) {
    // 440 : une autre instance utilise déjà ces identifiants.
    // On retire la socket SANS purger et SANS reconnecter (sinon boucle).
    activeSessions.delete(sessionId);
    console.warn(`[SOCKET:${sessionId}] Connexion remplacée par une autre instance (440) — reconnexion forcée évitée.`);
    return;
  }

  // 428 (connectionClosed), 408 (timeout), 515 (restart), 503, inconnu…
  scheduleReconnect(sessionId, sock);
}

/* ─────────── Cerveau du bot : câblage des événements ───────────
   Conforme à l'entrée historique du bot (avant la régression
   « gateway ») : TOUTES les sessions connectées alimentent le handler.
   Le dédoublon est global au process : deux sessions compagnons du
   même compte recevraient chaque message en double. */

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

const processedMessages = new Set();
const DEDUP_MAX = 50000;
const STATUS_JID = 'status@broadcast';

function attachBotEvents(sessionId, sock) {
  /* Messages entrants → handler (notify + append, sans filtre fromMe :
     le handler décide lui-même — owner/self/public). */
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify' && type !== 'append') return;

    for (const msg of messages || []) {
      try {
        if (!msg?.key?.id) continue;

        // Anti-doublon souple (clé globale : contact × id message)
        const dedupKey = `${msg.key.remoteJid || ''}|${msg.key.id}`;
        if (processedMessages.has(dedupKey)) continue;
        if (processedMessages.size >= DEDUP_MAX) processedMessages.clear();
        processedMessages.add(dedupKey);

        if (!msg.message) continue;

        const text = textOf(msg.message);
        const from = msg.key.remoteJid || '?';
        console.log(`[MSG:${sessionId}] fromMe=${!!msg.key.fromMe} ${from}${text ? ` : ${String(text).slice(0, 80)}` : ' [média/autre]'}`);

        if (config.autoRead && !msg.key.fromMe && from !== STATUS_JID) {
          await sock.readMessages([msg.key]).catch(() => {});
        }

        await handler.handleMessage(sock, msg);
      } catch (err) {
        if (!isIgnored(err?.message)) console.error(`[MSG:${sessionId}] messages.upsert:`, err?.message || err);
      }
    }
  });

  /* Éditions, votes de sondages, statut de livraison */
  sock.ev.on('messages.update', async (updates) => {
    try {
      await handler.handleMessagesUpdate(sock, updates);
    } catch (err) {
      if (!isIgnored(err?.message)) console.error(`[SOCKET:${sessionId}] messages.update:`, err?.message || err);
    }
  });

  /* Arrivées/départs de membres → welcome & goodbye + invalidation
     du cache permissions guard (reprise auto des protections) */
  sock.ev.on('group-participants.update', async (update) => {
    try {
      guardPerms.invalidate(update.id);
      await handler.handleGroupUpdate(sock, update);
    } catch (err) {
      if (!isIgnored(err?.message)) console.error(`[SOCKET:${sessionId}] group-participants:`, err?.message || err);
    }
  });

  /* Métadonnées de groupe (nom, description, ouverture) → journal .glog */
  sock.ev.on('groups.update', async (updates) => {
    try {
      for (const u of updates || []) {
        if (u?.id) guardPerms.invalidate(u.id);
        await handler.handleGroupInfo(sock, u);
      }
    } catch (err) {
      if (!isIgnored(err?.message)) console.error(`[SOCKET:${sessionId}] groups.update:`, err?.message || err);
    }
  });

  /* Présence des contacts (.seen) → routage unique lib/presence.js */
  sock.ev.on('presence.update', (update) => {
    try {
      presence.handle(update);
    } catch (err) {
      if (!isIgnored(err?.message)) console.error(`[SOCKET:${sessionId}] presence.update:`, err?.message || err);
    }
  });

  /* Étiquettes Business → cache lib/labels.js */
  sock.ev.on('labels.edit', (label) => {
    try { labelsCache.onEdit(label); } catch { /* ignoré */ }
  });
  sock.ev.on('labels.association', (evt) => {
    try { labelsCache.onAssociation(evt); } catch { /* ignoré */ }
  });

  /* Rejet d'appels entrants (REJECT_CALL, défaut activé) */
  if (config.rejectCall) {
    sock.ev.on('call', async (calls) => {
      for (const call of calls || []) {
        if (call.status !== 'offer') continue;
        try {
          await sock.rejectCall(call.id, call.from);
          console.log(`[CALL:${sessionId}] 📞 Appel rejeté (${call.from})`);
        } catch (e) {
          console.error(`[CALL:${sessionId}] Erreur rejet:`, e.message);
        }
      }
    });
  }
}

/** Post-connexion : stats, auto-owner, auto-bio, mode nuit, scheduler. */
async function onSocketOpen(sessionId, sock) {
  try {
    waStats.connects += 1;
    waStats.connectedSince = Date.now();

    // ── AUTO-OWNER : le numéro qui se connecte devient owner ──
    // (désactivable via AUTO_OWNER=false) — sock.user.id = "2376…:xx@s.whatsapp.net"
    if (config.autoOwner === false) {
      console.log('[OWNER] AUTO_OWNER désactivé — owners = .env uniquement');
    } else {
      const connectedNum = String(sock.user?.id || '').replace(/:\d+/, '').replace(/\D/g, '');
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
        console.log(`[OWNER:${sessionId}] Session = +${connectedNum} → owner(s): ${config.ownerNumber.map((n) => '+' + n).join(', ')}`);
      }
    }

    if (config.autoBio && sock.user?.id) {
      await sock.updateProfileStatus(`${config.botName} | En ligne`).catch(() => {});
    }

    try { guardNight.start(sock); } catch (e) { console.error('[NUIT]', e.message); }
    try {
      const sch = handler.getScheduler && handler.getScheduler();
      if (sch) sch.start(sock);
    } catch (e) { console.error('[SCHED]', e.message); }

    // Porté TEDDY-XMD : toujours-en-ligne (si activé)
    try {
      if (handler.autoSettings && handler.startOnlineTimer) {
        const auto = handler.autoSettings(handler.state?.settings?.portedAuto);
        if (auto.alwaysonline) {
          handler.startOnlineTimer(sock);
          console.log('[AUTO] toujours-en-ligne réactivé (réglage conservé)');
        }
      }
    } catch (e) { console.error('[AUTO]', e.message); }
  } catch (err) {
    console.error(`[OPEN:${sessionId}]`, err?.message || err);
  }
}

/** Crée réellement la socket d'une session (appel verrouillé). */
async function createSession(sessionId) {
  const auth = await createAuthState(sessionId);
  const version = await resolveWaVersion();

  /* Auto-réparation des credentials corrompus.
     Une tentative de jumelage avortée (bug 428 historique) laissait
     creds.me défini SANS enregistrement, et cet état était persisté dans
     MongoDB. Baileys choisit alors le nœud « login » au lieu de
     « registration » au handshake : WhatsApp génère le code mais le
     jumelage échoue côté téléphone (« code non reconnu »), et la session
     principale n'atteint jamais CONNECTÉ. On repart d'un état propre. */
  const creds = auth.state?.creds;
  if (creds?.me && !creds.registered) {
    console.warn(`[AUTH:${sessionId}] creds.me corrompu (${creds.me.id}) sans enregistrement — réinitialisation pour forcer le nœud « registration ».`);
    creds.me = undefined;
    creds.pairingCode = undefined;
  }
  console.log(`[AUTH:${sessionId}] État : me=${creds?.me ? 'présent' : 'absent'}, registered=${Boolean(creds?.registered)} (me absent → nœud « registration »).`);

  const waLogger = pino({ level: process.env.WA_LOG_LEVEL || 'silent' });
  const sock = makeWASocket({
    ...(version ? { version } : {}),
    // KeyStore caché (recommandation Baileys + entrée historique) :
    // évite les allers-retours Mongo pour chaque pré-clé.
    auth: {
      creds: auth.state.creds,
      keys: makeCacheableSignalKeyStore(auth.state.keys, waLogger),
    },
    printQRInTerminal: false,
    logger: waLogger,
    // Triplet confirmé pour le pairage (issue Baileys #1761) :
    // un OS/plateforme exotique fait rejeter le companion_hello (400).
    browser: ['Ubuntu', 'Chrome', '20.0.04'],
    syncFullHistory: false,
    markOnlineOnConnect: !!config.alwaysOnline,
    getMessage: async (key) => {
      try {
        return await handler.getMessageForBaileys(key);
      } catch {
        return undefined;
      }
    },
  });

  sock.ev.on('creds.update', auth.saveCreds);

  sock.ev.on('connection.update', (update) => {
    try {
      handleConnectionUpdate(sessionId, sock, auth, update);
    } catch (err) {
      console.error(`[SOCKET:${sessionId}] Erreur d'événement :`, err?.message || err);
    }
  });

  // Cerveau du bot : messages → handler, groupes, présence, labels, calls
  attachBotEvents(sessionId, sock);

  // Diagnostics pairage : la réponse de WhatsApp au companion_hello
  // (acceptation, ou 400 bad-request comme dans Baileys #1761) était
  // jusqu'ici noyée dans le logger silencieux.
  sock.ws?.on?.('CB:iq', (node) => {
    try {
      const type = node?.attrs?.type;
      const body = JSON.stringify(node?.content ?? '').slice(0, 400);
      if (type === 'error') {
        console.error(`[SOCKET:${sessionId}] IQ WhatsApp REFUSÉ (id ${node?.attrs?.id}) : ${body}`);
      } else if (type === 'result' && /link_code|companion/i.test(body)) {
        console.log(`[SOCKET:${sessionId}] Réponse pairage WhatsApp : ${body}`);
      }
    } catch (err) {
      console.error(`[SOCKET:${sessionId}] Diag IQ :`, err?.message || err);
    }
  });

  activeSessions.set(sessionId, sock);
  console.log(`[SOCKET:${sessionId}] Instance initialisée (stockage : ${auth.kind}).`);
  return sock;
}

/**
 * Récupère ou crée la socket d'une session.
 * Verrou par session : deux requêtes /pair simultanées pour le même
 * numéro ne créent JAMAIS deux sockets concurrentes.
 */
function initWhatsAppSession(sessionId) {
  const existing = activeSessions.get(sessionId);
  if (existing) return Promise.resolve(existing);

  const pending = initLocks.get(sessionId);
  if (pending) return pending;

  const task = createSession(sessionId).finally(() => initLocks.delete(sessionId));
  initLocks.set(sessionId, task);
  return task;
}

/* ─────────── Jumelage : synchronisation avec WhatsApp ─────────── */

const qrSeen = new WeakSet();       // sockets ayant reçu l'événement qr
const pairingFlights = new Map();   // sessionId → demande de code en cours
const pairingCodeCache = new Map(); // sessionId → {code, at, sock}
const PAIRING_CODE_TTL_MS = 60000;  // réutiliser le même code pendant 60 s
const QR_WAIT_MS = 9000;

/** Erreur portant le code HTTP à renvoyer. */
function httpError(status, message) {
  const err = new Error(message);
  err.statusCode = status;
  return err;
}

/**
 * Attend la confirmation post-handshake de WhatsApp (événement qr),
 * déjà reçue si la socket est plus âgée. Faux si la connexion tombe.
 */
function waitForQr(sock, timeoutMs) {
  if (qrSeen.has(sock)) return Promise.resolve(true);
  return new Promise((resolve) => {
    let settled = false;
    let timer = null;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      sock.ev.off('connection.update', onUpdate);
      resolve(ok);
    };
    const onUpdate = (update) => {
      if (update.qr) {
        qrSeen.add(sock);
        finish(true);
      } else if (update.connection === 'open' || update.connection === 'close') {
        finish(update.connection === 'open');
      }
    };
    timer = setTimeout(() => finish(qrSeen.has(sock)), timeoutMs);
    sock.ev.on('connection.update', onUpdate);
  });
}

/**
 * Obtient un code de jumelage de façon sûre et dédoublonnée :
 * 1. réutilise le dernier code encore valide (clic multiples, onglets
 *    multiples → sinon chaque nouvel envoi invaliderait le précédent) ;
 * 2. partage une demande déjà en cours pour la même session ;
 * 3. sinon attend le qr puis demande le code une seule fois.
 */
function obtainPairingCode(sessionId, sock, cleanPhone) {
  const cached = pairingCodeCache.get(sessionId);
  if (cached && cached.sock === sock && Date.now() - cached.at < PAIRING_CODE_TTL_MS) {
    return Promise.resolve(cached.code);
  }

  const inFlight = pairingFlights.get(sessionId);
  if (inFlight) return inFlight;

  const flight = (async () => {
    const ready = await waitForQr(sock, QR_WAIT_MS);
    if (!ready) {
      throw httpError(503, 'La connexion WhatsApp n\'est pas prête. Réessayez dans un instant.');
    }
    if (!sock.ws?.isOpen || typeof sock.requestPairingCode !== 'function') {
      throw httpError(503, 'La connexion WhatsApp n\'est pas prête. Réessayez dans un instant.');
    }
    if (sock.authState?.creds?.registered) {
      throw httpError(409, 'Une session est déjà enregistrée pour ce numéro.');
    }

    let rawCode;
    try {
      rawCode = await sock.requestPairingCode(cleanPhone);
    } catch (err) {
      const sc = err?.output?.statusCode;
      if (sc === 428 || sc === DisconnectReason.connectionClosed) {
        throw httpError(503, 'La connexion WhatsApp s\'est interrompue. Réessayez dans un instant.');
      }
      throw err;
    }

    const code = rawCode?.match(/.{1,4}/g)?.join('-') || rawCode;
    pairingCodeCache.set(sessionId, { code, at: Date.now(), sock });
    // Compteurs lus par la commande .diag
    waStats.pairingAttempts += 1;
    waStats.lastPairingCodeAt = Date.now();
    return code;
  })().finally(() => pairingFlights.delete(sessionId));

  pairingFlights.set(sessionId, flight);
  return flight;
}

/* ─────────────────────── Routes HTTP ─────────────────────── */

function authorized(req) {
  const token = process.env.PAIRING_API_TOKEN;
  if (!token) return true;
  return req.headers['x-api-token'] === token;
}

// Healthcheck
app.get('/', (req, res) => {
  res.type('text/plain').send('DJOUSSE VIRTUAL GATEWAY est en ligne 🚀');
});

// État du bot (attendu par le site et le proxy Vercel web/api/status.js)
app.get('/status', (req, res) => {
  if (!authorized(req)) {
    return res.status(401).json({ error: 'Jeton d\'API invalide.' });
  }

  // « connecté » = AU MOINS UNE session possède un utilisateur WhatsApp
  // (la session principale peut être en attente pendant qu'une session
  //  pairée via le site est déjà connectée).
  let isConnected = false;
  const details = [];
  for (const [id, sock] of activeSessions) {
    const number = sock?.user?.id ? String(sock.user.id).split(/[:@]/)[0].replace(/\D/g, '') : null;
    const connected = Boolean(sock?.user);
    if (connected) isConnected = true;
    details.push({ id, number, connected });
  }

  return res.status(200).json({
    ok: true,
    connected: isConnected,
    connection: isConnected ? 'open' : 'connecting',
    sessions: activeSessions.size,
    active: activeSessions.size,
    /* Identifiants + numéro réel de chaque socket ouverte : permet de
       savoir QUI est connecté sans deviner (PAIRING_PHONE reflète le
       dernier compte effectivement lié). */
    ids: details.map((d) => d.id),
    details,
  });
});

// Génération du code de jumelage 8 caractères
app.post('/pair', async (req, res) => {
  try {
    if (!authorized(req)) {
      return res.status(401).json({ error: 'Jeton d\'API invalide.' });
    }

    const { phone, sessionId: customSessionId } = req.body || {};
    if (!phone) {
      return res.status(400).json({ error: 'Numéro de téléphone requis.' });
    }

    const cleanPhone = String(phone).replace(/\D/g, '');
    if (!/^\d{8,15}$/.test(cleanPhone)) {
      return res.status(400).json({ error: 'Format de numéro invalide (8 à 15 chiffres).' });
    }

    // Session isolée par numéro (le proxy Vercel envoie aussi son sessionId)
    const sessionId = customSessionId || `session_${cleanPhone}`;
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(sessionId)) {
      return res.status(400).json({ error: 'Identifiant de session invalide.' });
    }

    console.log(`[PAIRING] Requête pour ${sessionId}...`);
    const sock = await initWhatsAppSession(sessionId);

    // Numéro déjà lié à une session → 409 (comme web/api/pair.js l'attend)
    if (sock.authState?.creds?.registered) {
      return res.status(409).json({ error: 'Une session est déjà enregistrée pour ce numéro.' });
    }

    // Code demandé uniquement après confirmation du handshake (qr),
    // dédoublonné et réutilisé pendant 60 s (voir obtainPairingCode).
    const code = await obtainPairingCode(sessionId, sock, cleanPhone);

    console.log(`[PAIRING API] Code généré pour +${cleanPhone} (Session: ${sessionId}) -> ${code}`);
    return res.status(200).json({ success: true, code });
  } catch (error) {
    console.error('[PAIRING API Error]:', error);
    if (res.headersSent) return; // jamais deux réponses → pas de crash
    const status = error.statusCode || 500;
    return res.status(status).json({ status: false, error: error.message || 'Erreur interne lors de la génération du code.' });
  }
});

/* ─────────────────────── Démarrage ─────────────────────── */

// Réchauffe la connexion MongoDB en arrière-plan (sans bloquer l'HTTP)
ensureMongo();

app.listen(PORT, () => {
  console.log(`[HTTP] Serveur Web prêt et à l'écoute sur le port ${PORT}`);
});

/* Session(s) de démarrage, pilotées par BOOT_SESSION :
   - absent / « on »   → djsession (comportement historique) ;
   - « off/false/0/no »→ aucun socket au boot (jumelage via /pair) ;
   - « all/auto/* »    → reprend TOUTES les sessions enregistrées en base
     (multi-clients), plafonnées par MAX_BOOT_SESSIONS (défaut 5) ;
   - « session_XXXX »  → reprend cette session précise (un seul socket,
     reprise automatique après redémarrage Render). */
const bootRaw = String(process.env.BOOT_SESSION || '').trim();
const bootKey = bootRaw.toLowerCase();
const bootOff = ['off', 'false', '0', 'no'].includes(bootKey);
const bootAll = ['all', 'auto', '*'].includes(bootKey);
const bootSessionId = bootRaw && !bootOff && !bootAll && /^[A-Za-z0-9_-]{1,64}$/.test(bootRaw)
  ? bootRaw
  : DEFAULT_SESSION;
const MAX_BOOT_SESSIONS = Math.max(1, Number(process.env.MAX_BOOT_SESSIONS) || 5);

async function bootSessions() {
  if (bootOff) {
    console.log('[SOCKET] BOOT_SESSION=off — aucune session de démarrage (jumelage via /pair uniquement).');
    return;
  }

  if (!bootAll) {
    await initWhatsAppSession(bootSessionId).catch((err) => {
      console.error(`[SOCKET:${bootSessionId}] Échec du démarrage :`, err?.message || err);
    });
    return;
  }

  const ids = (await listRegisteredSessions()).slice(0, MAX_BOOT_SESSIONS);
  if (!ids.length) {
    console.log('[SOCKET] BOOT_SESSION=all — aucune session enregistrée en base.');
    return;
  }

  console.log(`[SOCKET] BOOT_SESSION=all — reprise de ${ids.length} session(s) : ${ids.join(', ')}`);
  for (const id of ids) {
    try {
      await initWhatsAppSession(id);
    } catch (err) {
      console.error(`[SOCKET:${id}] Échec du démarrage :`, err?.message || err);
    }
    /* Délai entre deux ouvertures : évite une rafale de handshakes que
       WhatsApp assimile à un comportement automatisé. */
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

bootSessions().catch((err) => console.error('[SOCKET] Échec du démarrage des sessions :', err?.message || err));
