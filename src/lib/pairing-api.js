'use strict';
/**
 * lib/pairing-api.js — API HTTP de jumelage (optionnelle)
 * ────────────────────────────────────────────────────────────────
 * Permet au site « workspace » (et à l'application mobile) d'obtenir un
 * code de jumelage SANS terminal :
 *
 *   GET  /status → { ok, connected, connection, sessions, active }
 *   POST /pair   → { code }   corps : { "number": "+2376XXXXXXXX" }
 *   GET  /*      → site website/ statique (si SERVE_SITE=on : une seule
 *                  URL pour l'app PWA/APK et l'API)
 *
 * DÉSACTIVÉE PAR DÉFAUT (PAIRING_API absent) : le bot reste un worker
 * sans port, comme documenté. Activation :
 *
 *   PAIRING_API=on            # + PAIRING_API_PORT (défaut 8089)
 *   PAIRING_API_TOKEN=...     # fort recommandé si le port est public
 *   SERVE_SITE=on             # sert website/ sur le même port
 *
 * SÉCURITÉ (non négociable) :
 *   - jumelage REFUSÉ (409) si une session est déjà enregistrée ou
 *     connectée → impossible de détourner le bot vers un autre numéro ;
 *   - token partagé optionnel (en-tête x-api-token ou corps .token) ;
 *   - limitation de débit par IP (8 demandes / minute sur /pair) ;
 *   - service statique étanche à la traversée de chemins (normalize +
 *     préfixe strict), méthodes non-GET refusées.
 *
 * Node ≥ 18, zéro dépendance externe (node:http uniquement).
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = require('../config/paths').ROOT;
/* Racine du site servi : website/ (structure normale) — tolère la
   réorganisation website/website/ si index.html s'y trouve. */
const SITE_DIR = (() => {
  const racine = path.join(ROOT, 'web', 'public');
  if (fs.existsSync(path.join(racine, 'index.html'))) return racine;
  const imbrique = path.join(racine, 'website');
  if (fs.existsSync(path.join(imbrique, 'index.html'))) return imbrique;
  return racine;
})();
const DEFAULT_PORT = 8089;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 8; // demandes /pair par IP par fenêtre
const BODY_MAX = 8 * 1024; // 8 Ko suffisent largement pour { number }

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

/* ── limitation de débit (fenêtre glissante en mémoire) ── */
const hits = new Map(); // ip → timestamps[]
function resetRateForTests() { hits.clear(); }
function rateOk(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (list.length >= RATE_MAX) {
    hits.set(ip, list);
    return false;
  }
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 2000) { // purge anti-fuite mémoire
    for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > RATE_WINDOW_MS) hits.delete(k);
  }
  return true;
}

/* ── utilitaires HTTP ── */
function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  return (Array.isArray(fwd) ? fwd[0] : String(fwd || '')).split(',')[0].trim() || req.socket.remoteAddress || '?';
}

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Api-Token',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > BODY_MAX) {
        reject(new Error('corps trop volumineux'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/* ── service statique du site (optionnel) ── */
function serveStatic(res, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  const file = path.normalize(path.join(SITE_DIR, rel));
  // Étanchéité à la traversée : le chemin résolu doit rester dans website/.
  if (!file.startsWith(SITE_DIR + path.sep)) {
    json(res, 403, { error: 'chemin refusé' });
    return;
  }
  fs.readFile(file, (err, buf) => {
    if (err) {
      // SPA à routes de hachage : toute page inconnue retombe sur l'accueil.
      fs.readFile(path.join(SITE_DIR, 'index.html'), (e2, home) => {
        if (e2) {
          json(res, 404, { error: 'site non déployé (dossier website/ absent)' });
          return;
        }
        res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' });
        res.end(home);
      });
      return;
    }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
}

/* ── POST /pair ── */
async function handlePair(req, res, ctx) {
  if (!rateOk(clientIp(req))) {
    json(res, 429, { error: 'Trop de demandes — réessaie dans une minute.' });
    return;
  }

  let payload = {};
  try {
    payload = JSON.parse((await readBody(req)) || '{}');
  } catch {
    json(res, 400, { error: 'Corps JSON invalide ou trop volumineux.' });
    return;
  }

  // Token partagé (si configuré) : en-tête x-api-token ou champ .token
  if (ctx.token) {
    const got = req.headers['x-api-token'] || payload.token || '';
    if (String(got) !== ctx.token) {
      json(res, 401, { error: 'Token d\'API manquant ou invalide (en-tête x-api-token).' });
      return;
    }
  }

  // PROTECTION ANTI-DÉTOURNEMENT : jamais de code sur une session existante.
  if (ctx.isRegistered()) {
    json(res, 409, {
      error: 'Une session est déjà enregistrée sur ce bot — jumelage refusé. Pour changer de numéro, réinitialise la session (dossier sessions/).',
    });
    return;
  }

  const digits = String(payload.number || '').replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) {
    json(res, 400, { error: 'Numéro invalide — indicatif pays + numéro (7 à 15 chiffres), ex. +2376XXXXXXXX.' });
    return;
  }

  /* Garde-fou : un getSocket absent ou cassé doit répondre 503,
     jamais laisser la requête en suspens. */
  let sock = null;
  try {
    sock = typeof ctx.getSocket === 'function' ? ctx.getSocket() : null;
  } catch {
    sock = null;
  }
  if (!sock || typeof sock.requestPairingCode !== 'function') {
    json(res, 503, { error: 'Socket WhatsApp pas encore prête — réessaie dans quelques secondes.' });
    return;
  }

  try {
    const raw = await sock.requestPairingCode(digits);
    const code = String(raw).replace(/\s+/g, '').toUpperCase();
    ctx.log(`[PAIRING-API] Code émis pour …${digits.slice(-4)} : ${code}`);
    json(res, 200, { code });
  } catch (e) {
    ctx.log(`[PAIRING-API] Échec requestPairingCode : ${e?.message || e}`);
    json(res, 502, { error: `WhatsApp a refusé la demande : ${e?.message || e}` });
  }
}

/* ── serveur ── */
function startPairingApi(ctx) {
  const {
    getSocket,
    isRegistered,
    isConnected,
    status = () => 'INCONNU',
    token = '',
    port = DEFAULT_PORT,
    serveSite = false,
    log = (...a) => console.log(...a),
  } = ctx;

  const wrappedIsRegistered = () => !!(isRegistered && isRegistered());
  const wrappedIsConnected = () => !!(isConnected && isConnected());

  const server = http.createServer(async (req, res) => {
    try {
      await routeRequest(req, res);
    } catch (e) {
      /* Filet final : une exception inattendue répond 500 plutôt que de
         laisser le client (le site) attendre indéfiniment. */
      log(`[PAIRING-API] exception non gérée : ${e?.message || e}`);
      try {
        json(res, 500, { error: 'Erreur interne du bot — réessaie dans un instant.' });
      } catch { /* réponse déjà envoyée */ }
    }
  });

  async function routeRequest(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const route = url.pathname;

    if (req.method === 'OPTIONS') { // prévol CORS du site distant
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Api-Token',
        'Access-Control-Max-Age': '86400',
      });
      res.end();
      return;
    }

    if (req.method === 'GET' && route === '/status') {
      const connected = wrappedIsConnected();
      json(res, 200, {
        ok: true,
        connected,
        connection: status(),
        sessions: connected ? 1 : 0,
        active: connected ? 1 : 0,
      });
      return;
    }

    if (req.method === 'POST' && route === '/pair') {
      await handlePair(req, res, {
        getSocket, isRegistered: wrappedIsRegistered, token, log,
      });
      return;
    }

    if (serveSite && req.method === 'GET') {
      serveStatic(res, route);
      return;
    }

    json(res, 404, {
      error: 'route inconnue',
      routes: ['GET /status', 'POST /pair', ...(serveSite ? ['GET /* (site)'] : [])],
    });
  }

  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      log(`[PAIRING-API] ❌ Port ${port} déjà occupé — API de jumelage NON démarrée (le bot continue sans elle).`);
      return;
    }
    log(`[PAIRING-API] ❌ Erreur serveur : ${e.message}`);
  });

  server.listen(port, () => {
    log(`[PAIRING-API] 🌐 API de jumelage active sur le port ${port}${serveSite ? ' (+ site website/)' : ''}${token ? ' — token requis' : ' — SANS TOKEN (port public = à configurer !)'}`);
  });

  return server;
}

module.exports = { startPairingApi, RATE_MAX, RATE_WINDOW_MS, resetRateForTests };
