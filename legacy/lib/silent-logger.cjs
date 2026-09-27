/**
 * lib/silent-logger.cjs
 * Logger qui filtre les erreurs Bad MAC et autres bruits de Baileys
 */

const pino = require('pino');

const IGNORED_KEYWORDS = [
  'Bad MAC', 'Failed to decrypt', 'Session error', 'libsignal',
  'session_cipher', 'MessageCounterError', 'Closing session',
  'Closing open session', 'Key used already', 'Invalid PreKey',
  'old counter', 'Duplicate Message', 'decryptWithSessions',
  'doDecryptWhisperMessage',
];

function shouldIgnore(msg) {
  if (!msg) return false;
  const str = typeof msg === 'string' ? msg : JSON.stringify(msg);
  return IGNORED_KEYWORDS.some(kw => str.includes(kw));
}

const silentLogger = pino({ level: 'silent', transport: undefined });

silentLogger.error = (...args) => { if (!shouldIgnore(args[0])) console.error('[ERROR]', ...args); };
silentLogger.warn  = (...args) => { if (!shouldIgnore(args[0])) console.warn('[WARN]', ...args); };
silentLogger.info  = () => {};
silentLogger.debug = () => {};
silentLogger.trace = () => {};
silentLogger.fatal = (...args) => console.error('[FATAL]', ...args);

module.exports = silentLogger;
