import express from 'express';
import * as GraphApi from './services/graph-api.js';
import * as Webhook from './services/webhook.js';

export class WhatsAppCloudAPI {
  constructor(config = {}) {
    this.accessToken = config.accessToken;
    this.appSecret = config.appSecret;
    this.verifyToken = config.verifyToken;
    this.phoneNumberId = config.phoneNumberId;
    this.onMessage = null;
    this.onStatus = null;
    this.router = express.Router();
    this._setupRoutes();
  }

  _setupRoutes() {
    this.router.get('/webhook', (req, res) => {
      const challenge = Webhook.verifyWebhook(req, this.verifyToken);
      if (challenge) return res.send(challenge);
      res.sendStatus(403);
    });

    this.router.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
      const buf = req.body;
      if (!Webhook.verifySignature(req, buf, this.appSecret)) {
        return res.sendStatus(403);
      }
      const parsed = JSON.parse(buf.toString('utf8'));
      const { messages, statuses } = Webhook.parseEntry(parsed);
      for (const msg of messages) this.onMessage?.(msg);
      for (const st of statuses) this.onStatus?.(st);
      res.status(200).send('EVENT_RECEIVED');
    });
  }

  sendText(to, text) {
    return GraphApi.sendText(this.phoneNumberId, this.accessToken, to, text);
  }

  sendImage(to, imageUrl, caption) {
    return GraphApi.sendImage(this.phoneNumberId, this.accessToken, to, imageUrl, caption);
  }

  sendInteractive(to, interactive) {
    return GraphApi.sendInteractive(this.phoneNumberId, this.accessToken, to, interactive);
  }

  markRead(messageId) {
    return GraphApi.markAsRead(this.phoneNumberId, this.accessToken, messageId);
  }
}
