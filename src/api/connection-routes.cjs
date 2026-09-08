'use strict';
/**
 * connection-routes.cjs — Routes API pour le système de connexions multi-utilisateurs.
 *
 * Endpoints :
 *   POST /api/connection/create        — Créer une connexion (QR ou Pairing)
 *   GET  /api/connection/:id/status    — Statut d'une connexion
 *   GET  /api/connection/:id/qr        — QR code d'une connexion
 *   GET  /api/connection/:id/events    — SSE events en temps réel
 *   GET  /api/connection/list          — Liste toutes les connexions
 *   POST /api/connection/:id/destroy   — Détruire une connexion
 *
 * Tous les endpoints sont compatibles avec l'existant :
 *   POST /pair → POST /api/connection/create (method=pairing)
 *   GET /api/status → GET /api/connection/list (agrégé)
 */

const sockManager = require('../core/sock-manager.cjs');

function log(msg) { console.log('[CONN-ROUTES] ' + msg); }

/**
 * Monte les routes sur l'application Express.
 *
 * @param {Express} app
 * @param {Object} opts
 * @param {Function} opts.startPairing - Fonction pour démarrer le pairing (accountManager.connectAccount)
 * @param {Function} opts.startQr - Fonction pour démarrer la connexion QR
 * @param {Function} [opts.authenticate] - Middleware d'authentification optionnel
 */
function mountRoutes(app, opts = {}) {
  const { startPairing, startQr, authenticate } = opts;

  /* ── POST /api/connection/create ── */
  app.post('/api/connection/create', async (req, res) => {
    try {
      const { phone, method, telegramUserId } = req.body;
      const ip = req.ip || req.connection?.remoteAddress;

      if (!method || !['qr', 'pairing'].includes(method)) {
        return res.status(400).json({ success: false, error: 'Méthode invalide. Utilisez "qr" ou "pairing".' });
      }

      if (method === 'pairing' && !phone) {
        return res.status(400).json({ success: false, error: 'Numéro de téléphone requis pour le pairing.' });
      }

      // Créer la connexion
      const conn = sockManager.createConnection({
        phone,
        method,
        ip,
        telegramUserId,
      });

      // Démarrer la connexion en arrière-plan
      if (method === 'pairing' && startPairing) {
        startPairing(conn.connectionId, conn.accountId, phone).catch(err => {
          log(`Erreur pairing ${conn.connectionId}: ${err.message}`);
          sockManager.setStatus(conn.connectionId, 'failed');
        });
      } else if (method === 'qr' && startQr) {
        startQr(conn.connectionId, conn.accountId, phone).catch(err => {
          log(`Erreur QR ${conn.connectionId}: ${err.message}`);
          sockManager.setStatus(conn.connectionId, 'failed');
        });
      }

      return res.json({
        success: true,
        connectionId: conn.connectionId,
        accountId: conn.accountId,
        method,
        status: 'pending',
      });
    } catch (err) {
      log(`Erreur create: ${err.message}`);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  /* ── GET /api/connection/:id/status ── */
  app.get('/api/connection/:id/status', (req, res) => {
    const status = sockManager.getStatus(req.params.id);
    if (!status) {
      return res.status(404).json({ success: false, error: 'Connexion introuvable' });
    }
    return res.json({ success: true, ...status });
  });

  /* ── GET /api/connection/:id/qr ── */
  app.get('/api/connection/:id/qr', (req, res) => {
    const entry = sockManager.getConnection(req.params.id);
    if (!entry) {
      return res.status(404).json({ success: false, error: 'Connexion introuvable' });
    }
    if (!entry.qrDataUrl) {
      return res.status(202).json({ success: true, status: entry.status, qr: null, message: 'QR en cours de génération...' });
    }
    return res.json({
      success: true,
      status: entry.status,
      qr: entry.qrDataUrl,
      expiresAt: entry.qrExpiresAt,
    });
  });

  /* ── GET /api/connection/:id/events (SSE) ── */
  app.get('/api/connection/:id/events', (req, res) => {
    const entry = sockManager.getConnection(req.params.id);
    if (!entry) {
      return res.status(404).json({ success: false, error: 'Connexion introuvable' });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Envoyer l'état actuel
    const sendEvent = (eventType, data) => {
      try {
        res.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
      } catch (_) {}
    };

    sendEvent('status', { status: entry.status, connectionId: entry.connectionId });

    if (entry.pairingCode) {
      sendEvent('pairing.code', { code: entry.pairingCode, expiresAt: entry.pairingExpiresAt });
    }

    if (entry.qrDataUrl) {
      sendEvent('qr.updated', { qr: entry.qrDataUrl });
    }

    // Écouter les événements
    const onStatus = (data) => sendEvent('status', data);
    const onPairing = (data) => sendEvent('pairing.code', data);
    const onQr = (data) => sendEvent('qr.updated', data);
    const onClosed = () => {
      sendEvent('connection.closed', {});
      res.end();
    };

    entry.events.on('status.changed', onStatus);
    entry.events.on('pairing.code', onPairing);
    entry.events.on('qr.updated', onQr);
    entry.events.on('connection.closed', onClosed);

    // Nettoyage à la déconnexion client
    req.on('close', () => {
      entry.events.off('status.changed', onStatus);
      entry.events.off('pairing.code', onPairing);
      entry.events.off('qr.updated', onQr);
      entry.events.off('connection.closed', onClosed);
    });
  });

  /* ── GET /api/connection/list ── */
  app.get('/api/connection/list', (req, res) => {
    const connections = sockManager.listConnections();
    return res.json({ success: true, connections, total: connections.length });
  });

  /* ── POST /api/connection/:id/destroy ── */
  app.post('/api/connection/:id/destroy', (req, res) => {
    const entry = sockManager.getConnection(req.params.id);
    if (!entry) {
      return res.status(404).json({ success: false, error: 'Connexion introuvable' });
    }
    sockManager.destroyConnection(req.params.id);
    return res.json({ success: true });
  });

  /* ── POST /pair (compatibilité) ── */
  // Redirige vers le nouveau système
  app.post('/pair', async (req, res) => {
    try {
      const { phone } = req.body;
      const ip = req.ip || req.connection?.remoteAddress;

      if (!phone) {
        return res.status(400).json({ success: false, error: 'Numéro requis' });
      }

      const clean = sockManager.cleanPhone(phone);
      if (clean.length < 8) {
        return res.status(400).json({ success: false, error: 'Numéro invalide' });
      }

      // Vérifier si ce numéro a déjà une connexion active
      const existing = sockManager.getConnectionByPhone(clean);
      if (existing && existing.status === 'connected') {
        return res.json({ success: true, alreadyConnected: true, accountId: existing.accountId });
      }

      // Créer la connexion
      const conn = sockManager.createConnection({
        phone: clean,
        method: 'pairing',
        ip,
      });

      // Démarrer le pairing en arrière-plan
      if (startPairing) {
        startPairing(conn.connectionId, conn.accountId, clean).catch(err => {
          log(`Erreur pairing /pair: ${err.message}`);
          sockManager.setStatus(conn.connectionId, 'failed');
        });
      }

      // Attendre le code (max 90s)
      const deadline = Date.now() + 90000;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 500));
        const entry = sockManager.getConnection(conn.connectionId);
        if (!entry) break;
        if (entry.pairingCode) {
          return res.json({
            success: true,
            accountId: conn.accountId,
            connectionId: conn.connectionId,
            code: entry.pairingCode,
            status: 'pairing',
            expiresAt: entry.pairingExpiresAt,
            expiresIn: Math.max(0, (entry.pairingExpiresAt || Date.now()) - Date.now()),
          });
        }
        if (entry.status === 'connected') {
          return res.json({ success: true, alreadyConnected: true, accountId: conn.accountId });
        }
        if (entry.status === 'failed') {
          return res.status(500).json({ success: false, error: 'Échec de la génération du code' });
        }
      }

      // Timeout
      sockManager.destroyConnection(conn.connectionId);
      return res.status(504).json({ success: false, error: 'Timeout — code non généré après 90s' });
    } catch (err) {
      log(`Erreur /pair: ${err.message}`);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  /* ── GET /api/pair (compatibilité) ── */
  app.get('/api/pair', async (req, res) => {
    try {
      const { number } = req.query;
      const clean = sockManager.cleanPhone(number);
      if (clean.length < 8) {
        return res.status(400).json({ success: false, error: 'Numéro invalide' });
      }

      // Utiliser le même endpoint POST /pair
      req.body = { phone: clean };
      // Simuler un appel interne
      const conn = sockManager.createConnection({
        phone: clean,
        method: 'pairing',
        ip: req.ip,
      });

      if (startPairing) {
        startPairing(conn.connectionId, conn.accountId, clean).catch(err => {
          log(`Erreur pairing GET /api/pair: ${err.message}`);
          sockManager.setStatus(conn.connectionId, 'failed');
        });
      }

      const deadline = Date.now() + 90000;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 500));
        const entry = sockManager.getConnection(conn.connectionId);
        if (!entry) break;
        if (entry.pairingCode) {
          return res.json({
            success: true,
            type: 'code',
            accountId: conn.accountId,
            code: entry.pairingCode,
            status: 'pairing',
            expiresAt: entry.pairingExpiresAt,
            expiresIn: Math.max(0, (entry.pairingExpiresAt || Date.now()) - Date.now()),
          });
        }
        if (entry.status === 'connected') {
          return res.json({ success: true, alreadyConnected: true, accountId: conn.accountId });
        }
      }

      sockManager.destroyConnection(conn.connectionId);
      return res.status(504).json({ success: false, error: 'Timeout' });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  /* ── GET /api/status (compatibilité) ── */
  app.get('/api/status', async (req, res) => {
    const health = sockManager.healthCheck();
    const mainSock = sockManager.getMainSocket();
    const allConns = sockManager.listConnections();
    const connectedCount = allConns.filter(c => c.connected).length;

    const mainConnected = !!global.__waConnected;
    const botNumber = mainSock?.user ? String(mainSock.user.id || '').split('@')[0].split(':')[0] : null;

    const status = {
      engine: global.currentEngine || 'unknown',
      connected: mainConnected || connectedCount > 0,
      hasQr: !!global.lastQr,
      qrLength: global.lastQr ? global.lastQr.length : 0,
      uptime: process.uptime(),
      memory: Math.round(process.memoryUsage().rss / 1024 / 1024) + ' MB',
      botName: require('../../config-djousse.cjs').BOT_NAME,
      botNumber,
      multiAccount: health,
      accounts: health.maxConnections,
      connectedAccounts: connectedCount || (mainConnected ? 1 : 0),
    };

    res.json(status);
  });

  /* ── GET /api/status/user/:telegramUserId (statut par utilisateur Telegram) ── */
  app.get('/api/status/user/:telegramUserId', (req, res) => {
    const { telegramUserId } = req.params;
    const mainSock = sockManager.getMainSocket();

    // Chercher les connexions appartenant à cet utilisateur Telegram
    const allConns = sockManager.listConnections();
    const userConns = allConns.filter(c => c.telegramUserId === telegramUserId);
    const connectedCount = userConns.filter(c => c.connected).length;

    // Le bot principal est-il connecté ? (pour l'owner)
    const mainConnected = !!global.__waConnected;

    // Si l'utilisateur a des connexions, utiliser celles-ci
    // Sinon, si le bot principal est connecté, le montrer (c'est probablement l'owner)
    const isOwner = String(telegramUserId) === String(process.env.OWNER_ID || '');
    const effectiveConnected = userConns.length > 0 ? connectedCount > 0 : (isOwner && mainConnected);

    const botNumber = mainSock?.user ? String(mainSock.user.id || '').split('@')[0].split(':')[0] : null;

    const status = {
      engine: global.currentEngine || 'unknown',
      connected: effectiveConnected,
      hasQr: !!global.lastQr,
      qrLength: global.lastQr ? global.lastQr.length : 0,
      uptime: process.uptime(),
      memory: Math.round(process.memoryUsage().rss / 1024 / 1024) + ' MB',
      botName: require('../../config-djousse.cjs').BOT_NAME,
      botNumber,
      accounts: userConns.length || (isOwner ? 1 : 0),
      connectedAccounts: connectedCount || (isOwner && mainConnected ? 1 : 0),
      sessions: userConns.map(c => ({
        connectionId: c.connectionId,
        phone: c.phone,
        status: c.status,
        connected: c.connected,
        method: c.method,
        createdAt: c.createdAt,
        lastActivityAt: c.lastActivityAt,
      })),
    };

    res.json(status);
  });

  log('Routes /api/connection/* montées');
}

module.exports = { mountRoutes };
