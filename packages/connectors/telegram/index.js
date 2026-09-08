import { createLogger } from '../../infrastructure/logger.js';

const log = createLogger('telegram');
const API_BASE = 'https://api.telegram.org/bot';
let _botToken = null;
let _polling = false;
let _offset = 0;
let _onMessage = null;
let _interval = null;
let _lastUpdateId = 0;

export function configure(token) {
  _botToken = token;
}

export function isConnected() {
  return !!_botToken && _polling;
}

export function onMessage(cb) {
  _onMessage = cb;
}

async function _call(method, body) {
  if (!_botToken) return null;
  try {
    const r = await fetch(API_BASE + _botToken + '/' + method, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    const d = await r.json();
    return d.ok ? d.result : null;
  } catch (e) {
    log.warn('API error:', e.message);
    return null;
  }
}

export async function start() {
  if (!_botToken) { log.warn('TELEGRAM_BOT_TOKEN not configured'); return; }
  _polling = true;
  _poll();
  _interval = setInterval(_poll, 2000);
  log.info('Telegram polling started');
}

export function stop() {
  _polling = false;
  if (_interval) { clearInterval(_interval); _interval = null; }
  log.info('Telegram polling stopped');
}

async function _poll() {
  if (!_polling) return;
  const updates = await _call('getUpdates', { offset: _lastUpdateId + 1, timeout: 10 });
  if (!updates) return;
  for (const u of updates) {
    if (u.update_id > _lastUpdateId) _lastUpdateId = u.update_id;
    if (!u.message) continue;
    const msg = u.message;
    const text = msg.text || msg.caption || '';
    const chatId = msg.chat.id;
    const from = msg.from;
    const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
    if (_onMessage) {
      _onMessage({
        channel: 'telegram',
        messageId: msg.message_id,
        chatId: String(chatId),
        chatTitle: msg.chat.title || from?.first_name || 'Unknown',
        senderId: String(from?.id || ''),
        senderName: from?.first_name || '',
        text,
        isGroup,
        raw: msg,
        reply: (txt) => sendMessage(chatId, txt),
      });
    }
  }
}

export async function sendMessage(chatId, text, opts) {
  return _call('sendMessage', { chat_id: Number(chatId), text, parse_mode: 'HTML', ...opts });
}

export async function sendAction(chatId, action) {
  return _call('sendChatAction', { chat_id: Number(chatId), action });
}

export async function getMe() {
  return _call('getMe');
}
