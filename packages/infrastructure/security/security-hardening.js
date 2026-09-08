import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import hpp from 'hpp';
import crypto from 'crypto';
import { createLogger } from '../logger.js';

const log = createLogger('SECURITY-HARDENING');

export function configurerHeadersSecurite(app) {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://js.puter.com'],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        styleSrcElem: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'wss:', 'https:'],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    frameguard: { action: 'deny' },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hidePoweredBy: true,
  }));
  app.use(hpp());
  log.info('Headers de securite configures (CSP, HSTS, X-Frame-Options, etc.)');
}

export const limiteurGlobal = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: 'Trop de requetes. Reessaie dans quelques minutes.' },
});

export const limiteurStrict = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: 'Trop de tentatives. Reessaie plus tard.' },
});

export const limiteurCodesSensibles = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { erreur: 'Trop de tentatives de connexion. Reessaie dans 1 heure.' },
});

export function genererTokenCSRF() {
  return crypto.randomBytes(32).toString('hex');
}

export function middlewareVerifierCSRF(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const tokenCookie = req.cookies?.csrf_token;
  const tokenHeader = req.headers['x-csrf-token'];
  if (!tokenCookie || !tokenHeader || tokenCookie !== tokenHeader) {
    return res.status(403).json({ erreur: 'Token de securite invalide ou manquant.' });
  }
  next();
}

export const OPTIONS_COOKIE_SECURISE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 24 * 60 * 60 * 1000,
};

export function verifierSignatureWebhook(corpsBrut, signatureRecue, secret) {
  const signatureCalculee = crypto.createHmac('sha256', secret).update(corpsBrut).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signatureCalculee), Buffer.from(signatureRecue || ''));
}

const tentativesEchouees = new Map();
const SEUIL_BLOCAGE = 5;
const FENETRE_MS = 15 * 60 * 1000;

export function verifierEtEnregistrerTentative(cle) {
  const maintenant = Date.now();
  const entree = tentativesEchouees.get(cle);
  if (!entree || maintenant - entree.premiereTentativeLe > FENETRE_MS) {
    tentativesEchouees.set(cle, { nombre: 1, premiereTentativeLe: maintenant });
    return { bloque: false };
  }
  entree.nombre++;
  if (entree.nombre >= SEUIL_BLOCAGE) {
    return { bloque: true, reessayerDansMs: FENETRE_MS - (maintenant - entree.premiereTentativeLe) };
  }
  return { bloque: false };
}

export function reinitialiserTentatives(cle) {
  tentativesEchouees.delete(cle);
}

export function validerVariablesEnvironnement(variablesRequises) {
  const manquantes = variablesRequises.filter(v => !process.env[v]);
  if (manquantes.length > 0) {
    log.error(`Variables d'environnement manquantes : ${manquantes.join(', ')}`);
    process.exit(1);
  }
  log.info('Toutes les variables d\'environnement requises sont presentes.');
}
