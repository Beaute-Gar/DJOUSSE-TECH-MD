import fetch from 'node-fetch';

const GRAPH_API_BASE = 'https://graph.facebook.com/v23.0';

export function sendMessage(phoneNumberId, accessToken, to, payload) {
  return fetch(`${GRAPH_API_BASE}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      ...payload,
    }),
  }).then(r => r.json());
}

export function sendText(phoneNumberId, accessToken, to, text) {
  return sendMessage(phoneNumberId, accessToken, to, {
    type: 'text',
    text: { body: text, preview_url: false },
  });
}

export function sendImage(phoneNumberId, accessToken, to, imageUrl, caption) {
  return sendMessage(phoneNumberId, accessToken, to, {
    type: 'image',
    image: { link: imageUrl, caption: caption || '' },
  });
}

export function sendInteractive(phoneNumberId, accessToken, to, interactive) {
  return sendMessage(phoneNumberId, accessToken, to, { type: 'interactive', interactive });
}

export function markAsRead(phoneNumberId, accessToken, messageId) {
  return fetch(`${GRAPH_API_BASE}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    }),
  }).then(r => r.json());
}
