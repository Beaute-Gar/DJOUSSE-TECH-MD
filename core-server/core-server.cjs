const path = require('path');
const fs = require('fs');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { commands } = require('../command.cjs');
const config = require('../config-djousse.cjs');
const { wrapBox } = require('../lib/msg.cjs');
const { buildContext } = require('../src/core/command-context.cjs');

global.commands = commands;

const VERSION = '1.0.0';
const PROTOCOL = 1;
const PORT = process.env.CORE_PORT || process.env.PORT || 3030;
const CORE_NAME = process.env.CORE_NAME || 'DJOSSE CORE';
const ownerNumber = [config.BOT_OWNER + '@s.whatsapp.net'];
const PRIORITY_TIMEOUT = parseInt(process.env.MESSAGE_TIMEOUT || '10000', 10);
const PLUGIN_TIMEOUT = parseInt(process.env.DB_TIMEOUT || '45000', 10);
const MAX_MEDIA_BYTES = parseInt(process.env.CORE_MAX_MEDIA_KB || '8000', 10) * 1024;

const pluginsDir = path.join(__dirname, '..', 'plugins');
if (fs.existsSync(pluginsDir)) {
  const files = fs.readdirSync(pluginsDir).filter(f => f.endsWith('.js') || f.endsWith('.cjs'));
  for (const file of files) {
    try {
      require(path.join(pluginsDir, file));
    } catch (e) {
      console.error('❌ CORE plugin load', file, e.message);
    }
  }
}

const visibleCommands = commands.filter(c => c.pattern && typeof c.function === 'function');

const withTimeout = (promise, ms) => Promise.race([
  promise,
  new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout (' + ms + 'ms)')), ms)),
]);

function toBase64(buf) {
  if (!buf) return null;
  if (Buffer.isBuffer(buf)) {
    if (buf.length > MAX_MEDIA_BYTES) throw new Error('Média trop volumineux (' + Math.round(buf.length / 1024) + ' Ko > ' + Math.round(MAX_MEDIA_BYTES / 1024) + ' Ko)');
    return buf.toString('base64');
  }
  if (typeof buf.url === 'string') return { url: buf.url };
  return null;
}

function createVirtualSock(outbox) {
  const push = (item) => outbox.push(item);
  const media = (buf) => {
    const r = toBase64(buf);
    if (!r) return {};
    if (typeof r === 'string') return { base64: r };
    return { url: r.url };
  };
  return {
    user: { id: (config.BOT_OWNER || global.__sessionOwnerNumber || '') + ':1@s.whatsapp.net' },
    sendMessage: async (jid, content) => {
      if (!content) return { key: { id: 'core-empty' } };
      if (content.text !== undefined) push({ type: 'text', jid, text: String(content.text), mentions: content.contextInfo?.mentionedJid });
      else if (content.image !== undefined) push({ type: 'image', jid, ...media(content.image), caption: content.caption, mentions: content.contextInfo?.mentionedJid });
      else if (content.video !== undefined) push({ type: 'video', jid, ...media(content.video), caption: content.caption, gifPlayback: content.gifPlayback });
      else if (content.audio !== undefined) push({ type: 'audio', jid, ...media(content.audio), ptt: content.ptt, mimetype: content.mimetype });
      else if (content.sticker !== undefined) push({ type: 'sticker', jid, ...media(content.sticker) });
      else if (content.document !== undefined) push({ type: 'document', jid, ...media(content.document), fileName: content.fileName, mimetype: content.mimetype });
      else if (content.contacts) push({ type: 'contacts', jid, displayName: content.contacts.displayName, contacts: content.contacts.contacts });
      else if (content.react) push({ type: 'react', jid, emoji: content.react.text, key: content.react.key });
      else if (content.poll) push({ type: 'poll', jid, question: content.poll.name, values: content.poll.values, selectableCount: content.poll.selectableCount });
      else if (content.location) push({ type: 'location', jid, location: content.location });
      else if (content.delete) push({ type: 'delete', jid });
      else push({ type: 'raw', jid, content });
      return { key: { id: 'core-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) } };
    },
    readMessages: async () => {},
    sendPresenceUpdate: async () => {},
    groupMetadata: async () => { throw new Error('Core: groupMetadata indisponible'); },
    profilePictureUrl: async () => { throw new Error('Core: profilePictureUrl indisponible'); },
    updateProfilePicture: async (jid, img) => push({ type: 'updateProfilePicture', jid, base64: toBase64(img) }),
    removeProfilePicture: async (jid) => push({ type: 'removeProfilePicture', jid }),
    groupParticipantsUpdate: async (jid, ids, action) => push({ type: 'groupParticipantsUpdate', jid, ids, action }),
    groupSettingUpdate: async (jid, setting) => push({ type: 'groupSettingUpdate', jid, setting }),
    groupUpdateSubject: async (jid, subject) => push({ type: 'groupUpdateSubject', jid, subject }),
    groupUpdateDescription: async (jid, description) => push({ type: 'groupUpdateDescription', jid, description }),
    groupRevokeInvite: async () => '0000000000',
    groupInviteCode: async () => '0000000000',
    groupCreate: async () => ({ id: '120363000000000000@g.us' }),
    groupRequestParticipantsList: async () => [],
    groupRequestParticipantsUpdate: async () => {},
    presenceSubscribe: async () => {},
    getContacts: async () => [],
    groupFetchAllParticipating: async () => ({}),
    logout: async () => {},
    end: async () => {},
  };
}

function buildMessage(message, outbox) {
  const chat = message.chat || config.BOT_OWNER + '@s.whatsapp.net';
  const sender = message.sender || config.BOT_OWNER + '@s.whatsapp.net';
  const m = {
    id: 'core-' + Date.now(),
    key: { id: 'core-' + Date.now(), remoteJid: chat, fromMe: false, participant: sender },
    chat,
    sender,
    pushName: message.pushName || '',
    isGroup: message.isGroup ?? chat.endsWith('@g.us'),
    fromMe: !!message.fromMe,
    body: message.text || '',
    prefix: (message.text || '').charAt(0),
    command: (message.text || '').slice(1).trim().split(' ')[0] || '',
    type: 'extendedTextMessage',
    msg: { text: message.text || '', contextInfo: { mentionedJid: message.mention || [] } },
    mention: message.mention || [],
    quoted: null,
  };
  m.reply = (text, id) => outbox.push({ type: 'text', jid: id || chat, text: String(text) });
  m.replyS = (sticker, id) => outbox.push({ type: 'sticker', jid: id || chat, base64: toBase64(sticker) });
  m.replyImg = (img, text, id) => outbox.push({ type: 'image', jid: id || chat, base64: toBase64(img), caption: text ? wrapBox(text) : undefined });
  m.replyVid = (vid, text, id, opt) => outbox.push({ type: 'video', jid: id || chat, base64: toBase64(vid), caption: text ? wrapBox(text) : undefined, gifPlayback: opt?.gif });
  m.replyAud = (aud, id, opt) => outbox.push({ type: 'audio', jid: id || chat, base64: toBase64(aud), ptt: opt?.ptt, mimetype: 'audio/mpeg' });
  m.replyDoc = (doc, id, opt) => outbox.push({ type: 'document', jid: id || chat, base64: toBase64(doc), fileName: opt?.filename || 'undefined.pdf', mimetype: opt?.mimetype || 'application/pdf' });
  m.replyContact = (name, info, number) => outbox.push({ type: 'contacts', jid: chat, displayName: name, contacts: [{ vcard: 'BEGIN:VCARD\nVERSION:3.0\nFN:' + name + '\nORG:' + info + ';\nTEL;type=CELL;type=VOICE;waid=' + number + ':+' + number + '\nEND:VCARD' }] });
  m.react = (emoji) => outbox.push({ type: 'react', jid: chat, emoji, key: m.key });
  m.download = async () => null;
  if (message.quoted) {
    const q = message.quoted;
    const qMedia = q.base64 ? Buffer.from(q.base64, 'base64') : null;
    m.quoted = {
      type: q.type || 'extendedTextMessage',
      id: 'quoted-' + Date.now(),
      sender: q.sender || sender,
      fromMe: false,
      body: q.text || '',
      text: q.text || '',
      msg: { text: q.text, fileName: q.fileName, mimetype: q.mimetype, caption: q.caption },
      key: { remoteJid: chat, fromMe: false, id: 'quoted-' + Date.now(), participant: q.sender || sender },
      download: async () => qMedia,
    };
  }
  return m;
}

const PRIORITY_NAMES = ['ping', 'alive', 'menu', 'help', 'time', 'date', 'jid', 'system'];
const PRIORITY_FALLBACK = {
  time: async (sock, m) => sock.sendMessage(m.chat, { text: '🕐 ' + new Date().toLocaleTimeString('fr-FR', { timeZone: 'Africa/Douala' }) }),
  date: async (sock, m) => sock.sendMessage(m.chat, { text: '📅 ' + new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }),
  ping: async (sock, m) => sock.sendMessage(m.chat, { text: '🏓 Pong !' }),
  alive: async (sock, m) => sock.sendMessage(m.chat, { text: '✅ DJOUSSE-TECH-MD en ligne\n🕐 ' + new Date().toLocaleString('fr-FR') }),
  menu: async (sock, m) => sock.sendMessage(m.chat, { text: '📋 Menu: utilisez .allmenu pour toutes les commandes, ou .help pour l\'aide.' }),
  help: async (sock, m) => sock.sendMessage(m.chat, { text: 'ℹ️ Aide: .menu · .allmenu · .ping · .alive · .time · .date · .jid · .system' }),
  jid: async (sock, m) => sock.sendMessage(m.chat, { text: '🆔 ' + m.chat }),
  system: async (sock, m) => {
    const up = process.uptime();
    const h = Math.floor(up / 3600), mi = Math.floor((up % 3600) / 60), s = Math.floor(up % 60);
    sock.sendMessage(m.chat, { text: '📊 SYSTEM\n🕐 Uptime: ' + h + 'h ' + mi + 'm ' + s + 's\n💾 RAM: ' + Math.round(process.memoryUsage().rss / 1024 / 1024) + ' MB\n✅ En ligne' });
  },
};

function findCommands(cmdName) {
  const matches = [];
  for (const cmd of commands) {
    if (!cmd.pattern) continue;
    const pattern = typeof cmd.pattern === 'string' ? cmd.pattern.toLowerCase() : '';
    const aliases = Array.isArray(cmd.alias) ? cmd.alias.map(a => String(a).toLowerCase()) : [];
    const regexHit = cmd.pattern instanceof RegExp && cmdName.match(cmd.pattern);
    if (pattern === cmdName || aliases.includes(cmdName) || regexHit) matches.push(cmd);
  }
  return matches;
}

async function executeCommand(message) {
  const start = Date.now();
  const outbox = [];
  const sock = createVirtualSock(outbox);
  const m = buildMessage(message, outbox);
  const prefix = message.prefix || config.PREFIX || '.';
  const cmdName = m.body.slice(prefix.length).trim().split(' ')[0].toLowerCase();
  const isOwner = ownerNumber.includes(m.sender);
  const effectiveMode = message.mode || process.env.MODE || config.MODE || 'public';
  const parts = m.body.slice(prefix.length).trim().split(' ');
  const ctx = { ...config, q: parts.slice(1).join(' '), from: m.chat, args: parts.slice(1), reply: (t) => m.reply(t), quoted: m.quoted, isOwner, client: sock, commands, ctx: buildContext(sock, m, commands, { ...config, q: parts.slice(1).join(' '), from: m.chat, args: parts.slice(1), reply: (t) => m.reply(t), quoted: m.quoted, isOwner, client: sock, commands }) };
  const respond = (matched, category, filename) => ({
    ok: true, matched, category, filename, ms: Date.now() - start,
    outbox: outbox.map(i => ({ ...i })),
  });

  if (!m.body.startsWith(prefix)) return { ok: true, ignored: true, ms: Date.now() - start };

  if (PRIORITY_NAMES.includes(cmdName)) {
    const plugin = findCommands(cmdName)[0];
    const fn = plugin?.function || PRIORITY_FALLBACK[cmdName];
    if (fn) {
      try {
        await withTimeout(fn(sock, m, commands, ctx), PRIORITY_TIMEOUT);
      } catch (e) {
        m.reply('❌ Erreur: ' + e.message);
      }
    }
    return respond(cmdName, plugin?.category || 'priority', plugin?.filename);
  }

  const matches = findCommands(cmdName);
  if (matches.length === 0) return { ok: false, matched: cmdName, ms: Date.now() - start };

  if (effectiveMode === 'private' && !isOwner && !matches.some(c => c.fromMe)) {
    m.reply('🔒 Mode privé — réservé à l\'owner.');
    return respond(cmdName, matches[0]?.category, matches[0]?.filename);
  }
  if (matches.every(c => c.fromMe) && !isOwner) {
    m.reply('👑 Commande réservée à l\'owner.');
    return respond(cmdName, matches[0]?.category, matches[0]?.filename);
  }

  let lastErr = null;
  for (const cmd of matches) {
    try {
      await withTimeout(cmd.function(sock, m, commands, ctx), PLUGIN_TIMEOUT);
      lastErr = null;
      break;
    } catch (e) {
      lastErr = e;
      console.error('❌ Core .' + cmdName + ' (' + (cmd.filename || '?') + '):', e.message);
    }
  }
  if (lastErr) m.reply('❌ Erreur: ' + lastErr.message);
  return respond(cmdName, matches[0]?.category, matches[0]?.filename);
}

const app = express();
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/execute', rateLimit({ windowMs: 60000, max: parseInt(process.env.CORE_RATE_LIMIT || '120', 10), standardHeaders: false }));
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', process.env.CORE_CORS_ORIGIN || '');
  res.set('Access-Control-Allow-Headers', 'x-core-token,content-type');
  res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

/* Token optionnel : s'il est défini (CORE_TOKEN), les routes sensibles l'exigent. */
const CORE_TOKEN = process.env.CORE_TOKEN || '';
function requireToken(req, res, next) {
  if (!CORE_TOKEN) return next();
  if (req.headers['x-core-token'] === CORE_TOKEN) return next();
  return res.status(401).json({ success: false, message: 'unauthorized' });
}
app.use(['/settings', '/commands', '/validate', '/execute', '/commands/download'], requireToken);

const categories = [...new Set(visibleCommands.map(c => c.category || 'misc'))];

app.get('/', (req, res) => res.json({
  success: true, name: CORE_NAME, version: VERSION, protocol: PROTOCOL, status: 'Running',
  endpoints: { validate: '/validate', execute: '/execute', commands: '/commands', settings: '/settings/:sessionId', manifest: '/manifest', handshake: '/handshake', version: '/version', health: '/health' },
}));

app.get('/health', (req, res) => res.json({
  success: true, uptime: process.uptime(),
  memory: { rss: process.memoryUsage().rss, heapUsed: process.memoryUsage().heapUsed },
  commands: visibleCommands.length, categories: categories.length, version: VERSION, status: 'healthy',
}));

app.get('/version', (req, res) => res.json({ success: true, version: VERSION, protocol: PROTOCOL, platform: 'DJOUSSE-TECH' }));

app.get('/handshake', (req, res) => res.json({ success: true, protocol: PROTOCOL }));

app.get('/manifest', (req, res) => res.json({
  success: true, platform: 'DJOUSSE-TECH', version: VERSION, protocol: PROTOCOL,
  commandCount: visibleCommands.length, categories, generatedAt: Date.now(), runtime: 'Node.js',
  endpoints: { validate: '/validate', execute: '/execute', commands: '/commands', commandsDownload: '/commands/download', settings: '/settings/:sessionId', manifest: '/manifest', handshake: '/handshake', version: '/version', health: '/health' },
}));

app.get('/commands', (req, res) => res.json({
  success: true, count: visibleCommands.length,
  commands: visibleCommands.map(c => ({
    pattern: c.pattern, alias: c.alias || [], desc: c.desc || '', category: c.category || 'misc',
    fromMe: !!c.fromMe,
  })),
}));

app.get('/commands/download', (req, res) => res.json({ success: true, url: '/commands' }));

app.get('/settings/:sessionId', (req, res) => res.json({
  prefix: process.env.PREFIX || config.PREFIX || '.',
  mode: process.env.MODE || config.MODE || 'public',
  botName: config.BOT_NAME,
  owner: config.BOT_OWNER ? config.BOT_OWNER.slice(0, 4) + '••••' : '',
}));

function validateSession(sessionId) {
  const allowed = (process.env.CORE_SESSION_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (allowed.length === 0) return { ok: true, dev: true };
  if (!sessionId) return { ok: false, message: 'SESSION_ID requis.' };
  if (!allowed.includes(sessionId)) return { ok: false, message: 'SESSION_ID invalide.' };
  return { ok: true };
}

app.post('/validate', (req, res) => {
  const v = validateSession(req.body?.sessionId);
  if (!v.ok) return res.status(401).json({ success: false, message: v.message });
  res.json({ success: true, client: 'DJOSSE-TECH-MD', auth: 'valid' });
});

app.post('/execute', async (req, res) => {
  const v = validateSession(req.body?.sessionId);
  if (!v.ok) return res.status(401).json({ success: false, message: v.message });
  try {
    const result = await executeCommand(req.body?.message || {});
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = { app, executeCommand, commands: visibleCommands };

if (require.main === module) {
  app.listen(PORT, () => console.log('🚀 ' + CORE_NAME + ' v' + VERSION + ' — ' + visibleCommands.length + ' commandes sur http://0.0.0.0:' + PORT));
}
