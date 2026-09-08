const LIMITS = {
  MAX_COMMAND_LENGTH : 512,
  MAX_MESSAGE_LENGTH : 10_000,
  MAX_ARGS_COUNT     : 20,
  MAX_ARG_LENGTH     : 1_000,
};

const ZALGO_RE = /[\u0300-\u036f]{5,}/;
const CONTROL_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const BIDI_OVERRIDE_RE = /[\u200e\u200f\u202a\u202b\u202c\u202d\u202e\u2066\u2067\u2068\u2069]/;

const DANGEROUS_PATTERNS = [
  /[\u200b-\u200f\u202a-\u202e\u2060-\u206f\uFEFF]/,
  /\u0000/,
  /[\uFFFE\uFFFF]/,
  /[\u0300-\u036f]{5,}/,
  /(.)\1{199,}/,
];

const BLOCKED_UNICODE_RANGES = [
  [0x202A, 0x202E],
  [0x2066, 0x2069],
  [0xE0000, 0xE007F],
];

function hasBlockedCodepoints(text) {
  for (const char of text) {
    const cp = char.codePointAt(0);
    for (const [lo, hi] of BLOCKED_UNICODE_RANGES) {
      if (cp >= lo && cp <= hi) return true;
    }
  }
  return false;
}

function normalize(text) {
  return text
    .normalize('NFC')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function analyzeText(text) {
  const flags = [];
  let cleaned = (text || '').normalize('NFC');
  if (ZALGO_RE.test(cleaned)) flags.push('ZALGO');
  if (CONTROL_RE.test(cleaned)) flags.push('CONTROL_CHARS');
  if (BIDI_OVERRIDE_RE.test(cleaned)) flags.push('BIDI_OVERRIDE');
  cleaned = cleaned.replace(ZALGO_RE, '').replace(CONTROL_RE, '').replace(BIDI_OVERRIDE_RE, '').trim();
  return { flags, cleaned };
}

export function parseCommand(text, prefix) {
  if (!text.startsWith(prefix)) return null;
  const body = text.slice(prefix.length).trim();
  if (!body) return null;
  const parts = body.split(/\s+/);
  return { command: parts[0].toLowerCase(), args: parts.slice(1), text: parts.slice(1).join(' ') };
}

export function validateText(text) {
  if (text === null || text === undefined) return { safe: false, reason: 'NULL_INPUT' };
  if (typeof text !== 'string') return { safe: false, reason: 'INVALID_TYPE' };
  if (text.trim().length === 0) return { safe: false, reason: 'EMPTY_MESSAGE' };
  if (text.length > LIMITS.MAX_MESSAGE_LENGTH) return { safe: false, reason: `MESSAGE_TOO_LONG:${text.length}` };
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(text)) return { safe: false, reason: 'DANGEROUS_PATTERN_DETECTED' };
  }
  if (hasBlockedCodepoints(text)) return { safe: false, reason: 'BLOCKED_UNICODE_CODEPOINT' };
  const sanitized = normalize(text);
  return { safe: true, sanitized };
}

export function validateCommand(command, args = []) {
  if (!command || typeof command !== 'string') return { safe: false, reason: 'MISSING_COMMAND_NAME' };
  if (command.length > LIMITS.MAX_COMMAND_LENGTH) return { safe: false, reason: 'COMMAND_NAME_TOO_LONG' };
  if (!/^[a-zA-Z0-9_-]+$/.test(command)) return { safe: false, reason: 'INVALID_COMMAND_CHARS' };
  if (!Array.isArray(args)) return { safe: false, reason: 'ARGS_NOT_ARRAY' };
  if (args.length > LIMITS.MAX_ARGS_COUNT) return { safe: false, reason: `TOO_MANY_ARGS:${args.length}` };
  for (let i = 0; i < args.length; i++) {
    if (typeof args[i] !== 'string') return { safe: false, reason: `ARG_${i}_INVALID_TYPE` };
    if (args[i].length > LIMITS.MAX_ARG_LENGTH) return { safe: false, reason: `ARG_${i}_TOO_LONG` };
  }
  return { safe: true };
}

export function sanitizeJid(jid = '') {
  return jid.replace(/[^0-9@.\-_]/g, '');
}

export function sanitizeName(name = '') {
  return name.replace(/[^a-zA-Z0-9À-ÿ\s\-_.]/g, '').slice(0, 50);
}

export function isValidJID(jid) {
  if (!jid || typeof jid !== 'string') return false;
  return /^[\d+]+@(s\.whatsapp\.net|g\.us|broadcast)$/.test(jid);
}

export { LIMITS };
