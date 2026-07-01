import express from 'express';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { existsSync, rmSync } from 'fs';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createLogger } from './logger.js';

const require = createRequire(import.meta.url);
const config = require('../../config.cjs');
const log = createLogger('WEBSERVER');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SESSION_DIR = path.resolve(config.PATHS.SESSION);

const pairingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Trop de tentatives. Réessayez dans 15 minutes.' },
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
});

const phoneCooldowns = new Map();

function checkToken(req) {
  const token = config.PAIRING_TOKEN;
  if (!token) return true;
  const provided = req.headers['x-pairing-token'] || req.query.token || '';
  return provided === token;
}

export function startWebServer(port = 3000) {
  const app = express();
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.disable('x-powered-by');
  app.use(generalLimiter);

  app.use(express.static(path.resolve(__dirname, '../../mydata')));

  app.get('/', (req, res) => {
    const page = path.resolve(__dirname, '../../mydata/index.html');
    if (existsSync(page)) {
      res.sendFile(page);
    } else {
      res.send(`<h1>${config.BOT_NAME}</h1><p>Page de connexion non trouvée</p>`);
    }
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', botName: config.BOT_NAME, uptime: process.uptime() });
  });

  app.get('/status', async (req, res) => {
    try {
      const { getSocket } = await import('./bot.js');
      const sock = getSocket();
      const connected = !!(sock?.user);
      res.json({
        connected,
        hasToken: !!config.PAIRING_TOKEN,
        botName: config.BOT_NAME,
        company: config.COMPANY_NAME,
        user: connected ? { id: sock.user.id, name: sock.user.name } : null,
        timestamp: new Date().toISOString(),
      });
    } catch {
      res.json({ connected: false, botName: config.BOT_NAME });
    }
  });

  app.post('/auth', (req, res) => {
    const token = (req.body.token || '').trim();
    if (!config.PAIRING_TOKEN) {
      return res.json({ success: true });
    }
    if (token === config.PAIRING_TOKEN) {
      return res.json({ success: true });
    }
    return res.status(403).json({ success: false, message: 'Token invalide' });
  });

  app.get('/qr', async (req, res) => {
    if (!checkToken(req)) {
      return res.status(403).json({ qr: null, message: 'Non autorisé' });
    }
    try {
      const { getLastQR } = await import('./bot.js');
      const qr = getLastQR();
      if (qr) {
        res.json({ qr });
      } else {
        res.json({ qr: null, message: 'Pas de QR disponible, patientez...' });
      }
    } catch {
      res.json({ qr: null, message: 'Erreur' });
    }
  });

  app.post('/pair', pairingLimiter, async (req, res) => {
    if (!checkToken(req)) {
      return res.status(403).json({ success: false, message: 'Token de sécurité invalide' });
    }
    const rawNumber = (req.body.number || req.body.phone || '').toString().trim();
    const number = rawNumber.replace(/[^0-9]/g, '');

    if (!number || number.length < 7 || number.length > 15) {
      return res.status(400).json({ success: false, message: 'Numéro invalide. Format : indicatif + numéro (ex: 237612345678)' });
    }

    const ownerClean = config.OWNER_NUMBER.replace(/[^0-9]/g, '');
    if (number !== ownerClean) {
      log.warn(`Tentative de pairage refusée pour +${number} (pas le propriétaire)`);
      return res.status(403).json({ success: false, message: 'Ce numéro n\'est pas autorisé à connecter ce bot.' });
    }

    const cooldown = phoneCooldowns.get(number);
    if (cooldown && Date.now() - cooldown < 60000) {
      const wait = Math.ceil((60000 - (Date.now() - cooldown)) / 1000);
      return res.status(429).json({ success: false, message: `Patientez ${wait}s avant de réessayer.` });
    }
    phoneCooldowns.set(number, Date.now());

    try {
      const { getSocket, requestPairingCode } = await import('./bot.js');
      const sock = getSocket();

      if (!sock) {
        return res.status(503).json({ success: false, message: 'Bot non démarré. Patientez quelques secondes.' });
      }

      if (sock.user) {
        return res.json({ success: false, message: 'Déjà connecté !', connected: true });
      }

      const code = await requestPairingCode(number);
      const raw = typeof code === 'string' ? code.replace(/[^0-9A-Za-z]/g, '').toUpperCase() : String(code);
      const formatted = raw.length === 8 ? raw.slice(0,4) + '-' + raw.slice(4) : raw;

      log.info(`Pairing code demandé pour : +${number}`);

      setTimeout(async () => {
        try {
          if (!sock?.user) return;
          const jid = number + '@s.whatsapp.net';
          const { readFileSync } = await import('fs');
          const img1 = path.resolve(__dirname, '../../mydata/assets/welcome1.png');
          const img2 = path.resolve(__dirname, '../../mydata/assets/welcome2.png');
          const msg =
`*DJOUSSE TECH — COGNITIVE OS*

_Bienvenue ! Assistant en ligne._

Commandes : .menu  |  .OS aide`;
          if (existsSync(img1)) {
            await sock.sendMessage(jid, { image: readFileSync(img1), caption: msg });
          }
          if (existsSync(img2)) {
            await sock.sendMessage(jid, { image: readFileSync(img2) });
          }
          if (!existsSync(img1) && !existsSync(img2)) {
            await sock.sendMessage(jid, { text: msg });
          }
          log.info(`Message de confirmation envoyé à +${number}`);
        } catch {}
      }, 15_000);

      res.json({
        success: true,
        code: formatted,
        number: '+' + number,
        message: `Code généré pour +${number}. Entrez ce code dans WhatsApp > Appareils liés > Lier un appareil.`,
      });

    } catch (err) {
      const msg = (err?.message || err?.toString?.() || 'Erreur inconnue').slice(0, 200);
      log.warn(`Pairing error for ${number}: ${msg}`);
      res.status(500).json({ success: false, message: msg });
    }
  });

  app.post('/logout', async (req, res) => {
    try {
      const { getSocket } = await import('./bot.js');
      const sock = getSocket();
      if (sock) await sock.logout();
      if (existsSync(SESSION_DIR)) {
        rmSync(SESSION_DIR, { recursive: true, force: true });
        log.info('Session supprimée');
      }
      res.json({ success: true, message: 'Déconnecté avec succès.' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  /* ── Cognitive OS Dashboard API ─────────────────────── */
  app.get('/api/status', async (req, res) => {
    try {
      const { orchestrator } = await import('../cognitive/agents/agent-framework.js');
      const { trust, audit, approval, policy } = await import('../cognitive/governance/index.js');
      const { workspaceManager } = await import('../cognitive/workspace/workspace-manager.js');
      const { planner } = await import('../cognitive/planning-engine.js');
      const agents = await orchestrator.list().catch(() => []);
      const trustSummary = trust.getSummary();
      const auditSummary = audit.summary();
      const approvalStats = approval.getStats();
      const policies = policy.list();
      const workspaces = workspaceManager.list();
      const missionStats = planner.getStats();
      res.json({
        brain: { agents: agents.length, workspaces: workspaces.length, uptime: process.uptime() },
        agents: agents.map(a => ({ name: a.name, state: a.state, trust: a.trustScore, executions: a.executions })),
        governance: {
          trust: { avg: trustSummary.averageScore, trusted: trustSummary.trusted, critical: trustSummary.critical },
          audit: { total24h: auditSummary.total, errors: auditSummary.errors },
          approvals: approvalStats,
          policies: policies.filter(p => p.enabled).length,
        },
        missions: { active: missionStats.active, overdue: missionStats.overdue, completed: missionStats.completed },
        workspaces: workspaces.map(w => ({ id: w.id, owner: w.owner, groups: w.groups, autonomy: w.autonomy })),
        timestamp: Date.now(),
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/agents', async (req, res) => {
    try {
      const { orchestrator } = await import('../cognitive/agents/agent-framework.js');
      const { trust } = await import('../cognitive/governance/index.js');
      const { groupFactory } = await import('../cognitive/workspace/group-agent-factory.js');
      const agents = await orchestrator.list();
      const factoryStats = await groupFactory.getStats().catch(() => ({}));
      res.json({
        total: agents.length,
        groupAgents: factoryStats.total || 0,
        byType: factoryStats.byType || {},
        list: agents,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/workspaces', async (req, res) => {
    try {
      const { workspaceManager } = await import('../cognitive/workspace/workspace-manager.js');
      res.json({ workspaces: workspaceManager.list() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/trust', async (req, res) => {
    try {
      const { trust } = await import('../cognitive/governance/index.js');
      res.json(trust.getSummary());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/audit', async (req, res) => {
    try {
      const { audit } = await import('../cognitive/governance/index.js');
      const limit = parseInt(req.query.limit) || 20;
      res.json({ entries: audit.getRecent(limit), summary: audit.summary() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/missions', async (req, res) => {
    try {
      const { planner } = await import('../cognitive/planning-engine.js');
      const all = planner.getAllMissions();
      res.json({ total: all.length, active: all.filter(m => m.status === 'active').length, list: all.slice(0, 50) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/approvals', async (req, res) => {
    try {
      const { approval } = await import('../cognitive/governance/index.js');
      res.json({ pending: approval.listPending(), stats: approval.getStats() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/approve', async (req, res) => {
    try {
      const { approval } = await import('../cognitive/governance/index.js');
      const { id, action, reason } = req.body;
      if (action === 'approve') res.json({ success: approval.approve(id, 'dashboard', reason) });
      else if (action === 'reject') res.json({ success: approval.reject(id, 'dashboard', reason) });
      else res.status(400).json({ error: 'invalid action' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/groups', async (req, res) => {
    try {
      const { groupStore } = await import('../cognitive/workspace/group-cognitive-object.js');
      res.json({ groups: groupStore.list(), stats: groupStore.getStats() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/search', async (req, res) => {
    try {
      const { api } = await import('../cognitive/cognitive-api.js');
      const q = req.query.q || '';
      if (!q) return res.json({ error: 'query required' });
      const results = await api.search(q, { includeMissions: true });
      res.json(results);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/send-test', async (req, res) => {
    try {
      const { getSocket } = await import('./bot.js');
      const sock = getSocket();
      if (!sock?.user) throw new Error('Bot pas connecte');
      const ownerJid = config.OWNER_NUMBER?.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
      const text = req.body?.text || '*Test OK*\n\nLe bot repond correctement. Commande detectee et executee.';
      await sock.sendMessage(ownerJid, { text });
      res.json({ success: true, message: 'Test envoye a l\'owner' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.use((err, req, res, next) => {
    log.error({ err }, 'Erreur serveur web');
    res.status(500).json({ success: false, message: 'Erreur interne du serveur.' });
  });

  function tryListen(p, maxRetries = 5) {
    const server = app.listen(p, () => {
      log.info(`Interface web → http://localhost:${p}`);
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE' && p < port + maxRetries) {
        log.warn(`Port ${p} occupé, essai port ${p + 1}`);
        tryListen(p + 1);
      } else {
        log.error(`Impossible de démarrer le serveur web: ${err.message}`);
      }
    });
    return app;
  }

  return tryListen(port);
}
