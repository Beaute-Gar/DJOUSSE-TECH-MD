import { createLogger } from '../../packages/infrastructure/logger.js';

const log = createLogger('API-MW');

export function rateLimiter(maxPerMin = 60) {
  const hits = new Map();
  const interval = 60000;
  setInterval(() => hits.clear(), interval);
  return (req, res, next) => {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const count = (hits.get(ip) || 0) + 1;
    hits.set(ip, count);
    if (count > maxPerMin) {
      res.status(429).json({ error: 'Too many requests' });
      return;
    }
    next();
  };
}

export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Cache-Control', 'no-store');
  next();
}

export function cors(origins = ['*']) {
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (origins.includes('*') || origins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  };
}

export function auth(apiKey) {
  return (req, res, next) => {
    const key = req.headers['x-api-key'] || req.query.api_key;
    if (!apiKey || key === apiKey) return next();
    res.status(401).json({ error: 'Unauthorized' });
  };
}

export function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    log.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
}
