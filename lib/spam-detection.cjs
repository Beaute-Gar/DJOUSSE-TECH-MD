'use strict';

/**
 * ============================================================
 * DJOUSSE TECH — SPAM DETECTION
 * ============================================================
 *
 * Détection de spam, publicité et contenus indésirables
 * Adapté de WhatsAppAIModerateur (Python) → Node.js
 *
 * Méthodes :
 * - Mots-clés interdits
 * - Regex anti-pub (URLs, discount, etc.)
 * - Détection flooding (trop de messages en peu de temps)
 * - Détection liens suspects
 * - Score de confiance (0-100)
 *
 * ============================================================
 */

const fs = require('fs');
const path = require('path');

// ─── Paths ─────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, '..', 'database');
const SPAM_CONFIG_FILE = path.join(DATA_DIR, 'spam-config.json');

// ─── Mots-clés interdits (FR + EN) ────────────────────
const DEFAULT_SPAM_KEYWORDS = [
  // Publicité
  'promo', 'promotion', 'discount', 'sale', 'offre', 'deal',
  'achetez', 'buy', 'order', 'commandez', 'gratuit', 'free',
  'gagnant', 'winner', 'lottery', 'loterie', 'prix', 'prize',
  // Crypto/Arnaques
  'bitcoin', 'crypto', 'investissement', 'investment', 'profit',
  'milliardaire', 'billionaire', 'devenez_riche', 'get_rich',
  // Spam générique
  'spam', 'advertisement', 'publicité', 'pub', 'sponsored',
  // Contenu adulte
  'xxx', 'onlyfans', 'adult', 'nsfw', 'sexe', 'sex',
  // Liens raccourcis suspects
  'bit.ly', 'tinyurl', 't.co', 'goo.gl', 'is.gd',
];

// ─── Regex anti-pub ────────────────────────────────────
const AD_PATTERNS = [
  /https?:\/\/[^\s]+/gi,                    // URLs
  /www\.[^\s]+/gi,                          // URLs sans http
  /@\w+/g,                                  // Mentions (@user)
  /\+?\d{8,15}/g,                           // Numéros de téléphone
  /wa\.me\/\w+/gi,                          // Liens WhatsApp
  /chat\.whatsapp\.com\/\w+/gi,             // Groupes WhatsApp
  /t\.me\/\w+/gi,                           // Telegram
  /discord\.gg\/\w+/gi,                     // Discord
  /\b\d{3}[\s.-]?\d{3}[\s.-]?\d{4}\b/g,   // Formats téléphone
];

// ─── Patterns flooding ─────────────────────────────────
const FLOOD_CONFIG = {
  maxMessagesInWindow: 5,      // 5 messages
  windowMs: 10000,             // en 10 secondes
  maxSameEmoji: 3,             // 3 fois le même emoji
  maxForwarded: 2,             // 2 messages transférés
};

// ─── State en mémoire ──────────────────────────────────
const messageHistory = new Map(); // jid -> [{text, timestamp, sender}]
const floodWarnings = new Map();  // jid -> count

// ═══════════════════════════════════════════════════════
// LOGGING
// ═══════════════════════════════════════════════════════

function log(msg) { console.log(`[SPAM] ${msg}`); }

// ═══════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════

function loadConfig() {
  try {
    if (fs.existsSync(SPAM_CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(SPAM_CONFIG_FILE, 'utf8'));
    }
  } catch {}
  return { keywords: DEFAULT_SPAM_KEYWORDS, enabled: true };
}

function saveConfig(config) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SPAM_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
  } catch {}
}

// ═══════════════════════════════════════════════════════
// DÉTECTION SPAM
// ═══════════════════════════════════════════════════════

/**
 * Analyse un message et retourne un score de spam (0-100)
 * @param {string} text - Le message à analyser
 * @param {object} context - { sender, jid, isForwarded, isGroup }
 * @returns {{ score: number, reasons: string[], isSpam: boolean }}
 */
function analyzeMessage(text, context = {}) {
  const config = loadConfig();
  if (!config.enabled) return { score: 0, reasons: [], isSpam: false };

  const reasons = [];
  let score = 0;
  const lower = (text || '').toLowerCase();

  // ── 1. Mots-clés interdits ──
  for (const keyword of config.keywords) {
    if (lower.includes(keyword.toLowerCase())) {
      score += 25;
      reasons.push(`mot-clé: "${keyword}"`);
    }
  }

  // ── 2. Regex anti-pub ──
  for (const pattern of AD_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      score += matches.length * 10;
      reasons.push(`pattern: ${pattern.source.slice(0, 30)}`);
    }
  }

  // ── 3. Détection flooding ──
  const floodResult = checkFlood(context.sender, text, context.jid);
  if (floodResult.isFlood) {
    score += floodResult.score;
    reasons.push(`flood: ${floodResult.reason}`);
  }

  // ── 4. Message transféré ──
  if (context.isForwarded) {
    score += 15;
    reasons.push('message transféré');
  }

  // ── 5. Tout majuscules (SHOUTING) ──
  if (text.length > 20 && text === text.toUpperCase() && /[A-Z]/.test(text)) {
    score += 10;
    reasons.push('tout majuscules');
  }

  // ── 6. Répétition de caractères ──
  if (/(.)\1{4,}/.test(text)) {
    score += 10;
    reasons.push('répétition de caractères');
  }

  // ── 7. Messages très longs ──
  if (text.length > 2000) {
    score += 10;
    reasons.push('message très long');
  }

  // Limiter à 100
  score = Math.min(score, 100);

  return {
    score,
    reasons,
    isSpam: score >= 50,
    severity: score >= 80 ? 'high' : score >= 50 ? 'medium' : 'low',
  };
}

// ═══════════════════════════════════════════════════════
// FLOOD DETECTION
// ═══════════════════════════════════════════════════════

function checkFlood(sender, text, jid) {
  if (!sender || !jid) return { isFlood: false, score: 0 };

  const now = Date.now();
  const key = `${jid}:${sender}`;

  // Initialiser l'historique
  if (!messageHistory.has(key)) {
    messageHistory.set(key, []);
  }

  const history = messageHistory.get(key);
  history.push({ text, timestamp: now });

  // Nettoyer les anciens messages
  while (history.length > 0 && now - history[0].timestamp > FLOOD_CONFIG.windowMs * 2) {
    history.shift();
  }

  // Vérifier le flooding
  const recent = history.filter(m => now - m.timestamp < FLOOD_CONFIG.windowMs);

  if (recent.length >= FLOOD_CONFIG.maxMessagesInWindow) {
    return {
      isFlood: true,
      score: 30,
      reason: `${recent.length} messages en ${FLOOD_CONFIG.windowMs / 1000}s`,
    };
  }

  // Vérifier les emojis répétés
  const emojiCounts = {};
  for (const m of recent) {
    const emojis = m.text.match(/[\p{Emoji}]/gu) || [];
    for (const e of emojis) {
      emojiCounts[e] = (emojiCounts[e] || 0) + 1;
    }
  }
  for (const [emoji, count] of Object.entries(emojiCounts)) {
    if (count >= FLOOD_CONFIG.maxSameEmoji) {
      return {
        isFlood: true,
        score: 20,
        reason: `emoji "${emoji}" répété ${count} fois`,
      };
    }
  }

  return { isFlood: false, score: 0 };
}

// ═══════════════════════════════════════════════════════
// NETTOYAGE
// ═══════════════════════════════════════════════════════

function cleanupHistory() {
  const now = Date.now();
  for (const [key, history] of messageHistory.entries()) {
    while (history.length > 0 && now - history[0].timestamp > 60000) {
      history.shift();
    }
    if (history.length === 0) messageHistory.delete(key);
  }
}

// Nettoyage automatique toutes les minutes
setInterval(cleanupHistory, 60000);

// ═══════════════════════════════════════════════════════
// GESTION DES MOTS-CLÉS
// ═══════════════════════════════════════════════════════

function addKeyword(keyword) {
  const config = loadConfig();
  if (!config.keywords.includes(keyword)) {
    config.keywords.push(keyword);
    saveConfig(config);
    log(`+ mot-clé: "${keyword}"`);
    return true;
  }
  return false;
}

function removeKeyword(keyword) {
  const config = loadConfig();
  const idx = config.keywords.indexOf(keyword);
  if (idx !== -1) {
    config.keywords.splice(idx, 1);
    saveConfig(config);
    log(`- mot-clé: "${keyword}"`);
    return true;
  }
  return false;
}

function getKeywords() {
  return loadConfig().keywords;
}

// ═══════════════════════════════════════════════════════
// RAPPORT
// ═══════════════════════════════════════════════════════

function formatReport() {
  const config = loadConfig();
  return `✦ ─────────────── ✦
   🛡️  S P A M  D E T E C T I O N
✦ ─────────────── ✦

  ▸ Statut    ·  ${config.enabled ? '✅ Actif' : '❌ Inactif'}
  ▸ Mots-clés ·  ${config.keywords.length}
  ▸ Historique ·  ${messageHistory.size} expéditeurs

✦ ─────────────── ✦
> ✦ DJOUSSE TECH ✦`;
}

// ═══════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════

module.exports = {
  analyzeMessage,
  checkFlood,
  addKeyword,
  removeKeyword,
  getKeywords,
  formatReport,
  cleanupHistory,
  DEFAULT_SPAM_KEYWORDS,
  FLOOD_CONFIG,
};
