/**
 * AUTO STATUS QUOTES — DJOUSSE TECH
 * Système de publication automatique de citations sur les statuts WhatsApp
 * 
 * VERSION CORRIGÉE — 2026-09-22
 * - Nettoyage auto des citations corrompues
 * - Anti-spam 30s entre publications
 * - Gestion robuste des erreurs socket
 * - Détection connection lost
 * - Intégration anti-ban (warmup + quotas)
 * - 12 templates variés
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const antiBan = require('../lib/anti-ban.cjs');
const { formatQuote } = require('../lib/templates.cjs');

// ─── Paths ─────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, '..', 'data');
const CACHE_FILE = path.join(DATA_DIR, 'status-quotes-cache.json');
const HISTORY_FILE = path.join(DATA_DIR, 'status-quotes-history.json');
const LOCAL_QUOTES_FILE = path.join(DATA_DIR, 'status-quotes.json');
const COLLECTED_QUOTES_FILE = path.join(DATA_DIR, 'status', 'quotes.json');
const SESSION_CONFIG_FILE = path.join(DATA_DIR, 'status-quotes-session.json');

// ─── Constants ─────────────────────────────────────────
const MAX_STATUS_LENGTH = 350;
const MAX_QUOTE_LENGTH = 250;
const ZENQUOTES_URL = 'https://zenquotes.io/api/quotes';
const ZENQUOTES_TODAY_URL = 'https://zenquotes.io/api/today';
const QUOTABLE_URL = 'https://api.quotable.io/quotes/random?maxLength=250&limit=20';

// ─── Anti-spam globals ─────────────────────────────────
let statusPublicationInProgress = false;
let lastPublishTimestamp = 0;
const MIN_PUBLISH_INTERVAL_MS = 30 * 1000; // 30 secondes minimum entre 2 publications

// ─── Scheduler state ───────────────────────────────────
let schedulerTimers = new Map(); // sessionId -> timer
let cacheRefreshTimer = null;

// ─── Templates ─────────────────────────────────────────
const TEMPLATES = [
  (q, a, bot) => `╭─「 💡 PENSÉE DU JOUR 」\n│\n│ « ${q} »\n│\n│ — ${a}\n│\n╰─「 ${bot} 」`,
  (q, a, bot) => `┏━━「 ✨ SAGESSE 」\n┃\n┃ « ${q} »\n┃\n┃ — ${a}\n┗━━ ${bot}`,
  (q, a, bot) => `「 🧠 RÉFLEXION DU JOUR 」\n\n« ${q} »\n\n— ${a}\n\n⚡ ${bot}`,
  (q, a, bot) => `╭━━━━━━「 🌟 」\n│\n│ ${q}\n│\n│ ─ ${a}\n╰━━━━━━「 ${bot} 」`,
];

// ─── Categories by hour (Africa/Douala) ────────────────
const TIME_CATEGORIES = {
  '06-10': ['motivation', 'réussite', 'discipline'],
  '10-14': ['travail', 'concentration', 'apprentissage'],
  '14-18': ['persévérance', 'ambition', 'technologie'],
  '18-22': ['sagesse', 'réflexion', 'vie'],
  '22-06': ['réflexion', 'paix', 'repos'],
};

// ═══════════════════════════════════════════════════════
// LOGGING
// ═══════════════════════════════════════════════════════

function log(msg) {
  console.log(`[STATUS-QUOTE] ${msg}`);
}

function logError(msg) {
  console.error(`[STATUS-QUOTE] ERROR: ${msg}`);
}

// ═══════════════════════════════════════════════════════
// DATA DIR & FILES
// ═══════════════════════════════════════════════════════

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJSON(filePath, fallback = null) {
  try {
    ensureDataDir();
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    logError(`Erreur lecture ${path.basename(filePath)}: ${e.message}`);
    return fallback;
  }
}

function writeJSON(filePath, data) {
  try {
    ensureDataDir();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    logError(`Erreur écriture ${path.basename(filePath)}: ${e.message}`);
    return false;
  }
}

// ═══════════════════════════════════════════════════════
// HTTP FETCH (with timeout)
// ═══════════════════════════════════════════════════════

function fetchJSON(url, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Request timeout'));
    }, timeoutMs);

    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: timeoutMs }, (res) => {
      if (res.statusCode === 429) {
        clearTimeout(timer);
        reject(new Error('HTTP 429 Rate Limited'));
        return;
      }
      if (res.statusCode !== 200) {
        clearTimeout(timer);
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        clearTimeout(timer);
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Invalid JSON'));
        }
      });
    });

    req.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });

    req.on('timeout', () => {
      req.destroy();
      clearTimeout(timer);
      reject(new Error('Request timeout'));
    });
  });
}

// ═══════════════════════════════════════════════════════
// CACHE CLEANING (NEW)
// ═══════════════════════════════════════════════════════

/**
 * Nettoie les citations corrompues :
 * - Caractères Unicode cassés (�)
 * - Citations coupées en deux (text + author qui forment une phrase)
 * - Guillemets parasites
 * - Entrées vides / trop courtes
 */
function cleanCorruptedQuotes(quotes) {
  if (!Array.isArray(quotes)) return [];
  
  const BAD_CHARS = /[\uFFFD\u0000-\u001F]/g;

  // Étape 1 : fusionner les citations coupées en deux
  const merged = [];
  let i = 0;
  while (i < quotes.length) {
    const q = { ...quotes[i] };
    const next = quotes[i + 1];

    const looksCut = (
      q.author &&
      q.author.length > 10 &&
      /^[a-z]/.test(q.author) &&
      next && 
      next.text
    );

    if (looksCut) {
      q.text = `${q.text} ${q.author}`.trim();
      q.author = next.author || 'Inconnu';
      merged.push(q);
      i += 2;
    } else {
      merged.push(q);
      i += 1;
    }
  }

  // Étape 2 : nettoyer les caractères + filtrer
  const cleaned = merged
    .map(q => ({
      ...q,
      text: (q.text || '').replace(BAD_CHARS, '').trim(),
      author: (q.author || '').replace(BAD_CHARS, '').trim(),
    }))
    .filter(q => {
      if (!q.text || q.text.length < 15) return false;
      if (!q.author || q.author.length < 2) return false;
      if (q.text === q.author) return false;
      if (/[,;:]\s*$/.test(q.text)) return false;
      if (q.text === 'undefined' || q.text === 'null') return false;
      if (q.author === 'undefined' || q.author === 'null') return false;
      return true;
    });

  // Étape 3 : déduplication finale
  const seen = new Set();
  return cleaned.filter(q => {
    const key = q.text.toLowerCase().slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ═══════════════════════════════════════════════════════
// CACHE MANAGEMENT
// ═══════════════════════════════════════════════════════

function loadCache() {
  const cache = readJSON(CACHE_FILE, { quotes: [], lastUpdated: null, source: 'unknown' });
  
  if (!Array.isArray(cache.quotes)) {
    cache.quotes = [];
  }
  
  const before = cache.quotes.length;
  const cleaned = cleanCorruptedQuotes(cache.quotes);
  
  if (cleaned.length !== before) {
    log(`Cache nettoyé : ${before} → ${cleaned.length} citations`);
    cache.quotes = cleaned;
    saveCache(cache);
  }
  
  log(`Cache chargé : ${cache.quotes.length} citations`);
  return cache;
}

function saveCache(cache) {
  return writeJSON(CACHE_FILE, cache);
}

function isCacheValid(cache, maxAgeHours = 6) {
  if (!cache || !cache.quotes || cache.quotes.length === 0) return false;
  if (!cache.lastUpdated) return false;
  const age = Date.now() - new Date(cache.lastUpdated).getTime();
  return age < maxAgeHours * 60 * 60 * 1000;
}

function normalizeQuote(quote) {
  return {
    text: (quote.text || quote.q || '').trim(),
    author: (quote.author || quote.a || 'Inconnu').trim(),
    source: quote.source || 'unknown',
    category: quote.category || null,
  };
}

function isValidQuote(quote) {
  if (!quote) return false;
  const text = quote.text || quote.q || '';
  const author = quote.author || quote.a || '';
  if (!text || text.length < 10) return false;
  if (text === 'undefined' || text === 'null' || text === 'API error') return false;
  if (author === 'undefined' || author === 'null') return false;
  return true;
}

function deduplicateQuotes(quotes) {
  const seen = new Set();
  return quotes.filter(q => {
    const key = `${(q.text || q.q || '').toLowerCase()}|${(q.author || q.a || '').toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchFromZenQuotes() {
  try {
    log('Tentative ZenQuotes...');
    const data = await fetchJSON(ZENQUOTES_URL, 15000);
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Empty response');
    }
    const valid = data.filter(isValidQuote).map(normalizeQuote);
    log(`ZenQuotes: ${valid.length} citations récupérées`);
    return valid;
  } catch (e) {
    logError(`API ZenQuotes indisponible: ${e.message}`);
    return null;
  }
}

async function fetchFromQuotable() {
  try {
    log('Tentative Quotable...');
    const data = await fetchJSON(QUOTABLE_URL, 15000);
    const results = data.results || data;
    if (!Array.isArray(results) || results.length === 0) {
      throw new Error('Empty response');
    }
    const valid = results.filter(isValidQuote).map(q => normalizeQuote({
      text: q.content,
      author: q.author,
      source: 'quotable',
    }));
    log(`Quotable: ${valid.length} citations récupérées`);
    return valid;
  } catch (e) {
    logError(`API Quotable indisponible: ${e.message}`);
    return null;
  }
}

function loadLocalQuotes() {
  const local = readJSON(LOCAL_QUOTES_FILE, []);
  const legacy = Array.isArray(local) ? local.filter(isValidQuote).map(normalizeQuote) : [];
  
  const collected = readJSON(COLLECTED_QUOTES_FILE, []);
  const mapped = Array.isArray(collected) ? collected.filter(isValidQuote).map(q => ({
    text: (q.text || '').trim(),
    author: (q.author || 'Inconnu').trim(),
    source: 'collector',
    category: q.categories ? q.categories[0] : (q.category || null),
  })) : [];
  
  return [...legacy, ...mapped];
}

function getQuoteStats() {
  const cache = loadCache();
  const local = loadLocalQuotes();
  const history = loadHistory();
  return {
    cacheCount: cache.quotes.length,
    localCount: local.length,
    historyCount: history.length,
    lastCacheUpdate: cache.lastUpdated,
    sources: [...new Set(local.map(q => q.source))],
  };
}

async function refreshCache() {
  log('Rafraîchissement du cache...');
  
  const cache = loadCache();
  let allQuotes = [...cache.quotes];
  
  const zenQuotes = await fetchFromZenQuotes();
  if (zenQuotes && zenQuotes.length > 0) {
    allQuotes = deduplicateQuotes([...allQuotes, ...zenQuotes]);
  }
  
  if (allQuotes.length < 100) {
    const quotableQuotes = await fetchFromQuotable();
    if (quotableQuotes && quotableQuotes.length > 0) {
      allQuotes = deduplicateQuotes([...allQuotes, ...quotableQuotes]);
    }
  }
  
  const localQuotes = loadLocalQuotes();
  if (localQuotes.length > 0) {
    allQuotes = deduplicateQuotes([...allQuotes, ...localQuotes]);
    log(`Sources locales chargées: ${localQuotes.length} citations`);
  }
  
  // Nettoyage final
  allQuotes = cleanCorruptedQuotes(allQuotes);
  
  if (allQuotes.length > 0) {
    saveCache({ quotes: allQuotes, lastUpdated: new Date().toISOString(), source: 'mixed' });
    log(`Cache mis à jour: ${allQuotes.length} citations total`);
  } else {
    log('Aucune source disponible pour rafraîchir le cache');
  }
}

// ═══════════════════════════════════════════════════════
// HISTORY
// ═══════════════════════════════════════════════════════

function loadHistory(sessionId = 'default') {
  const all = readJSON(HISTORY_FILE, {});
  return all[sessionId] || [];
}

function saveHistory(sessionId, history) {
  const all = readJSON(HISTORY_FILE, {});
  all[sessionId] = history;
  return writeJSON(HISTORY_FILE, all);
}

function recordHistory(sessionId, quote, source) {
  const history = loadHistory(sessionId);
  history.unshift({
    text: quote.text,
    author: quote.author,
    source: source,
    publishedAt: new Date().toISOString(),
    sessionId: sessionId,
  });
  if (history.length > 100) history.length = 100;
  saveHistory(sessionId, history);
}

function isDuplicate(quote, sessionId, noRepeatDays = 30) {
  const history = loadHistory(sessionId);
  const cutoff = Date.now() - (noRepeatDays * 24 * 60 * 60 * 1000);
  const normalizedText = quote.text.toLowerCase().trim();
  const normalizedAuthor = quote.author.toLowerCase().trim();
  
  return history.some(h => {
    if (new Date(h.publishedAt).getTime() < cutoff) return false;
    return (
      h.text.toLowerCase().trim() === normalizedText ||
      (h.author.toLowerCase().trim() === normalizedAuthor && 
       h.text.toLowerCase().trim().includes(normalizedText.substring(0, 30)))
    );
  });
}

// ═══════════════════════════════════════════════════════
// QUOTE SELECTION
// ═══════════════════════════════════════════════════════

function getTimeCategory() {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Africa/Douala',
    });
    const [hourStr] = formatter.format(now).split(':');
    const hour = parseInt(hourStr, 10);
    
    if (hour >= 6 && hour < 10) return TIME_CATEGORIES['06-10'];
    if (hour >= 10 && hour < 14) return TIME_CATEGORIES['10-14'];
    if (hour >= 14 && hour < 18) return TIME_CATEGORIES['14-18'];
    if (hour >= 18 && hour < 22) return TIME_CATEGORIES['18-22'];
    return TIME_CATEGORIES['22-06'];
  } catch {
    return ['motivation', 'vie'];
  }
}

function selectQuote(sessionId, noRepeatDays = 30) {
  const cache = loadCache();
  let quotes = cache.quotes;
  
  const localQuotes = loadLocalQuotes();
  if (localQuotes.length > 0) {
    quotes = deduplicateQuotes([...quotes, ...localQuotes]);
  }
  
  if (quotes.length === 0) {
    log('Cache vide, tentative rafraîchissement...');
    return null;
  }
  
  const available = quotes.filter(q => !isDuplicate(q, sessionId, noRepeatDays));
  
  if (available.length === 0) {
    log('Toutes les citations ont été utilisées récemment');
    const fallback = quotes[Math.floor(Math.random() * quotes.length)];
    return fallback;
  }
  
  const timeCats = getTimeCategory();
  const categorized = available.filter(q => 
    q.category && timeCats.includes(q.category)
  );
  
  const pool = categorized.length > 0 ? categorized : available;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ═══════════════════════════════════════════════════════
// FORMATTING
// ═══════════════════════════════════════════════════════

function formatStatus(quote, botName = 'DJOUSSE TECH') {
  const templateIndex = Math.floor(Math.random() * TEMPLATES.length);
  const template = TEMPLATES[templateIndex];
  return template(quote.text, quote.author, botName);
}

function validateStatusLength(text) {
  const length = text.length;
  return {
    valid: length <= MAX_STATUS_LENGTH,
    length: length,
    max: MAX_STATUS_LENGTH,
  };
}

// ═══════════════════════════════════════════════════════
// SESSION CONFIG
// ═══════════════════════════════════════════════════════

function getSessionConfig(sessionId) {
  const all = readJSON(SESSION_CONFIG_FILE, {});
  if (!all[sessionId]) {
    all[sessionId] = {
      enabled: true,
      lastPublished: null,
      schedule: process.env.STATUS_QUOTES_SCHEDULE || '07:00,12:00,18:00,21:00',
      intervalHours: parseInt(process.env.STATUS_QUOTES_INTERVAL_HOURS || '6', 10),
      source: process.env.STATUS_QUOTES_SOURCE || 'zenquotes',
      fallback: process.env.STATUS_QUOTES_FALLBACK || 'quotable',
      maxLength: parseInt(process.env.STATUS_QUOTES_MAX_LENGTH || '350', 10),
      noRepeatDays: parseInt(process.env.STATUS_QUOTES_NO_REPEAT_DAYS || '30', 10),
      cacheRefreshHours: parseInt(process.env.STATUS_QUOTES_CACHE_REFRESH_HOURS || '6', 10),
    };
    writeJSON(SESSION_CONFIG_FILE, all);
  }
  return all[sessionId];
}

function updateSessionConfig(sessionId, updates) {
  const all = readJSON(SESSION_CONFIG_FILE, {});
  if (!all[sessionId]) {
    all[sessionId] = getSessionConfig(sessionId);
  }
  Object.assign(all[sessionId], updates);
  writeJSON(SESSION_CONFIG_FILE, all);
  return all[sessionId];
}

// ═══════════════════════════════════════════════════════
// WHATSAPP STATUS PUBLICATION (CORRIGÉ)
// ═══════════════════════════════════════════════════════

function checkWhatsAppConnection(sock) {
  if (!sock) {
    logError('Socket absent');
    return { ok: false, reason: 'no_socket' };
  }
  if (!sock.user || !sock.user.id) {
    logError('Socket non connecté (pas de user)');
    return { ok: false, reason: 'not_connected' };
  }
  
  // Check WebSocket state (protégé contre undefined)
  const wsState = sock.ws?.readyState ?? sock.ws?.socket?.readyState;
  if (wsState !== undefined && wsState !== 1) {
    logError(`WebSocket non ouvert (state=${wsState})`);
    return { ok: false, reason: 'ws_closed' };
  }
  
  return { ok: true };
}

/**
 * Publie un statut texte sur WhatsApp
 * @returns {Promise<{success: boolean, id?: string, reason?: string, error?: string}>}
 */
async function publishStatus(sock, text) {
  const check = checkWhatsAppConnection(sock);
  if (!check.ok) {
    return { success: false, reason: check.reason };
  }

  try {
    log('Envoi du statut...');

    const result = await sock.sendMessage('status@broadcast', {
      text: text,
    }, {
      backgroundColor: '#0A0A0A',
      font: 3,
      statusJidList: [],
    });

    if (result?.key?.id) {
      log(`✅ Publication réussie (ID: ${result.key.id})`);
      return { success: true, id: result.key.id };
    }

    log('⚠️ Publication envoyée sans confirmation ID');
    return { success: true, id: null };

  } catch (e) {
    logError(`Échec publication: ${e.message}`);

    const msg = (e.message || '').toLowerCase();
    if (
      msg.includes('connection') ||
      msg.includes('closed') ||
      msg.includes('socket') ||
      msg.includes('not open') ||
      msg.includes('timeout') ||
      msg.includes('stream')
    ) {
      logError('→ Erreur de connexion détectée, le socket doit être reconnecté');
      return { success: false, reason: 'connection_lost', error: e.message };
    }

    return { success: false, reason: 'unknown', error: e.message };
  }
}

// ═══════════════════════════════════════════════════════
// MAIN PUBLISH PIPELINE (CORRIGÉ)
// ═══════════════════════════════════════════════════════

async function publishQuoteStatus(sock, sessionId, config) {
  // ─── Check anti-ban ───
  const banCheck = antiBan.canPublishStatus();
  if (!banCheck.ok) {
    log(`⛔ Anti-ban: ${banCheck.reason}`);
    return false;
  }
  
  // ─── Anti-spam court terme ───
  const now = Date.now();
  const sinceLast = now - lastPublishTimestamp;
  if (sinceLast < MIN_PUBLISH_INTERVAL_MS) {
    const wait = Math.ceil((MIN_PUBLISH_INTERVAL_MS - sinceLast) / 1000);
    log(`⏳ Anti-spam : attends encore ${wait}s`);
    return false;
  }
  
  if (statusPublicationInProgress) {
    log('Publication déjà en cours, ignoré');
    return false;
  }
  
  statusPublicationInProgress = true;
  lastPublishTimestamp = now;
  
  try {
    // 1. Select quote
    const quote = selectQuote(sessionId, config.noRepeatDays);
    if (!quote) {
      log('Aucune citation disponible');
      return false;
    }
    log(`Citation: "${quote.text.substring(0, 50)}..." — ${quote.author}`);
    
    // 2. Format avec template varié
    let botName = 'DJOUSSE TECH';
    try {
      botName = require('../config').botName || botName;
    } catch {}
    
    let statusText = formatQuote(quote, botName);
    
    // 3. Check length
    const lengthCheck = validateStatusLength(statusText);
    if (!lengthCheck.valid) {
      log('Statut trop long, tentative citation plus courte...');
      const shorterQuote = selectShorterQuote(sessionId, config.noRepeatDays, 150);
      if (shorterQuote) {
        statusText = formatQuote(shorterQuote, botName);
        if (!validateStatusLength(statusText).valid) {
          return false;
        }
      } else {
        return false;
      }
    }
    
    // 4. Délai humain
    await antiBan.randomDelay(3000, 10000);
    
    // 5. Publish
    log('Publication...');
    const result = await publishStatus(sock, statusText);
    
    if (result.success) {
      antiBan.recordStatus();
      recordHistory(sessionId, quote, config.source);
      log('✅ Publication réussie');
      
      // ─── Post dans la chaîne (si configurée) ───
      if (config.channelJid) {
        await postToChannel(sock, config.channelJid, quote, botName);
      }
      
      return true;
    }
    
    // ─── Gestion échec ───
    if (result.reason === 'connection_lost' || result.reason === 'ws_closed') {
      logError('🔌 Connexion perdue');
      process.emit('whatsapp:reconnect', { reason: result.reason });
    }
    
    return false;
  } catch (e) {
    logError(`Erreur pipeline: ${e.message}`);
    return false;
  } finally {
    statusPublicationInProgress = false;
  }
}

/**
 * Publie une citation dans la chaîne WhatsApp
 */
async function postToChannel(sock, channelJid, quote, botName) {
  const channelCheck = antiBan.canPublishChannel();
  if (!channelCheck.ok) {
    log(`⛔ Chaîne: ${channelCheck.reason}`);
    return;
  }
  
  const channelText = formatQuote(quote, botName);
  
  try {
    await sock.sendMessage(channelJid, { text: channelText });
    antiBan.recordChannelPost();
    log(`✅ Post publié dans la chaîne`);
  } catch (e) {
    logError(`Erreur publication chaîne: ${e.message}`);
  }
}

function selectShorterQuote(sessionId, noRepeatDays, maxLength) {
  const cache = loadCache();
  let quotes = cache.quotes;
  const localQuotes = loadLocalQuotes();
  if (localQuotes.length > 0) {
    quotes = deduplicateQuotes([...quotes, ...localQuotes]);
  }
  
  const available = quotes.filter(q => 
    !isDuplicate(q, sessionId, noRepeatDays) &&
    q.text.length <= maxLength
  );
  
  return available.length > 0 ? available[Math.floor(Math.random() * available.length)] : null;
}

// ═══════════════════════════════════════════════════════
// SCHEDULER
// ═══════════════════════════════════════════════════════

function getNextScheduleTime(schedule) {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Africa/Douala',
    });
    const currentTime = formatter.format(now);
    const [currentHour, currentMin] = currentTime.split(':').map(Number);
    const currentMinutes = currentHour * 60 + currentMin;
    
    const times = schedule.split(',').map(t => {
      const [h, m] = t.trim().split(':').map(Number);
      return h * 60 + m;
    }).sort((a, b) => a - b);
    
    for (const time of times) {
      if (time > currentMinutes) {
        const h = Math.floor(time / 60);
        const m = time % 60;
        const target = new Date(now);
        target.setHours(h, m, 0, 0);
        return target;
      }
    }
    
    const firstTime = times[0];
    const h = Math.floor(firstTime / 60);
    const m = firstTime % 60;
    const target = new Date(now);
    target.setDate(target.getDate() + 1);
    target.setHours(h, m, 0, 0);
    return target;
  } catch {
    return new Date(Date.now() + 6 * 60 * 60 * 1000);
  }
}

function startScheduler(sock, sessionId) {
  if (schedulerTimers.has(sessionId)) {
    log(`Scheduler déjà actif pour ${sessionId}`);
    return;
  }
  
  const sessionConf = getSessionConfig(sessionId);
  if (!sessionConf.enabled) {
    log(`Status quotes désactivé pour ${sessionId}`);
    return;
  }
  
  log(`Démarrage scheduler pour ${sessionId}`);
  
  function scheduleNext() {
    const conf = getSessionConfig(sessionId);
    if (!conf.enabled) {
      log(`Scheduler arrêté pour ${sessionId} (désactivé)`);
      return;
    }
    
    let delay;
    if (conf.schedule && conf.schedule.includes(':')) {
      const nextTime = getNextScheduleTime(conf.schedule);
      delay = nextTime.getTime() - Date.now();
      if (delay < 60000) delay = 60000;
      log(`Prochaine publication: ${nextTime.toLocaleTimeString('fr-FR', { timeZone: 'Africa/Douala' })}`);
    } else {
      delay = conf.intervalHours * 60 * 60 * 1000;
      log(`Prochaine publication dans ${conf.intervalHours}h`);
    }
    
    const timer = setTimeout(async () => {
      schedulerTimers.delete(sessionId);
      try {
        await publishQuoteStatus(sock, sessionId, conf);
      } catch (e) {
        logError(`Erreur scheduler: ${e.message}`);
      }
      scheduleNext();
    }, delay);
    
    schedulerTimers.set(sessionId, timer);
  }
  
  scheduleNext();
}

function stopScheduler(sessionId) {
  const timer = schedulerTimers.get(sessionId);
  if (timer) {
    clearTimeout(timer);
    schedulerTimers.delete(sessionId);
    log(`Scheduler arrêté pour ${sessionId}`);
  }
}

// ═══════════════════════════════════════════════════════
// CACHE REFRESH SCHEDULER
// ═══════════════════════════════════════════════════════

function startCacheRefresh(intervalHours = 6) {
  if (cacheRefreshTimer) {
    clearInterval(cacheRefreshTimer);
  }
  
  refreshCache().catch(e => logError(`Erreur refresh initial: ${e.message}`));
  
  cacheRefreshTimer = setInterval(() => {
    refreshCache().catch(e => logError(`Erreur refresh: ${e.message}`));
  }, intervalHours * 60 * 60 * 1000);
  
  log(`Cache refresh démarré (toutes les ${intervalHours}h)`);
}

function stopCacheRefresh() {
  if (cacheRefreshTimer) {
    clearInterval(cacheRefreshTimer);
    cacheRefreshTimer = null;
  }
}

/**
 * Publication manuelle immédiate (pour tests / commande .status)
 */
async function forcePublishNow(sock, sessionId = 'default') {
  log('═══ Publication MANUELLE déclenchée ═══');
  const conf = getSessionConfig(sessionId);
  const result = await publishQuoteStatus(sock, sessionId, conf);
  log(`═══ Résultat: ${result ? '✅ OK' : '❌ ÉCHEC'} ═══`);
  return result;
}

// ═══════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════

module.exports = {
  // Core
  publishQuoteStatus,
  selectQuote,
  formatStatus,
  validateStatusLength,
  getQuoteStats,
  forcePublishNow,
  
  // Cache
  loadCache,
  saveCache,
  refreshCache,
  isCacheValid,
  cleanCorruptedQuotes,
  
  // History
  loadHistory,
  recordHistory,
  isDuplicate,
  
  // Session
  getSessionConfig,
  updateSessionConfig,
  
  // Scheduler
  startScheduler,
  stopScheduler,
  startCacheRefresh,
  stopCacheRefresh,
  
  // Connection check
  checkWhatsAppConnection,
  publishStatus,
  
  // Constants
  MAX_STATUS_LENGTH,
  MAX_QUOTE_LENGTH,
  MIN_PUBLISH_INTERVAL_MS,
  TEMPLATES,
  TIME_CATEGORIES,
  
  // State
  getStatus: () => ({
    publicationInProgress: statusPublicationInProgress,
    lastPublishTimestamp,
    activeSchedulers: Array.from(schedulerTimers.keys()),
    cacheRefreshActive: cacheRefreshTimer !== null,
  }),
};
