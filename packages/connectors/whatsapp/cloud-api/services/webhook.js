import crypto from 'crypto';

export function verifySignature(req, buf, appSecret) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) return false;
  const parts = signature.split('=');
  const hash = crypto.createHmac('sha256', appSecret).update(buf).digest('hex');
  return parts[1] === hash;
}

export function parseEntry(body) {
  const messages = [];
  const statuses = [];

  if (body.object !== 'whatsapp_business_account') return { messages, statuses };

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value;
      if (!value) continue;

      const phoneNumberId = value.metadata?.phone_number_id;
      const displayPhone = value.metadata?.display_phone_number;

      if (value.statuses) {
        for (const s of value.statuses) {
          statuses.push({ ...s, phoneNumberId, displayPhone });
        }
      }
      if (value.messages) {
        for (const m of value.messages) {
          messages.push({ ...m, phoneNumberId, displayPhone });
        }
      }
    }
  }
  return { messages, statuses };
}

export function verifyWebhook(req, verifyToken) {
  return (
    req.query['hub.mode'] === 'subscribe' &&
    req.query['hub.verify_token'] === verifyToken
  ) ? req.query['hub.challenge'] : null;
}
