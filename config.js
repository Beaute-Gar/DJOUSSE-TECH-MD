'use strict';
/**
 * config.js — Configuration globale centralisée de DJOUSSE TECH MD
 * Toute valeur modifiable (préfixe, owner, nom du bot) vient du fichier .env.
 * Aucune logique métier ici : uniquement des constantes lues une seule fois.
 */

require('dotenv').config();

const bool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return /^(1|true|yes|on)$/i.test(String(value).trim());
};

const numbers = (value, fallback) =>
  String(value || fallback)
    .split(',')
    .map((entry) => entry.trim().replace(/\D/g, ''))
    .filter(Boolean);

module.exports = {
  // Identité du bot
  botName: process.env.BOT_NAME || 'DJOUSSE TECH',
  botOwnerName: process.env.OWNER_NAME || 'Beaute Gar',
  // Numéros owner (.env). Au connect, le numéro de la session est AJOUTÉ automatiquement.
  ownerNumber: numbers(process.env.OWNER_NUMBER, '237693978044'),
  // true = le numéro scanné (QR/pairing) devient toujours owner (défaut)
  autoOwner: process.env.AUTO_OWNER !== '0' && process.env.AUTO_OWNER !== 'false',

  // Commandes
  prefix: process.env.PREFIX || '.',

  // Session Baileys (dossier des credentials — le SEUL à effacer pour
  // réappareiller : voir lib/dataDir.js)
  sessionDir: process.env.SESSION_DIR || 'session',

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
  autoStatusSeen: bool(process.env.AUTO_STATUS_SEEN, false),
  autoStatusReact: bool(process.env.AUTO_STATUS_REACT, false),
  autoReplyStatus: bool(process.env.AUTO_REPLY_STATUS, false),
  likeEmoji: process.env.AUTOLIKE_EMOJI || '👍',
  statusReadMsg: process.env.STATUS_READ_MSG || '',

  // Aperçus de liens haute qualité (Baileys)
  linkPreview: bool(process.env.LINK_PREVIEW, true),

  // Cache messages (getMessage / antidelete / edit / pin) — max entrées en RAM
  msgCacheMax: Math.max(100, parseInt(process.env.MSG_CACHE_MAX || '800', 10) || 800),

  // Durée éphémère par défaut (secondes) : 0 | 86400 (24h) | 604800 (7j) | 7776000 (90j)
  defaultEphemeral: parseInt(process.env.DEFAULT_EPHEMERAL || '0', 10) || 0,

  // IA (optionnelle : sans clé, la commande .ai répond avec un message explicite)
  geminiKey: process.env.GEMINI_KEY || process.env.GEMINI_API_KEY || '',

  // Connexion (QR par défaut, pairing si CONNECT_METHOD=pairing)
  connectMethod: (process.env.CONNECT_METHOD || '').toLowerCase(),
  pairingPhone: String(process.env.PAIRING_PHONE || '').replace(/\D/g, ''),

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
    // Avis *d'infraction* (quand Vigil a nommé la règle) : nettement plus
    // court, sinon le constat le plus utile est aussi le plus rare.
    noticeCooldownMs: Number(process.env.GUARD_NOTICE_COOLDOWN_MS) || 60 * 1000,

    // Pont vers Vigil, la console de modération (github.com/Beaute-Gar/vigil).
    // Tant que VIGIL_URL est vide, le pont est inert : le bot fonctionne
    // exactement comme avant, sans requête réseau supplémentaire.
    vigil: {
      url: String(process.env.VIGIL_URL || '').replace(/\/+$/, ''),
      email: process.env.VIGIL_EMAIL || '',
      password: process.env.VIGIL_PASSWORD || '',
      timeoutMs: Number(process.env.VIGIL_TIMEOUT_MS) || 1200,
      // 'enrich' = Vigil informe, n'annule rien (défaut, sûr)
      // 'veto'   = si Vigil dit « propre », la protection passe son chemin
      mode: process.env.VIGIL_MODE === 'veto' ? 'veto' : 'enrich',
    },
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

