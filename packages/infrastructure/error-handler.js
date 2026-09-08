import { createLogger } from './logger.js';

const log = createLogger('ERROR-HANDLER');

const ERROR_TYPES = {
  NETWORK: 'NETWORK',
  AI_API: 'AI_API',
  DATABASE: 'DATABASE',
  AUTH: 'AUTH',
  PERMISSION: 'PERMISSION',
  RATE_LIMIT: 'RATE_LIMIT',
  UNKNOWN: 'UNKNOWN',
};

const RETRY_DELAYS = {
  NETWORK: [1000, 2000, 4000],
  AI_API: [2000, 5000, 10000],
  DATABASE: [1000, 3000, 6000],
};

function classifyError(error) {
  const msg = (error?.message || '').toLowerCase();
  const code = error?.code || '';

  if (msg.includes('fetch') || msg.includes('network') || msg.includes('econnrefused') || msg.includes('timeout')) {
    return ERROR_TYPES.NETWORK;
  }
  if (msg.includes('groq') || msg.includes('gemini') || msg.includes('429') || msg.includes('quota') || msg.includes('rate limit')) {
    return ERROR_TYPES.AI_API;
  }
  if (msg.includes('database') || msg.includes('sqlite') || msg.includes('postgres') || msg.includes('pg')) {
    return ERROR_TYPES.DATABASE;
  }
  if (msg.includes('auth') || msg.includes('credential') || msg.includes('session')) {
    return ERROR_TYPES.AUTH;
  }
  if (msg.includes('permission') || msg.includes('forbidden') || msg.includes('admin')) {
    return ERROR_TYPES.PERMISSION;
  }
  if (msg.includes('rate') || msg.includes('limit') || msg.includes('flood')) {
    return ERROR_TYPES.RATE_LIMIT;
  }
  return ERROR_TYPES.UNKNOWN;
}

function getRetryDelay(errorType, attempt) {
  const delays = RETRY_DELAYS[errorType];
  if (!delays) return null;
  if (attempt >= delays.length) return null;
  return delays[attempt];
}

const errorCounts = new Map();
const MAX_ERRORS_PER_TYPE = 10;
const ERROR_WINDOW_MS = 60 * 60 * 1000;

function trackError(errorType) {
  const now = Date.now();
  const entry = errorCounts.get(errorType) || { count: 0, firstAt: now };

  if (now - entry.firstAt > ERROR_WINDOW_MS) {
    entry.count = 0;
    entry.firstAt = now;
  }

  entry.count++;
  errorCounts.set(errorType, entry);

  return entry.count;
}

function shouldNotifyAdmin(errorType) {
  const count = errorCounts.get(errorType)?.count || 0;
  return count === 3 || count === 5 || count === 10 || count % 25 === 0;
}

export function handleError(error, context = {}) {
  const errorType = classifyError(error);
  const count = trackError(errorType);

  const logData = {
    type: errorType,
    message: error?.message || 'Unknown error',
    context,
    occurrences: count,
  };

  if (errorType === ERROR_TYPES.NETWORK || errorType === ERROR_TYPES.AI_API) {
    log.warn(logData, `Erreur ${errorType}`);
  } else if (errorType === ERROR_TYPES.DATABASE) {
    log.error(logData, `Erreur ${errorType}`);
  } else {
    log.error(logData, `Erreur ${errorType}`);
  }

  const retryDelay = getRetryDelay(errorType, context.attempt || 0);

  return {
    errorType,
    shouldRetry: retryDelay !== null,
    retryDelay,
    shouldNotifyAdmin: shouldNotifyAdmin(errorType),
    message: getErrorMessage(errorType),
  };
}

export function getErrorMessage(errorType) {
  const messages = {
    [ERROR_TYPES.NETWORK]: 'Problème de connexion. Réessaie dans quelques secondes.',
    [ERROR_TYPES.AI_API]: 'Service IA temporairement indisponible. Réessaie bientôt.',
    [ERROR_TYPES.DATABASE]: 'Erreur de base de données. Les données sont sauvegardées.',
    [ERROR_TYPES.AUTH]: 'Problème d\'authentification. Contacte un admin.',
    [ERROR_TYPES.PERMISSION]: 'Tu n\'as pas les droits pour cette action.',
    [ERROR_TYPES.RATE_LIMIT]: 'Trop de requêtes. Attends un moment.',
    [ERROR_TYPES.UNKNOWN]: 'Une erreur est survenue. Réessaie.',
  };
  return messages[errorType] || messages[ERROR_TYPES.UNKNOWN];
}

export function getErrorStats() {
  const stats = {};
  for (const [type, data] of errorCounts.entries()) {
    stats[type] = data.count;
  }
  return stats;
}

export function resetErrorStats() {
  errorCounts.clear();
}

export { ERROR_TYPES };
