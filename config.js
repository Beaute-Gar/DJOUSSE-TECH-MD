'use strict';
/**
 * config.js — Configuration globale centralisée de DJOUSSE TECH MD
 * Toute valeur modifiable (préfixe, owner, nom du bot) vient du fichier .env.
 * Aucune logique métier ici : uniquement des constantes lues une seule fois.
 */

const dotenv = require('dotenv');
if (process.env.ENV_FILE) dotenv.config({ path: process.env.ENV_FILE });
else dotenv.config();

const bool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return /^(1|true|yes|on)$/i.test(String(value).trim());
};

const numbers = (value, fallback) =>
  String(value || fallback)
    .split(',')
    .map((entry) => entry.trim().replace(/\D/g, ''))
    .filter(Boolean);

/* Photo du .menu : random = photo aléatoire qui tourne toute seule
   (l'API la fournit, échec → image locale → bannière),
   local = image fixe du dossier assets/, off = bannière générée. */
const menuPictureMode = (process.env.MENU_PICTURE_MODE || 'random').trim().toLowerCase();
if (!['random', 'local', 'off'].includes(menuPictureMode)) {
  console.error(`[CONFIG] MENU_PICTURE_MODE invalide (${menuPictureMode}) — mode random utilisé.`);
}

module.exports = {
  // Identité du bot
  botName: process.env.BOT_NAME || 'DJOUSSE TECH',
  botOwnerName: process.env.OWNER_NAME || 'Beaute Gar',
  menuPictureMode: ['random', 'local', 'off'].includes(menuPictureMode) ? menuPictureMode : 'random',
  menuPicturePath: process.env.MENU_PICTURE_PATH || 'assets/anime-profile.jpg',
  // Numéros owner (.env). Au connect, le numéro de la session est AJOUTÉ automatiquement.
  // Module 1 : comparaison STRICTE sur ces chiffres — aucun défaut en dur
  // (AUTO_OWNER ajoute le numéro de session au connect → pas de lockout).
  ownerNumber: numbers(process.env.OWNER_NUMBER, ''),
  // true = le numéro scanné (QR/pairing) devient toujours owner (défaut)
  autoOwner: process.env.AUTO_OWNER !== '0' && process.env.AUTO_OWNER !== 'false',

  // Commandes
  prefix: process.env.PREFIX || '.',

  // Session Baileys (dossier des credentials — le SEUL à effacer pour
  // réappareiller : voir lib/dataDir.js)
  sessionDir: process.env.SESSION_DIR || 'sessions/djsession',

  // Base locale du bot (state, historiques, guard, scheduler, store)
  dataDir: process.env.DATA_DIR || 'data',

  // Stickers
  packname: process.env.PACK_NAME || 'DJOUSSE TECH',
  author: process.env.STICKER_AUTHOR || 'Beaute Gar',

  // Modes de fonctionnement
  selfMode: process.env.MODE === 'self',
  rejectCall: bool(process.env.REJECT_CALL, true),
  autoRead: bool(process.env.AUTO_READ, true),
  autoBio: bool(process.env.AUTO_BIO, false),

  // Moteurs temps réel (Baileys)
  autoTyping: bool(process.env.AUTO_TYPING, false),
  alwaysOnline: bool(process.env.ALWAYS_ONLINE, false),
  autoReact: bool(process.env.AUTO_REACT, false),
  // AUTO-STATUTS (module lib/auto-status.js) — défauts : vue ON, réaction ON, réponse OFF
  autoStatusSeen: bool(process.env.AUTO_STATUS_SEEN, true),
  autoStatusReact: bool(process.env.AUTO_STATUS_REACT, true),
  autoStatusReply: bool(
    process.env.AUTO_STATUS_REPLY !== undefined ? process.env.AUTO_STATUS_REPLY : process.env.AUTO_REPLY_STATUS,
    false,
  ),
  autoStatusMsg: process.env.AUTO_STATUS_MSG || process.env.STATUS_READ_MSG || '',
  // Emojis de réaction tirés au sort (liste CSV) — CUSTOM_REACT_EMOJIS
  statusEmojis: String(process.env.CUSTOM_REACT_EMOJIS || '❤️,🔥,💯,😍,👏').split(','),
  likeEmoji: process.env.AUTOLIKE_EMOJI || '👍',

  // Aperçus de liens haute qualité (Baileys)
  linkPreview: bool(process.env.LINK_PREVIEW, true),

  // Cache messages (getMessage / antidelete / edit / pin) — max entrées en RAM
  msgCacheMax: Math.max(100, parseInt(process.env.MSG_CACHE_MAX || '800', 10) || 800),

  // Durée éphémère par défaut (secondes) : 0 | 86400 (24h) | 604800 (7j) | 7776000 (90j)
  defaultEphemeral: parseInt(process.env.DEFAULT_EPHEMERAL || '0', 10) || 0,

  // IA (optionnelle : sans clé, la commande .ai répond avec un message explicite)
  geminiKey: process.env.GEMINI_KEY || process.env.GEMINI_API_KEY || '',
  // MODULE 4 : secours IA — pris automatiquement si Gemini échoue (lib/ai.js)
  // Liste ordonnée de modèles gratuits TESTÉS en réel le 2026-10-13 :
  // les pools Google sont passées en dernier (429 récurrents côté upstream),
  // NVIDIA d'abord (200 stable). OPENROUTER_MODEL accepte une liste « a, b ».
  openrouterKey: process.env.OPENROUTER_API_KEY || '',
  openrouterModels: String(
    process.env.OPENROUTER_MODEL
      || 'nvidia/nemotron-3-super-120b-a12b:free, nvidia/nemotron-3.5-lightning:free, google/gemma-4-31b-it:free',
  ).split(',').map((s) => s.trim()).filter(Boolean),

  // Connexion (pairing par défaut, QR si CONNECT_METHOD=qr)
  connectMethod: (process.env.CONNECT_METHOD || '').toLowerCase(),
  pairingPhone: String(process.env.PAIRING_PHONE || '').replace(/\D/g, ''),

  // API DE JUMELAGE HTTP (lib/pairing-api.js) — pour le site / l'app.
  // DÉSACTIVÉE par défaut : le bot reste un worker sans port.
  pairingApi: bool(process.env.PAIRING_API, false),
  pairingApiPort: numbers(process.env.PAIRING_API_PORT, 8089),
  pairingApiToken: process.env.PAIRING_API_TOKEN || '',
  // SERVE_SITE=on : sert aussi website/ sur ce port (app + API, une seule URL)
  serveSite: bool(process.env.SERVE_SITE, false),

  // Version WhatsApp de repli si toutes les sources échouent
  stableWaVersion: [2, 3000, 1043857760],

  // Réglages appliqués à chaque nouveau groupe (surchargeables par .env)
  defaultGroupSettings: {
    antilink: bool(process.env.ANTILINK, false),
    antidelete: bool(process.env.ANTI_DELETE, false),
    welcome: bool(process.env.WELCOME, false),
    goodbye: bool(process.env.ANTI_LEFT, false),
    welcomeMessage: 'Hey @user, bienvenue dans @group !\nMembres: #memberCount',
    goodbyeMessage: '@user a quitté le groupe. Salut !',
  },

  // Moteur DJOUSSE GUARD (dossier guard/) — protections de groupe
  guard: {
    // 'bot.db' (SQLite, défaut) · force l'ancien JSON avec GUARD_DB=guard.json
    dbFile: process.env.GUARD_DB || 'bot.db',                   // dans dataDir
    timezone: process.env.GUARD_TZ || 'Africa/Douala',          // fuseau du mode nuit
    log: bool(process.env.GUARD_LOG, false),                    // journal des expulsions → DM owner
    notifyCooldownMs: 10 * 60 * 1000,                           // avis « bot non admin » : 1 / 10 min / groupe
  },

  // Messages système
  messages: {
    wait: '⏳ Attends un peu...',
    success: '✅ C est fait !',
    error: '❌ Oups, ça a pas marché. Réessaie.',
    ownerOnly: '🔒 Réservé au propriétaire du bot.',
    adminOnly: '🛡️ Il faut être admin du groupe pour ça.',
    groupOnly: '👥 Cette commande fonctionne uniquement en groupe.',
    botAdminNeeded: '🤖 Je dois être admin du groupe pour faire ça.',
    privateOnly: '📩 Utilise ça en privé.',
    unknown: '❓ Commande inconnue. Tape .menu pour voir tout.',
  },

  // Réseaux
  social: {
    github: 'https://github.com/Beaute-Gar/DJOUSSE-TECH-MD',
  },

  version: (() => {
    try { return require('./package.json').version; } catch { return '1.0.0'; }
  })(),
};
