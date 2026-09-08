import express from 'express';
import crypto from 'crypto';
import { createLogger } from '../logger.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const config = require('../../../config.cjs');
const log = createLogger('WEB-AUTH');

const router = express.Router();

const SESSIONS = new Map();

const SESSION_TTL = 24 * 60 * 60 * 1000;

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function createSession(userId, provider = 'token') {
  const token = generateToken();
  const session = {
    token,
    userId,
    provider,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL,
  };
  SESSIONS.set(token, session);
  return session;
}

export function getUserFromRequest(req) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.session_token;
  if (!token) return null;
  const session = SESSIONS.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    SESSIONS.delete(token);
    return null;
  }
  return session;
}

export function requireAuth(req, res, next) {
  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ success: false, message: 'Non authentifie' });
  req.user = user;
  next();
}

router.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email et mot de passe requis' });

    const ownerEmail = config.OWNER_EMAIL || '';
    const ownerPassword = config.OWNER_PASSWORD || '';

    if (ownerEmail && ownerPassword) {
      if (email.toLowerCase() !== ownerEmail.toLowerCase() || password !== ownerPassword) {
        return res.status(403).json({ success: false, message: 'Identifiants invalides' });
      }
    } else {
      const pairingToken = config.PAIRING_TOKEN || '';
      if (!pairingToken) return res.status(403).json({ success: false, message: 'Aucune methode d\'auth configuree' });
      if (password !== pairingToken) return res.status(403).json({ success: false, message: 'Token invalide' });
    }

    const session = createSession(email || 'owner', 'password');
    log.info(`Login reussi: ${email || 'owner'}`);
    res.json({ success: true, token: session.token, user: { email: email || 'owner', name: config.OWNER_NAME || 'Owner' } });
  } catch (err) {
    log.error(`Login error: ${err.message}`);
    res.status(500).json({ success: false, message: 'Erreur interne' });
  }
});

router.post('/api/auth/sso', (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email requis' });

    const ownerEmail = config.OWNER_EMAIL || '';
    if (ownerEmail && email.toLowerCase() !== ownerEmail.toLowerCase()) {
      return res.status(403).json({ success: false, message: 'Email non autorise' });
    }

    const session = createSession(email, 'sso');
    log.info(`SSO login: ${email}`);
    res.json({ success: true, token: session.token, user: { email, name: config.OWNER_NAME || email } });
  } catch (err) {
    log.error(`SSO error: ${err.message}`);
    res.status(500).json({ success: false, message: 'Erreur interne' });
  }
});

router.post('/api/auth/logout', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.body?.token;
  if (token) SESSIONS.delete(token);
  res.json({ success: true, message: 'Deconnecte' });
});

router.get('/api/auth/me', (req, res) => {
  const user = getUserFromRequest(req);
  if (!user) return res.json({ authenticated: false });
  res.json({
    authenticated: true,
    user: {
      id: user.userId,
      provider: user.provider,
      name: config.OWNER_NAME || user.userId,
    },
  });
});

export { router as default };
