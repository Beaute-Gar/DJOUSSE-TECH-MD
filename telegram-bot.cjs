require('dotenv').config();
const http = require('http');
const https = require('https');

// ══════════════════════════════════════════════════════════════
// DJOUSSE-TECH-MD — Telegram Bot (Multi-Compte WhatsApp Bridge)
// ══════════════════════════════════════════════════════════════

const BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
const BOT_URL = String(process.env.BOT_URL || 'http://localhost:3000').trim().replace(/\/+$/, '');
const WEB_APP_URL = String(process.env.TELEGRAM_WEB_APP_URL || 'https://djousse-tech-md.onrender.com').trim().replace(/\/+$/, '');
const OWNER_ID = String(process.env.OWNER_ID || '237693978044').trim();
const API = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : '';
const PORT = Number(process.env.TELEGRAM_PORT || 3002);

let offset = 0, polling = false, stopping = false, pollRetryMs = 1000;

// ─── Telegram API ─────────────────────────────────────────────
function apiCall(method, body) {
  if (!BOT_TOKEN) return Promise.reject(new Error('TELEGRAM_BOT_TOKEN manquant'));
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body || {});
    const url = new URL(`${API}/${method}`);
    const req = https.request({
      hostname: url.hostname, path: url.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout: 30000
    }, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        try {
          const result = JSON.parse(buf);
          if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(result.description || `HTTP ${res.statusCode}`));
          resolve(result);
        } catch { resolve({ ok: false, raw: buf }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(data); req.end();
  });
}

function httpGetJSON(urlStr) {
  return new Promise((resolve, reject) => {
    const mod = urlStr.startsWith('https') ? https : http;
    mod.get(urlStr, { timeout: 15000 }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); }
      });
    }).on('error', reject);
  });
}

function httpPostJSON(urlStr, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body || {});
    const u = new URL(urlStr);
    const mod = u.protocol === 'https:' ? https : http;
    const req = mod.request({
      hostname: u.hostname, port: u.port, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout: 30000
    }, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => { try { resolve(JSON.parse(buf)); } catch { resolve({ raw: buf }); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(data); req.end();
  });
}

function httpGetBuffer(urlStr) {
  return new Promise((resolve, reject) => {
    const mod = urlStr.startsWith('https') ? https : http;
    mod.get(urlStr, { timeout: 15000 }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        if (res.statusCode >= 300) return reject(new Error(`HTTP ${res.statusCode}`));
        resolve({ buffer, contentType: String(res.headers['content-type'] || '') });
      });
    }).on('error', reject);
  });
}

async function sendMessage(chatId, text, extra) {
  return apiCall('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra }).catch(e => console.error('sendMessage:', e.message));
}
async function editMessage(chatId, messageId, text, extra) {
  return apiCall('editMessageText', { chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML', ...extra }).catch(e => console.error('editMessage:', e.message));
}
async function answerCallbackQuery(id, text) {
  return apiCall('answerCallbackQuery', { callback_query_id: id, text, show_alert: false }).catch(() => {});
}
async function sendPhotoBuffer(chatId, photo, caption) {
  return new Promise((resolve, reject) => {
    const boundary = `----DJOUSSE${Date.now()}`;
    const parts = [
      `--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${chatId}\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n${caption}\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="parse_mode"\r\n\r\nHTML\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="qr.png"\r\nContent-Type: image/png\r\n\r\n`,
      photo, `\r\n--${boundary}--\r\n`,
    ];
    const body = Buffer.concat(parts.map(p => Buffer.isBuffer(p) ? p : Buffer.from(p)));
    const url = new URL(`${API}/sendPhoto`);
    const req = https.request({
      hostname: url.hostname, path: url.pathname, method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length },
      timeout: 30000,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { const r = JSON.parse(data); r.ok ? resolve(r) : reject(new Error(r.description)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end(body);
  });
}

// ─── Messages ─────────────────────────────────────────────────
const WELCOME_MSG = `⚡ <b>DJOUSSE-TECH-MD Bot</b>

👋 Contrôle ton bot WhatsApp multi-compte depuis Telegram !

<b>🚀 Démarrage rapide :</b>
1️⃣ <code>/link 2376XXXXXXXX</code> — lie ton numéro
2️⃣ <code>/pair</code> — code d'appairage, ou <code>/qr</code> — QR code
3️⃣ <code>/mynumber</code> — vérifie ta connexion
4️⃣ <code>.ping</code> — envoie directement une commande WhatsApp !

<i>Toute commande qui commence par "." est relayée sur ton WhatsApp et la réponse revient ici.</i>

<b>🌐 Dashboard :</b> appuie sur le bouton menu ci-dessous.

<i>DJOUSSSE TECH EVOLUTION</i>`;

const HELP_MSG = `📖 <b>Aide — DJOUSSE-TECH-MD</b>

<b>🔗 Connexion (multi-compte) :</b>
• /link &lt;numéro&gt; — Lier ton compte Telegram à un numéro
• /pair — Connecter par code d'appairage
• /qr — Connecter en scannant un QR code
• /mynumber — Statut de TA connexion
• /accounts — Toutes les sessions du serveur
• /unlink — Délier ton numéro

<b>🎮 Contrôle WhatsApp :</b>
• .ping / .alive / .menu / .system — Commandes directes
• /cmd &lt;commande&gt; — Idem, forme explicite
• /stats — Statistiques de ton numéro

<b>ℹ️ Divers :</b>
• /status — Statut global du serveur
• /botinfo — Infos techniques
• /ping — Latence Telegram
• /owner — Contact propriétaire
• /donate — Soutenir le projet

<b>Exemples :</b>
<code>/link 237690000000</code>
<code>/pair</code> → reçois ton code
<code>.menu</code> → le menu WhatsApp arrive ici`;

function mainKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '🔑 Pair', callback_data: 'pair_start' }, { text: '📷 QR', callback_data: 'qr_start' }],
      [{ text: '📱 Mon statut', callback_data: 'mynumber' }, { text: '📊 Serveur', callback_data: 'status' }],
      [{ text: '❓ Aide', callback_data: 'help' }],
    ]
  };
}

// ─── Handlers principaux ──────────────────────────────────────

async function handleLink(chatId, number) {
  // Vérifie que le numéro est connu du serveur multi-compte
  const create = await httpPostJSON(`${BOT_URL}/api/connection/create`, {
    phone: number, method: 'none', telegramUserId: String(chatId)
  }).catch(e => ({ success: false, error: e.message }));
  if (!create.success) {
    return sendMessage(chatId, `❌ <b>Erreur de liaison</b>\n\n${create.error || 'Serveur WhatsApp inaccessible.'}`);
  }
  return sendMessage(chatId,
    `✅ <b>Compte lié !</b>\n\n📱 Numéro : <code>+${number}</code>\n👤 Telegram : <code>${chatId}</code>\n\n${create.alreadyConnected
      ? '🟢 Ce numéro est <b>déjà connecté</b> au bot. Envoie <code>.ping</code> pour tester !'
      : '🟡 Maintenant connecte le avec <code>/pair</code> ou <code>/qr</code>.'}`,
    { reply_markup: mainKeyboard() });
}

async function getLinkedNumber(chatId) {
  const status = await httpGetJSON(`${BOT_URL}/api/status/user/${chatId}`).catch(() => null);
  const sessions = status?.sessions || [];
  const connected = sessions.find(s => s.connected);
  return { phone: connected?.phone || sessions[0]?.phone || null, sessions, status };
}

async function handleMyNumber(chatId) {
  const { phone, sessions, status } = await getLinkedNumber(chatId);
  if (!status) return sendMessage(chatId, '❌ Serveur WhatsApp injoignable.');
  if (!phone) {
    return sendMessage(chatId,
      `🔴 <b>Aucun numéro lié</b>\n\nUtilise <code>/link 2376XXXXXXXX</code> puis <code>/pair</code> ou <code>/qr</code>.`,
      { reply_markup: mainKeyboard() });
  }
  const lines = sessions.map(s =>
    `${s.connected ? '🟢' : '🟡'} <code>+${s.phone}</code> — ${s.connected ? 'Connecté' : 'En attente d\'appairage'}`).join('\n');
  return sendMessage(chatId,
    `📱 <b>Tes connexions WhatsApp</b>\n\n${lines}\n\n⏱ Uptime serveur : ${Math.round((status.uptime || 0) / 60)} min`);
}

async function handlePair(chatId, number) {
  const loading = await sendMessage(chatId, `⏳ Génération du code pour <code>+${number}</code>...`);
  const msgId = loading?.result?.message_id;
  try {
    const create = await httpPostJSON(`${BOT_URL}/api/connection/create`, {
      phone: number, method: 'pairing', telegramUserId: String(chatId)
    });
    if (!create.success) return editMessage(chatId, msgId, `❌ ${create.error || 'Erreur'}`);
    if (create.alreadyConnected) {
      return editMessage(chatId, msgId, `✅ <b>Déjà connecté !</b>\n\n<code>+${number}</code> est en ligne. 🎉`);
    }
    const deadline = Date.now() + 40000;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 1500));
      const st = await httpGetJSON(`${BOT_URL}/api/connection/${number}/status`).catch(() => null);
      if (st?.pairingCode) {
        const code = st.pairingCode.match(/.{1,4}/g)?.join('-') || st.pairingCode;
        return editMessage(chatId, msgId,
          `🔑 <b>Code d'appairage</b>\n\n📱 <code>+${number}</code>\n🎫 <code>${code}</code>\n\n<b>Sur ton téléphone :</b>\n1️⃣ WhatsApp → Paramètres\n2️⃣ Appareils connectés\n3️⃣ Associer un appareil\n4️⃣ « Associer avec le numéro de téléphone »\n5️⃣ Saisis le code\n\n⏱ Valable ~2 min. Je te préviens dès la connexion ! ✨`);
      }
      if (st?.status === 'connected') {
        return editMessage(chatId, msgId, `✅ <b>Connecté !</b>\n\n<code>+${number}</code> est en ligne. 🎉`);
      }
    }
    return editMessage(chatId, msgId, `⏱ Timeout. Réessaie avec /pair — le code arrive parfois en quelques secondes de plus.`);
  } catch (e) {
    return editMessage(chatId, msgId, `❌ ${e.message}`);
  }
}

async function handleQr(chatId, number) {
  const loading = await sendMessage(chatId, '⏳ Génération du QR code...');
  const msgId = loading?.result?.message_id;
  try {
    const create = await httpPostJSON(`${BOT_URL}/api/connection/create`, {
      phone: number, method: 'qr', telegramUserId: String(chatId)
    });
    if (!create.success) return editMessage(chatId, msgId, `❌ ${create.error || 'Erreur'}`);
    if (create.alreadyConnected) {
      return editMessage(chatId, msgId, `✅ <b>Déjà connecté !</b>\n\n<code>+${number}</code> est en ligne. 🎉`);
    }
    await new Promise(r => setTimeout(r, 4000));
    const { buffer, contentType } = await httpGetBuffer(`${BOT_URL}/qr-image?number=${number}`);
    if (!contentType.includes('image')) {
      return editMessage(chatId, msgId, '⏳ QR pas encore prêt. Réessaie avec /qr dans quelques secondes.');
    }
    await apiCall('deleteMessage', { chat_id: chatId, message_id: msgId }).catch(() => {});
    await sendPhotoBuffer(chatId, buffer,
      `📱 <b>QR WhatsApp</b> — <code>+${number}</code>\n\nOuvre WhatsApp → Appareils connectés → Connecter un appareil → scanne.\n\n⏱ Le QR expire ~40 s : fais /qr pour un nouveau.`);
  } catch (e) {
    return editMessage(chatId, msgId, `❌ QR indisponible : ${e.message}`);
  }
}

// Commande relayée WhatsApp → capture de la réponse par le serveur
async function handleCmd(chatId, command, linkedPhone) {
  const loading = await sendMessage(chatId, `⏳ <code>${command.replace(/</g, '&lt;')}</code> → WhatsApp...`);
  const msgId = loading?.result?.message_id;
  try {
    const result = await httpPostJSON(`${BOT_URL}/api/send-cmd`, {
      number: linkedPhone, cmd: command, telegramUserId: String(chatId)
    });
    if (!result.ok) {
      return editMessage(chatId, msgId, `❌ <b>${result.error}</b>\n\nVérifie ta connexion avec /mynumber.`);
    }
    // La réponse WhatsApp arrivera via /forward (push du serveur)
    return editMessage(chatId, msgId, `📡 <b>Commande envoyée sur WhatsApp</b>\n\n<code>${command.replace(/</g, '&lt;')}</code>\n\n<i>La réponse arrive ci-dessous... ⏳</i>`);
  } catch (e) {
    return editMessage(chatId, msgId, `❌ ${e.message}`);
  }
}

async function handleAccounts(chatId) {
  const status = await httpGetJSON(`${BOT_URL}/api/status`).catch(() => null);
  if (!status) return sendMessage(chatId, '❌ Serveur injoignable.');
  const list = (status.accounts || []).map((a, i) =>
    `${i + 1}️⃣ ${a.connected ? '🟢' : '🟡'} <code>+${a.number}</code>`).join('\n') || '_Aucune session_';
  return sendMessage(chatId,
    `👥 <b>Sessions serveur</b>\n\n${list}\n\n🟢 Connectés : <b>${status.connectedAccounts || 0}</b>\n📊 Total : <b>${(status.accounts || []).length}</b>`);
}

// ─── Router ───────────────────────────────────────────────────
function isOwner(userId) { return String(userId) === OWNER_ID; }

async function routeMessage(msg) {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  const userId = String(msg.from?.id || '');

  if (/^\/start(@\w+)?$/i.test(text))
    return sendMessage(chatId, WELCOME_MSG, { reply_markup: mainKeyboard() });
  if (/^\/help(@\w+)?$/i.test(text)) return sendMessage(chatId, HELP_MSG);

  // /link <numéro>
  const linkMatch = text.match(/^\/link(@\w+)?\s+([0-9+\s]+)/i);
  if (linkMatch) {
    const number = linkMatch[2].replace(/[^0-9]/g, '');
    if (number.length < 8) return sendMessage(chatId, '❌ Numéro invalide. Ex: <code>/link 2376XXXXXXXX</code>');
    return handleLink(chatId, number);
  }
  if (/^\/unlink(@\w+)?$/i.test(text)) {
    const { phone } = await getLinkedNumber(chatId);
    if (phone) await httpPostJSON(`${BOT_URL}/api/unlink`, { number: phone });
    return sendMessage(chatId, '✅ Ton numéro a été délié de ce compte Telegram.');
  }

  // /pair et /qr nécessitent un numéro lié (ou fourni inline)
  const inlineNum = (text.match(/^\/(pair|qr)(@\w+)?\s+([0-9+\s]+)/i) || [])[3]?.replace(/[^0-9]/g, '');
  let targetNumber = inlineNum;
  if (!targetNumber && (/^\/(pair|qr)(@\w+)?(\s|$)/i.test(text))) {
    const { phone } = await getLinkedNumber(chatId);
    if (!phone) {
      return sendMessage(chatId,
        '📱 Aucun numéro lié.\n\nFais d\'abord <code>/link 2376XXXXXXXX</code>, ou <code>/pair 2376XXXXXXXX</code> directement.');
    }
    targetNumber = phone;
    if (/^\/pair/i.test(text)) return handlePair(chatId, targetNumber);
    return handleQr(chatId, targetNumber);
  }

  // /mynumber
  if (/^\/mynumber(@\w+)?$/i.test(text)) return handleMyNumber(chatId);

  // /accounts
  if (/^\/accounts(@\w+)?$/i.test(text)) return handleAccounts(chatId);

  // /status
  if (/^\/status(@\w+)?$/i.test(text)) {
    const status = await httpGetJSON(`${BOT_URL}/api/status`).catch(() => null);
    if (!status) return sendMessage(chatId, '❌ Serveur WhatsApp injoignable.');
    const up = Math.floor((status.uptime || 0) / 3600) + 'h ' + Math.floor(((status.uptime || 0) % 3600) / 60) + 'm';
    return sendMessage(chatId,
      `📊 <b>Serveur DJOUSSE-TECH-MD</b>\n\n⏱ Uptime : ${up}\n🧠 RAM : ${status.memory?.rss || 'N/A'}\n📚 Commandes : ${status.commands || 0}\n🟢 Comptes connectés : ${status.connectedAccounts || 0}/${(status.accounts || []).length}`);
  }

  // /cmd ou commande "." directe
  const cmdMatch = text.match(/^\/cmd(@\w+)?\s+(.+)/i);
  let command = cmdMatch ? cmdMatch[2].trim() : null;
  if (!command && /^\./.test(text) && !text.startsWith('/')) command = text;
  if (command) {
    if (!command.startsWith('.')) {
      return sendMessage(chatId, '❌ La commande doit commencer par <code>.</code>\nEx: <code>.ping</code>');
    }
    const { phone } = await getLinkedNumber(chatId);
    if (!phone) {
      return sendMessage(chatId, '🔴 Aucun numéro connecté lié à ton compte.\n\nFais /link puis /pair ou /qr.');
    }
    return handleCmd(chatId, command, phone);
  }

  // Numéro nu → proposer de lier
  if (!text.startsWith('/')) {
    const cleaned = text.replace(/[^0-9]/g, '');
    if (/^\d+$/.test(cleaned) && cleaned.length >= 8 && cleaned.length <= 15) {
      return sendMessage(chatId, `📱 Numéro détecté : <code>${cleaned}</code>\n\nVeux-tu le lier et le connecter ?`, {
        reply_markup: { inline_keyboard: [
          [{ text: '🔗 Lier + Connecter (code)', callback_data: `autopair_${cleaned}` }],
          [{ text: '📷 Lier + QR', callback_data: `autoqr_${cleaned}` }],
        ] }
      });
    }
  }
}

async function routeCallbackQuery(query) {
  const chatId = query.message?.chat.id;
  const data = query.data;
  answerCallbackQuery(query.id);

  if (data === 'help') return sendMessage(chatId, HELP_MSG);
  if (data === 'status') { await routeMessage({ chat: { id: chatId }, from: { id: OWNER_ID }, text: '/status' }); return; }
  if (data === 'mynumber') return handleMyNumber(chatId);
  if (data === 'pair_start' || data === 'qr_start') {
    const { phone } = await getLinkedNumber(chatId);
    if (!phone) return sendMessage(chatId, '📱 Lie d\'abord un numéro : <code>/link 2376XXXXXXXX</code>');
    if (data === 'pair_start') return handlePair(chatId, phone);
    return handleQr(chatId, phone);
  }
  const pairM = data.match(/^autopair_(\d+)$/);
  if (pairM) { await handleLink(chatId, pairM[1]); return handlePair(chatId, pairM[1]); }
  const qrM = data.match(/^autoqr_(\d+)$/);
  if (qrM) { await handleLink(chatId, qrM[1]); return handleQr(chatId, qrM[1]); }
}

// ─── Réponses WhatsApp poussées depuis index.cjs ──────────────
const server = http.createServer((req, res) => {
  if ((req.method === 'POST' && req.url === '/forward')) {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { chatId, text } = JSON.parse(body);
        if (chatId && text) await sendMessage(chatId, `📩 <b>Réponse WhatsApp</b>\n\n${text.replace(/</g, '&lt;')}`);
      } catch (_) {}
      res.writeHead(200); res.end('ok');
    });
    return;
  }
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', bot: 'djousse-telegram', uptime: process.uptime() }));
  }
  res.writeHead(404); res.end('Not found');
});

// ─── Long Polling ─────────────────────────────────────────────
async function pollUpdates() {
  if (polling || stopping) return;
  polling = true;
  try {
    const res = await apiCall('getUpdates', { offset, timeout: 30 });
    if (!res.ok) {
      polling = false;
      setTimeout(pollUpdates, pollRetryMs);
      pollRetryMs = Math.min(pollRetryMs * 2, 30000);
      return;
    }
    pollRetryMs = 1000;
    for (const update of res.result || []) {
      offset = update.update_id + 1;
      try {
        if (update.message) await routeMessage(update.message);
        if (update.callback_query) await routeCallbackQuery(update.callback_query);
      } catch (err) { console.error('Handler error:', err.message); }
    }
  } catch (err) { console.error('Poll error:', err.message); }
  polling = false;
  if (!stopping) setImmediate(pollUpdates);
}

// ─── Start ────────────────────────────────────────────────────
(async () => {
  if (!BOT_TOKEN) { console.error('❌ TELEGRAM_BOT_TOKEN manquant.'); process.exitCode = 1; return; }

  server.listen(PORT, () => console.log(`🌐 Telegram bot HTTP server on port ${PORT}`));
  console.log('🚀 Starting DJOUSSE-TECH-MD Telegram Bot...');

  await apiCall('setMyCommands', { commands: [
    { command: 'start', description: 'Bienvenue et menu' },
    { command: 'link', description: 'Lier un numéro (ex: /link 2376XXXXXXXX)' },
    { command: 'pair', description: 'Connexion par code d\'appairage' },
    { command: 'qr', description: 'Connexion par QR code' },
    { command: 'mynumber', description: 'Statut de ma connexion WhatsApp' },
    { command: 'accounts', description: 'Toutes les sessions du serveur' },
    { command: 'status', description: 'Statut du serveur' },
    { command: 'cmd', description: 'Exécuter une commande WhatsApp (.cmd .ping)' },
    { command: 'help', description: 'Aide détaillée' },
    { command: 'owner', description: 'Contacter le propriétaire' },
    { command: 'donate', description: 'Faire un don' },
  ] }).then(() => console.log('✅ Bot commands registered')).catch(e => console.error(e.message));

  await apiCall('setMyDescription', { description: '🤖 Contrôle ton bot WhatsApp multi-compte depuis Telegram. /pair, /qr, commandes relayées en temps réel.' }).catch(() => {});
  await apiCall('setChatMenuButton', { menu_button: { type: 'web_app', text: '🌐 Ouvrir DJOUSSE TECH', web_app: { url: WEB_APP_URL } } }).catch(() => {});

  console.log('🤖 DJOUSSE-TECH-MD Telegram Bot is running!');
  pollUpdates();
})();

function shutdown(signal) {
  if (stopping) return;
  stopping = true; polling = false;
  console.log(`\n🛑 Shutting down (${signal})...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
