import { createLogger } from '../../packages/infrastructure/logger.js';

const log = createLogger('SESSION-MGR');

const FATAL_CODES = new Set([401, 403, 428, 515, 519]);

export class SessionManager {
  constructor() {
    this.retryCount = 0;
    this.maxRetries = 5;
    this.baseDelay = 5000;
  }

  classifyError(error) {
    const code = error?.output?.statusCode ?? error?.status ?? null;
    const message = String(error?.message || '');
    if (FATAL_CODES.has(code)) return 'fatal';
    if (code === 408 || code === 503 || code === 516) return 'retry';
    if (/bad mac|prekeyerror|no session|sessionerror/i.test(message)) return 'session';
    return 'retry';
  }

  nextDelay() {
    this.retryCount++;
    if (this.retryCount > this.maxRetries) this.retryCount = this.maxRetries;
    return Math.min(this.baseDelay * this.retryCount, 60000);
  }

  reset() {
    this.retryCount = 0;
  }

  async cleanupSession() {
    const fs = await import('fs');
    const path = await import('path');
    try {
      const sessionDir = path.join(process.cwd(), 'session');
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
        log.info('Session locale supprimée');
      }
    } catch (e) {
      log.warn(`Cleanup session locale: ${e.message}`);
    }
    try {
      const { clearMongoSession } = await import('./mongo-auth.cjs');
      if (typeof clearMongoSession === 'function') {
        await clearMongoSession();
        log.info('Session MongoDB effacée');
      }
    } catch (e) {
      log.warn(`Cleanup session MongoDB: ${e.message}`);
    }
  }
}

let _instance = null;
export function getSessionManager() {
  if (!_instance) _instance = new SessionManager();
  return _instance;
}
