import { Router } from 'express';
import { getAccountHealthMonitor } from '../services/account-health-monitor.js';
import { rawRun, rawAll } from '../../packages/infrastructure/database/database.js';

export function createHealthRouter() {
  const router = Router();

  router.get('/etat', async (req, res) => {
    const monitor = getAccountHealthMonitor();
    if (!monitor) return res.status(503).json({ error: 'Health monitor not initialized' });
    const etat = await monitor.getEtatComplet();
    res.json(etat);
  });

  router.get('/events', async (req, res) => {
    const events = await rawAll(
      `SELECT type, severite, detail, cree_le FROM account_risk_events WHERE resolu = 0 ORDER BY cree_le DESC LIMIT 20`
    );
    res.json({ events });
  });

  router.post('/verifier', async (req, res) => {
    const monitor = getAccountHealthMonitor();
    if (!monitor) return res.status(503).json({ error: 'Health monitor not initialized' });
    const result = await monitor.verifierSante();
    res.json(result);
  });

  router.post('/backup', async (req, res) => {
    const monitor = getAccountHealthMonitor();
    if (!monitor) return res.status(503).json({ error: 'Health monitor not initialized' });
    const path = await monitor.sauvegarderSession('manuel');
    res.json({ message: path ? `Backup créé: ${path}` : 'Backup échoué' });
  });

  router.post('/events/resoudre-tous', async (req, res) => {
    await rawRun(`UPDATE account_risk_events SET resolu = 1 WHERE resolu = 0`);
    res.json({ ok: true });
  });

  return router;
}
