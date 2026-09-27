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
  ownerNumber: numbers(process.env.OWNER_NUMBER, '237693978044'),

  // Commandes
  prefix: process.env.PREFIX || '.',

  // Session Baileys (dossier des credentials)
  sessionDir: process.env.SESSION_DIR || 'session',

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

  // IA (optionnelle : sans clé, la commande .ai répond avec un message explicite)
  geminiKey: process.env.GEMINI_KEY || process.env.GEMINI_API_KEY || '',

  // Connexion (QR par défaut, pairing si CONNECT_METHOD=pairing)
  connectMethod: (process.env.CONNECT_METHOD || '').toLowerCase(),
  pairingPhone: String(process.env.PAIRING_PHONE || '').replace(/\D/g, ''),

  // Version WhatsApp de repli si toutes les sources échouent
  stableWaVersion: [2, 3000, 1043857760],

  // Réglages appliqués à chaque nouveau groupe (surchageables par .env)
  defaultGroupSettings: {
    antilink: bool(process.env.ANTILINK, false),
    antidelete: bool(process.env.ANTI_DELETE, false),
    welcome: bool(process.env.WELCOME, false),
    goodbye: bool(process.env.ANTI_LEFT, false),
    welcomeMessage: 'Hey @user, bienvenue dans @group !\nMembres: #memberCount',
    goodbyeMessage: '@user a quitté le groupe. Salut !',
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
    maxWarnings: 3,
  },

  // Réseaux
  social: {
    github: 'https://github.com/Beaute-Gar/DJOUSSE-TECH-MD',
  },

  version: require('./package.json').version,
};
