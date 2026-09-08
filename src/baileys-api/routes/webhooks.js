let webhookConfig = null;
let webhookQueue = [];
let webhookInterval = null;

export function getWebhookConfig() {
  return webhookConfig;
}

export function queueWebhookEvent(event) {
  if (webhookConfig?.active) {
    webhookQueue.push(event);
  }
}

function startWebhookProcessor() {
  if (webhookInterval) return;
  webhookInterval = setInterval(async () => {
    if (!webhookConfig?.active || webhookQueue.length === 0) return;
    const batch = webhookQueue.splice(0, 10);
    try {
      const { default: axios } = await import('axios');
      const { createRequire } = await import('module');
      const require = createRequire(import.meta.url);
      const antiban = require('../../lib/antiban.cjs');
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'DJOUSSE-Baileys-API/1.0',
      };
      /* HMAC signature d'intégrité (si WEBHOOK_HMAC_SECRET défini) */
      const signature = antiban.signPayload({ events: batch });
      if (signature) headers['X-Webhook-Signature'] = signature;
      await axios.post(webhookConfig.url, { events: batch }, { headers, timeout: 10000 });
    } catch {
      webhookQueue.unshift(...batch);
    }
  }, 5000);
}

export async function getWebhook(sock, req, res) {
  if (!webhookConfig) {
    return res.json({ messages: [], meta: { count: 0 } });
  }
  res.json({ messages: [webhookConfig], meta: { count: 1 } });
}

export async function setWebhook(sock, req, res) {
  try {
    const { url, events } = req.body;
    if (!url) return res.status(400).json({ error: true, message: 'Missing required field: url', code: 'INVALID_PARAMS' });

    webhookConfig = {
      url,
      events: events || ['message', 'ack', 'group_join', 'group_leave'],
      active: true,
      created: Date.now(),
    };

    startWebhookProcessor();
    res.json({ sent: true, webhook: webhookConfig });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message, code: 'WEBHOOK_SET_FAILED' });
  }
}

export async function deleteWebhook(sock, req, res) {
  webhookConfig = null;
  if (webhookInterval) {
    clearInterval(webhookInterval);
    webhookInterval = null;
  }
  res.json({ sent: true, message: 'Webhook deleted' });
}

export async function testWebhook(sock, req, res) {
  if (!webhookConfig) {
    return res.status(400).json({ error: true, message: 'No webhook configured', code: 'NO_WEBHOOK' });
  }
  try {
    const { default: axios } = await import('axios');
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const antiban = require('../../lib/antiban.cjs');
    const payload = { event: 'test', timestamp: Date.now(), data: { message: 'Webhook test from DJOUSSE API' } };
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'DJOUSSE-Baileys-API/1.0',
    };
    const signature = antiban.signPayload(payload);
    if (signature) headers['X-Webhook-Signature'] = signature;
    await axios.post(webhookConfig.url, payload, { headers, timeout: 10000 });
    res.json({ sent: true, message: 'Webhook test sent' });
  } catch (e) {
    res.status(500).json({ error: true, message: `Webhook delivery failed: ${e.message}`, code: 'WEBHOOK_TEST_FAILED' });
  }
}
