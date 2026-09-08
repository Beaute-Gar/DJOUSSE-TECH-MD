import { Router } from 'express';
import { createLogger } from '../../packages/infrastructure/logger.js';
import { validate } from '../services/message-validator.js';
import { getActiveAlerts, resolveAnomaly } from '../services/anomaly-detector.js';
import { exportData, deleteData } from '../services/compliance.js';
import { listDevices } from '../services/device-manager.js';
import { securityHeaders, auth, requestLogger } from './middleware.js';

const log = createLogger('WEBHOOK');

export function createWebhookRouter(apiKey) {
  const router = Router();
  router.use(securityHeaders);
  router.use(requestLogger);
  if (apiKey) router.use(auth(apiKey));

  router.post('/validate', async (req, res) => {
    try {
      const { jid, text, isGroup } = req.body || {};
      if (!jid || !text) return res.status(400).json({ error: 'jid and text required' });
      const result = await validate(jid, text, !!isGroup);
      res.json(result);
    } catch (e) {
      log.error('validate error', { error: e.message });
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/alerts', async (req, res) => {
    try {
      const alerts = await getActiveAlerts();
      res.json(alerts);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/alerts/:id/resolve', async (req, res) => {
    try {
      await resolveAnomaly(Number(req.params.id));
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/export/:jid', async (req, res) => {
    try {
      const data = await exportData(req.params.jid);
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.delete('/data/:jid', async (req, res) => {
    try {
      await deleteData(req.params.jid);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/devices/:jid', async (req, res) => {
    try {
      const devices = await listDevices(req.params.jid);
      res.json(devices);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return router;
}
