import crypto from 'crypto';
import { createLogger } from '../logger.js';

const log = createLogger('PATCH');

// ── LRU Cache ───────────────────────────────────────────────
export class LRUCache {
  constructor(maxSize = 500, ttlMs = 1800000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttlMs;
  }

  set(key, value) {
    this.cleanup();
    if (this.cache.size >= this.maxSize) {
      const oldest = this.cache.keys().next().value;
      this.cache.delete(oldest);
    }
    this.cache.set(key, { value, ts: Date.now() });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() - item.ts > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }

  has(key) { return this.get(key) !== null; }

  cleanup() {
    const now = Date.now();
    for (const [k, v] of this.cache.entries()) {
      if (now - v.ts > this.ttl) this.cache.delete(k);
    }
  }

  get size() { return this.cache.size; }
  clear() { this.cache.clear(); }
}

// ── Command Aliases ─────────────────────────────────────────
const COMMAND_ALIASES = {
  '.groups':    '.group list',
  '.groupes':   '.group list',
  '.regles':    '.group regles',
  '.config':    '.group status',
  '.stat':      '.status',
  '.aide':      '.help',
  '.menu':      '.help',
  '.on':        '.group',
  '.off':       '.group stop',
  '.activate':  '.group',
  '.desactive': '.group stop',
};

const VALID_GROUP_PARAMS = ['antilink', 'antibot', 'welcome', 'moderation', 'quiz'];

export function normalizeCommand(input) {
  let cmd = input.trim();
  const lower = cmd.toLowerCase();
  for (const [alias, target] of Object.entries(COMMAND_ALIASES)) {
    if (lower === alias || lower.startsWith(alias + ' ')) {
      cmd = target + cmd.substring(alias.length);
      break;
    }
  }
  return cmd;
}

export function validateGroupParam(param, value) {
  const errors = [];
  if (!VALID_GROUP_PARAMS.includes(param)) {
    errors.push(`Paramètre "${param}" invalide. Valides : ${VALID_GROUP_PARAMS.join(', ')}`);
  }
  if (!['on', 'off'].includes(value?.toLowerCase())) {
    errors.push(`Valeur "${value}" invalide. Utilise on ou off`);
  }
  return errors;
}

// ── Input Sanitization ──────────────────────────────────────
export function sanitizeInput(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u202E/g, '')
    .replace(/[\t ]+/g, ' ')
    .substring(0, 4096)
    .trim();
}

export function sanitizeMessage(text) {
  return sanitizeInput(text);
}

// ── Safe Async Wrapper ──────────────────────────────────────
export function safeAsync(fn, fallback = null) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (e) {
      log.warn(`safeAsync: ${e.message}`);
      return typeof fallback === 'function' ? fallback(e) : fallback;
    }
  };
}

// ── Safe Import ─────────────────────────────────────────────
export async function safeImport(path, fallback = null) {
  try {
    return await import(path);
  } catch {
    log.warn(`Import échoué: ${path}`);
    return fallback;
  }
}

// ── Insult Detection (mots entiers) ────────────────────────
const INSULT_PATTERNS = [
  /\bcon(nard|nasse)?\b/i,
  /\bidiot[e]?\b/i,
  /\bstupide\b/i,
  /\bdébile\b/i,
  /\bmerde(ux)?\b/i,
  /\bput(e|ain)\b/i,
  /\bsalaud\b/i,
  /\bordure\b/i,
  /\bpédé\b/i,
  /\benculé\b/i,
  /\bfils de pute\b/i,
  /\bta gueule\b/i,
  /\bferme ta (gueule|bouche)\b/i,
  /\bnique (ta|sa) (mère|maman|race)\b/i,
];

export function detectInsults(text) {
  const clean = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return INSULT_PATTERNS.some(p => p.test(clean));
}

// ── Spam Detection (with whitelist) ────────────────────────
const SPAM_PATTERNS = [
  /gagnez?\s+\d+[k]?\s*(€|euros?|f\s*cfa|dollars?|\$)/i,
  /cliquez?\s+(ici|vite|maintenant)/i,
  /partagez?\s+(ça|ce message)\s+(à|avec|dans)\s+\d+/i,
  /devenez?\s+(riche|millionnaire)/i,
  /investissement\s+(miracle|garanti|100\s*%)/i,
  /(argent|revenu)\s+(facile|rapide|garanti)/i,
  /offre\s+(limitée|exceptionnelle)\s*!{2,}/i,
];

const TRUSTED_DOMAINS = [
  'google.com', 'youtube.com', 'github.com', 'wikipedia.org',
  'whatsapp.com', 'facebook.com', 'instagram.com', 'twitter.com',
  'roblox.com', 'minecraft.net', 'epicgames.com',
];

function isTrustedDomain(url) {
  try {
    const h = new URL(url).hostname.replace('www.', '');
    return TRUSTED_DOMAINS.some(d => h === d || h.endsWith('.' + d));
  } catch { return false; }
}

export function detectSpam(text) {
  const urlMatch = text.match(/https?:\/\/[^\s]+/);
  if (urlMatch && isTrustedDomain(urlMatch[0])) return false;
  const clean = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return SPAM_PATTERNS.some(p => p.test(clean));
}

// ── Safe Send Message ───────────────────────────────────────
export async function isBotInGroup(sock, groupJid) {
  try {
    if (!groupJid.endsWith('@g.us')) return true;
    const meta = await sock.groupMetadata(groupJid);
    const botId = sock.user?.id?.split(':')[0] + '@s.whatsapp.net';
    return meta.participants?.some(p => p.id.split(':')[0] + '@s.whatsapp.net' === botId);
  } catch { return false; }
}

export async function isGroupReadOnly(sock, groupJid) {
  try {
    if (!groupJid.endsWith('@g.us')) return false;
    const meta = await sock.groupMetadata(groupJid);
    return meta.announce === true;
  } catch { return true; }
}

export async function safeSendMessage(sock, jid, content, options = {}) {
  try {
    if (jid.endsWith('@g.us')) {
      if (!(await isBotInGroup(sock, jid))) {
        log.warn(`Bot hors du groupe ${jid}`);
        return null;
      }
      if (await isGroupReadOnly(sock, jid)) {
        log.warn(`Groupe ${jid} en lecture seule`);
        return null;
      }
    }
    const msg = typeof content === 'string' ? { text: sanitizeMessage(content) } : content;
    return await sock.sendMessage(jid, msg, options);
  } catch (e) {
    log.error(`Envoi échoué ${jid}: ${e.message}`);
    return null;
  }
}

// ── Message Queue ───────────────────────────────────────────
export class MessageQueue {
  constructor(delayMs = 1500) {
    this.queue = [];
    this.delay = delayMs;
    this.processing = false;
  }

  async add(sock, jid, content, options = {}) {
    return new Promise((resolve, reject) => {
      this.queue.push({ sock, jid, content, options, resolve, reject });
      if (!this.processing) this.process();
    });
  }

  async process() {
    if (this.processing) return;
    this.processing = true;
    while (this.queue.length > 0) {
      const { sock, jid, content, options, resolve, reject } = this.queue.shift();
      try {
        resolve(await safeSendMessage(sock, jid, content, options));
      } catch (e) { reject(e); }
      if (this.queue.length > 0) {
        await new Promise(r => setTimeout(r, this.delay));
      }
    }
    this.processing = false;
  }

  get pending() { return this.queue.length; }
  clear() { this.queue = []; this.processing = false; }
}

export const messageQueue = new MessageQueue();

// ── AI Retry + Timeout ──────────────────────────────────────
export async function withTimeout(promise, ms = 30000, msg = 'Timeout') {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error(msg)), ms)),
  ]);
}

export async function withRetry(fn, maxRetries = 3, baseDelay = 1000) {
  let lastErr;
  for (let i = 0; i < maxRetries; i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      if (i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, i)));
      }
    }
  }
  throw lastErr;
}

const aiCache = new LRUCache(300, 1800000);

function aiCacheKey(prompt, model) {
  return crypto.createHash('md5').update(`${model}:${prompt.substring(0, 500)}`).digest('hex');
}

export async function robustAICall(fn, prompt, opts = {}) {
  const { timeout = 30000, retries = 2, model = 'default', cache = true } = opts;
  if (cache) {
    const cached = aiCache.get(aiCacheKey(prompt, model));
    if (cached) return cached;
  }
  const res = await withRetry(
    () => withTimeout(fn(prompt), timeout, `IA timeout ${model}`),
    retries
  );
  if (cache && res) aiCache.set(aiCacheKey(prompt, model), res);
  return res;
}

export function truncatePrompt(prompt, maxTokens = 3000) {
  const maxChars = maxTokens * 4;
  if (prompt.length <= maxChars) return prompt;
  const cut = prompt.substring(0, maxChars);
  const lastDot = cut.lastIndexOf('.');
  const lastNl = cut.lastIndexOf('\n');
  const pt = Math.max(lastDot, lastNl, maxChars - 100);
  return cut.substring(0, pt + 1) + '\n[...tronqué...]';
}

// ── Config Validation ───────────────────────────────────────
const DEFAULTS = {
  MAX_WIDTH: 30,
  PREFIX: '.',
  RATE_LIMIT: 10,
  AI_TIMEOUT: 30000,
  MESSAGE_DELAY: 1500,
};

export function validateConfig(raw = {}) {
  const cfg = { ...DEFAULTS, ...raw };
  const errors = [];
  const port = parseInt(cfg.PORT);
  if (isNaN(port) || port < 1 || port > 65535) errors.push(`PORT invalide: ${cfg.PORT}`);
  if (!cfg.PREFIX || cfg.PREFIX.length !== 1) errors.push(`PREFIX invalide: "${cfg.PREFIX}"`);
  if (errors.length) {
    log.error('Config invalide: ' + errors.join('; '));
    if (process.env.NODE_ENV === 'production') throw new Error(errors.join('\n'));
  }
  return cfg;
}
