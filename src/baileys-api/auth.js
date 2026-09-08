import { createRequire } from 'module';

const require = createRequire(import.meta.url);

export function authMiddleware(config) {
  const apiKey = config.API_KEY || config.BOT_TOKEN || null;

  /* CIDR whitelist (anti-ban hardening inspiré d'OpenWA) */
  const antiban = require('../../lib/antiban.cjs');
  const checkIp = (req) => {
    const ip = req.ip || req.connection?.remoteAddress || '';
    const clean = ip.replace(/^::ffff:/, '');
    return antiban.isIpAllowed(clean);
  };

  return (req, res, next) => {
    if (!checkIp(req)) {
      return res.status(403).json({ error: true, message: 'IP not allowed', code: 'CIDR_BLOCKED' });
    }
    if (!apiKey) return next();

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: true, message: 'Authorization header required', code: 'UNAUTHORIZED' });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      return res.status(401).json({ error: true, message: 'Format: Bearer <token>', code: 'UNAUTHORIZED' });
    }

    if (parts[1] !== apiKey) {
      return res.status(403).json({ error: true, message: 'Invalid API key', code: 'FORBIDDEN' });
    }

    next();
  };
}
