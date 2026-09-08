import { Router } from 'express';
import { configure, start, stop, isConnected, sendMessage, getMe } from './index.js';
import { createLogger } from '../../infrastructure/logger.js';

const log = createLogger('telegram-routes');
const router = Router();

router.get('/api/telegram/status', (req, res) => {
  res.json({ connected: isConnected() });
});

router.post('/api/telegram/connect', async (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: 'token required' });
  configure(token);
  await start();
  const me = await getMe();
  res.json({ ok: true, bot: me });
});

router.post('/api/telegram/disconnect', (req, res) => {
  stop();
  configure(null);
  res.json({ ok: true });
});

router.post('/api/telegram/send', async (req, res) => {
  const { chatId, text } = req.body || {};
  if (!chatId || !text) return res.status(400).json({ error: 'chatId and text required' });
  const result = await sendMessage(chatId, text);
  res.json({ ok: !!result, result });
});

export default router;
