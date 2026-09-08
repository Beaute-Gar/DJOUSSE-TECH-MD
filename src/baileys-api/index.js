import { authMiddleware } from './auth.js';
import healthHandler from './routes/health.js';
import * as msg from './routes/messages.js';
import * as groups from './routes/groups.js';
import * as chats from './routes/chats.js';
import * as contacts from './routes/contacts.js';
import * as presences from './routes/presences.js';
import * as media from './routes/media.js';
import * as webhooks from './routes/webhooks.js';
import rateLimit from 'express-rate-limit';

let sockRef = null;

export function getSock() {
  return sockRef;
}

export function initBaileysApi(sock, app, config = {}) {
  sockRef = sock;

  const apiPrefix = config.API_PREFIX || '/api';
  const auth = authMiddleware(config);
  const h = (fn) => (req, res) => fn(sock, req, res);

  /* ── Rate limiting ── */
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: true, message: 'Too many requests, please try again later', code: 'RATE_LIMITED' },
  });

  /* ── Health (no auth, no rate limit) ── */
  app.get(`${apiPrefix}/health`, h(healthHandler));

  /* ── Messages ── */
  const rl = (fn) => [auth, apiLimiter, h(fn)];
  app.post(`${apiPrefix}/messages/text`, ...rl(msg.postText));
  app.post(`${apiPrefix}/messages/image`, ...rl(msg.postImage));
  app.post(`${apiPrefix}/messages/video`, ...rl(msg.postVideo));
  app.post(`${apiPrefix}/messages/audio`, ...rl(msg.postAudio));
  app.post(`${apiPrefix}/messages/document`, ...rl(msg.postDocument));
  app.post(`${apiPrefix}/messages/sticker`, ...rl(msg.postSticker));
  app.post(`${apiPrefix}/messages/location`, ...rl(msg.postLocation));
  app.post(`${apiPrefix}/messages/contact`, ...rl(msg.postContact));
  app.post(`${apiPrefix}/messages/reaction`, ...rl(msg.postReaction));
  app.post(`${apiPrefix}/messages/buttons`, ...rl(msg.postButtons));
  app.post(`${apiPrefix}/messages/list`, ...rl(msg.postList));
  app.post(`${apiPrefix}/messages/poll`, ...rl(msg.postPoll));
  app.post(`${apiPrefix}/messages/forward`, ...rl(msg.postForward));

  /* ── Groups ── */
  app.get(`${apiPrefix}/groups`, ...rl(groups.listGroups));
  app.post(`${apiPrefix}/groups`, ...rl(groups.createGroup));
  app.get(`${apiPrefix}/groups/:id/metadata`, ...rl(groups.getGroup));
  app.post(`${apiPrefix}/groups/:id/participants`, ...rl(groups.updateParticipants));
  app.patch(`${apiPrefix}/groups/:id/settings`, ...rl(groups.updateSettings));
  app.post(`${apiPrefix}/groups/:id/leave`, ...rl(groups.leaveGroup));
  app.get(`${apiPrefix}/groups/:id/invite`, ...rl(groups.getInviteCode));
  app.post(`${apiPrefix}/groups/:id/invite-revoke`, ...rl(groups.revokeInviteCode));

  /* ── Chats ── */
  app.get(`${apiPrefix}/chats`, ...rl(chats.listChats));
  app.get(`${apiPrefix}/chats/:id`, ...rl(chats.getChat));
  app.get(`${apiPrefix}/chats/:id/messages`, ...rl(chats.getChatMessages));
  app.delete(`${apiPrefix}/chats/:id`, ...rl(chats.deleteChat));
  app.post(`${apiPrefix}/chats/clear`, ...rl(chats.clearChat));

  /* ── Contacts ── */
  app.get(`${apiPrefix}/contacts`, ...rl(contacts.listContacts));
  app.post(`${apiPrefix}/contacts/check`, ...rl(contacts.checkContacts));
  app.get(`${apiPrefix}/contacts/:id`, ...rl(contacts.getContact));
  app.post(`${apiPrefix}/contacts/block`, ...rl(contacts.blockContact));
  app.post(`${apiPrefix}/contacts/unblock`, ...rl(contacts.unblockContact));

  /* ── Presences ── */
  app.put(`${apiPrefix}/presences/me`, ...rl(presences.updateMyPresence));
  app.put(`${apiPrefix}/presences/:id`, ...rl(presences.updatePresence));

  /* ── Media ── */
  app.post(`${apiPrefix}/media`, ...rl(media.uploadMedia));
  app.get(`${apiPrefix}/media/:id`, ...rl(media.getMedia));
  app.delete(`${apiPrefix}/media/:id`, ...rl(media.deleteMedia));

  /* ── Webhooks ── */
  app.get(`${apiPrefix}/webhooks`, ...rl(webhooks.getWebhook));
  app.post(`${apiPrefix}/webhooks`, ...rl(webhooks.setWebhook));
  app.delete(`${apiPrefix}/webhooks`, ...rl(webhooks.deleteWebhook));
  app.post(`${apiPrefix}/webhooks/test`, ...rl(webhooks.testWebhook));

  const authStatus = config.API_KEY ? 'enabled' : 'disabled';
  console.log(`  Baileys REST API routes mounted at ${apiPrefix}/* (auth: ${authStatus})`);
  return true;
}
