require('dotenv').config();
const http = require('http');
const https = require('https');

// ══════════════════════════════════════════════════════════════
// DJOUSSE-TECH-MD — Telegram Bot (WhatsApp Bot Controller)
// Zero-dependency — native HTTP only
// ══════════════════════════════════════════════════════════════

const BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
const BOT_URL = String(process.env.BOT_URL || 'http://localhost:3000').trim().replace(/\/+$/, '');
const WEB_APP_URL = String(process.env.TELEGRAM_WEB_APP_URL || 'https://djousse-tech-md.onrender.com').trim().replace(/\/+$/, '');
const OWNER_ID = String(process.env.OWNER_ID || '237693978044').trim();
const API = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : '';
const PORT = Number(process.env.TELEGRAM_PORT || process.env.PORT || 3002);

let offset = 0;
let polling = false;
let stopping = false;
let pollRetryMs = 1000;

// ══════════════════════════════════════════════════════════════
// Telegram API Helpers
// ══════════════════════════════════════════════════════════════

function apiCall(method, body) {
  if (!BOT_TOKEN) return Promise.reject(new Error('TELEGRAM_BOT_TOKEN manquant'));
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body || {});
    const url = new URL(`${API}/${method}`);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout: 30000
    }, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        try {
          const result = JSON.parse(buf);
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(result.description || `Telegram HTTP ${res.statusCode}`));
          }
          resolve(result);
        }
        catch { resolve({ ok: false, raw: buf }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(data);
    req.end();
  });
}

function httpGetJSON(urlStr) {
  return new Promise((resolve, reject) => {
    const mod = urlStr.startsWith('https') ? https : http;
    mod.get(urlStr, { timeout: 15000 }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(result.error || result.message || `HTTP ${res.statusCode}`));
          }
          resolve(result);
        }
        catch { resolve({ raw: data }); }
      });
    }).on('error', reject);
  });
}

function httpGetBuffer(urlStr) {
  return new Promise((resolve, reject) => {
    const mod = urlStr.startsWith('https') ? https : http;
    mod.get(urlStr, { timeout: 15000 }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        resolve({ buffer, contentType: String(res.headers['content-type'] || '') });
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
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout: 30000
    }, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        try { resolve(JSON.parse(buf)); }
        catch { resolve({ raw: buf }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(data);
    req.end();
  });
}

async function sendMessage(chatId, text, extra) {
  return apiCall('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...extra });
}

async function editMessage(chatId, messageId, text, extra) {
  return apiCall('editMessageText', { chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML', ...extra });
}

async function deleteMessage(chatId, messageId) {
  return apiCall('deleteMessage', { chat_id: chatId, message_id: messageId });
}

async function answerCallbackQuery(callbackQueryId, text) {
  return apiCall('answerCallbackQuery', { callback_query_id: callbackQueryId, text, show_alert: false });
}

async function setMyCommands(commands) {
  return apiCall('setMyCommands', { commands });
}

async function setMyDescription(desc) {
  return apiCall('setMyDescription', { description: desc });
}

async function setMyShortDescription(desc) {
  return apiCall('setMyShortDescription', { short_description: desc });
}

async function setChatMenuButton(menuButton) {
  return apiCall('setChatMenuButton', { menu_button: menuButton });
}

function sendPhotoBuffer(chatId, photo, caption) {
  if (!BOT_TOKEN) return Promise.reject(new Error('TELEGRAM_BOT_TOKEN manquant'));
  return new Promise((resolve, reject) => {
    const boundary = `----DJOUSSE${Date.now()}`;
    const parts = [
      `--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${chatId}\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n${caption}\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="parse_mode"\r\n\r\nHTML\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="whatsapp-qr.png"\r\nContent-Type: image/png\r\n\r\n`,
      photo,
      `\r\n--${boundary}--\r\n`,
    ];
    const body = Buffer.concat(parts.map(part => Buffer.isBuffer(part) ? part : Buffer.from(part)));
    const url = new URL(`${API}/sendPhoto`);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length },
      timeout: 30000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (!result.ok) return reject(new Error(result.description || 'Telegram sendPhoto failed'));
          resolve(result);
        } catch (error) { reject(error); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end(body);
  });
}

// ══════════════════════════════════════════════════════════════
// Messages
// ══════════════════════════════════════════════════════════════

const WELCOME_MSG = `⚡ <b>DJOUSSE-TECH-MD Bot</b>

👋 Bienvenue ! Je suis le bot assistant WhatsApp.

<b>Commandes :</b>
• /start — Afficher ce message
• /help — Aide détaillée
• /menu — Menu complet du bot
• /ping — Tester la connexion
• /status — Statut du bot WhatsApp
• /pair &lt;numéro&gt; — Connecter un WhatsApp par code
• /qr — Recevoir le QR pour connecter
• /cmd &lt;commande&gt; — Exécuter une commande WhatsApp
• /botinfo — Infos du bot
• /owner — Contacter le propriétaire
• /donate — Faire un don

<b>🌐 Web App :</b>
Appuie sur le bouton ci-dessous pour le dashboard.

<i>Créé par DJOUSSE TECH EVOLUTION</i>`;

const HELP_MSG = `📖 <b>Aide — DJOUSSE-TECH-MD Bot</b>

<b>Commandes disponibles :</b>

/start — Message de bienvenue
/help — Cette aide
/menu — Menu complet du bot WhatsApp
/ping — Tester la connexion
/status — Statut du bot WhatsApp
/pair &lt;numéro&gt; — Connecter un WhatsApp par code d'appairage
/qr — Recevoir le QR code WhatsApp
/cmd &lt;commande&gt; — Exécuter une commande sur le bot WhatsApp
/botinfo — Infos du bot
/owner — Contact propriétaire
/donate — Faire un don

<b>Exemples :</b>
<code>/pair 2376XXXXXXXX</code> — Connecter un numéro WhatsApp
<code>/cmd .ping</code> — Ping le bot WhatsApp
<code>/cmd .alive</code> — Vérifier que le bot tourne
<code>/cmd .allmenu</code> — Voir toutes les commandes
<code>/cmd .system</code> — Infos système

<b>Comment ça marche :</b>
1. Le bot WhatsApp tourne sur le serveur
2. Tu peux connecter un numéro avec /pair ou /qr
3. Ensuite, envoie des commandes depuis Telegram
4. Les réponses apparaissent ici

<i>Les commandes WhatsApp sont exécutées en temps réel.</i>`;

const MENU_MSG = `╭───『 <b>D J O U S S E   T E C H</b> 』───●●►
┃
┃  🤖 <b>Menu Principal</b>
┃
┃  <b>📋 Menu & Aide</b>
┃  • .menu / .allmenu — Menu complet
┃  • .help / .aide — Aide détaillée
┃  • .ping — Tester le bot
┃  • .alive — Vérifier si le bot tourne
┃  • .info — Infos du bot
┃  • .system — Infos système
┃
┃  <b>📥 Téléchargement</b>
┃  • .play — Musique YouTube
┃  • .ytmp3 / .ytmp4 — YouTube Audio/Vidéo
┃  • .tiktok — TikTok
┃  • .instagram / .ig — Instagram
┃  • .facebook / .fb — Facebook
┃  • .spotify — Spotify
┃  • .mediafire — Mediafire
┃
┃  <b>🎨 Fun & Jeux</b>
┃  • .sticker / .s — Image → Sticker
┃  • .trash — Photo en poubelle
┃  • .jail — Photo en prison
┃  • .triggered — Effet triggered
┃  • .wasted — Effet wasted
┃  • .beautiful — Cadre beautiful
┃
┃  <b>🤖 Intelligence Artificielle</b>
┃  • .ai / .gemini — Chat IA
┃  • .dalle — Génération d'image
┃  • .translate — Traduction
┃  • .ocr — Lecture de texte dans image
┃
┃  <b>🔧 Utilitaire</b>
┃  • .calculator / .calc — Calculatrice
┃  • .weather / .météo — Météo
┃  • .github — Profil GitHub
┃  • .url → .short — Raccourcir URL
┃
┃  <b>👥 Groupe</b>
┃  • .kick — Expulser un membre
┃  • .add — Ajouter un membre
┃  • .promote — Promouvoir admin
┃  • .demote — Rétrograder admin
┃  • .mute — Mute un membre
┃  • .unmute — Unmute un membre
┃  • .tagall — Mentionner tous les membres
┃  • .hidetag — Mentionner (caché)
┃
┃  <b>👑 Owner</b>
┃  • .mode public/private — Mode du bot
┃  • .restart — Redémarrer le bot
┃  • .broadcast — Envoyer à tous les groupes
┃  • .ban / .unban — Bannir/débannir
┃
┃  <b>📱 Telegram</b>
┃  • /pair &lt;numéro&gt; — Connecter WhatsApp
┃  • /qr — QR code WhatsApp
┃  • /status — Statut du bot
┃  • /cmd .ping — Exécuter une commande
┃
╰─────────────────────────────────────❖●►

<i>Utilise les commandes avec le préfixe . (point)</i>`;

// ══════════════════════════════════════════════════════════════
// Command Handlers
// ══════════════════════════════════════════════════════════════

async function handleStatus(chatId) {
  const loadingMsg = await sendMessage(chatId, '⏳ Vérification du statut...');
  const msgId = loadingMsg?.result?.message_id;
  try {
    // Utiliser l'endpoint user-specific avec le chatId Telegram
    const status = await httpGetJSON(`${BOT_URL}/api/status/user/${chatId}`);
    if (status.error) {
      return editMessage(chatId, msgId, `❌ <b>Statut indisponible</b>\n\n${status.error}`);
    }
    const uptime = status.uptime ? Math.round(status.uptime / 60) + ' min' : 'N/A';
    const sessionsText = status.sessions && status.sessions.length > 0
      ? status.sessions.map((s, i) => {
          const icon = s.connected ? '🟢' : s.status === 'pairing' ? '🟡' : '🔴';
          const phone = s.phone ? `+${s.phone}` : 'N/A';
          return `\n${i + 1}️⃣ ${icon} <code>${phone}</code> — ${s.status}`;
        }).join('')
      : `\n${status.connected ? '🟢' : '🟡'} <b>WhatsApp :</b> ${status.connected ? 'Connecté' : 'En attente de connexion'}`;
    const sessionCount = status.connectedAccounts !== undefined
      ? `\n👥 <b>Sessions :</b> ${status.connectedAccounts || 0}/${status.accounts || 0}`
      : '';
    return editMessage(chatId, msgId,
      `📊 <b>Statut du Bot WhatsApp</b>\n\n⏱ <b>Uptime :</b> ${uptime}\n🤖 <b>Bot :</b> ${status.botName || 'DJOUSSE-TECH-MD'}\n📡 <b>Moteur :</b> ${status.engine || 'Baileys'}${sessionCount}\n${sessionsText}`
    );
  } catch (err) {
    return editMessage(chatId, msgId, `❌ <b>Erreur</b>\n\n${err.message}`);
  }
}

async function handleQr(chatId) {
  const loadingMsg = await sendMessage(chatId, '⏳ Génération du QR code...');
  const msgId = loadingMsg?.result?.message_id;
  try {
    const { buffer, contentType } = await httpGetBuffer(`${BOT_URL}/qr-image?format=png`);
    if (!contentType.includes('image/png')) {
      return editMessage(chatId, msgId, '⏳ Le QR WhatsApp n\'est pas encore prêt. Réessaie dans quelques secondes.');
    }
    await deleteMessage(chatId, msgId);
    return sendPhotoBuffer(chatId, buffer,
      '📱 <b>QR WhatsApp Web</b>\n\nOuvre WhatsApp → Appareils liés → Connecter un appareil, puis scanne ce QR.');
  } catch (error) {
    return editMessage(chatId, msgId, `❌ QR indisponible : ${error.message}\n\nVérifie que le bot WhatsApp est démarré.`);
  }
}

async function handleCmd(chatId, command) {
  const loadingMsg = await sendMessage(chatId, `⏳ Exécution de <code>${command}</code>...`);
  const msgId = loadingMsg?.result?.message_id;
  try {
    const result = await httpPostJSON(`${BOT_URL}/api/send-cmd`, {
      jid: OWNER_ID + '@s.whatsapp.net',
      cmd: command
    });
    if (result.ok) {
      return editMessage(chatId, msgId,
        `✅ <b>Commande exécutée !</b>\n\n📱 <b>Commande :</b> <code>${command}</code>\n📡 <b>Dest :</b> Bot WhatsApp\n\n<i>La réponse sera envoyée sur WhatsApp.</i>`
      );
    } else {
      return editMessage(chatId, msgId,
        `❌ <b>Erreur</b>\n\n${result.error || 'Impossible d\'exécuter la commande'}`
      );
    }
  } catch (err) {
    return editMessage(chatId, msgId, `❌ <b>Erreur de connexion</b>\n\n${err.message}`);
  }
}

async function handlePair(chatId, number) {
  const loadingMsg = await sendMessage(chatId, `⏳ Génération du code pour <code>+${number}</code>...`);
  const msgId = loadingMsg?.result?.message_id;
  try {
    // Utiliser le nouveau endpoint de connexion
    const createResult = await httpPostJSON(`${BOT_URL}/api/connection/create`, {
      phone: number,
      method: 'pairing',
      telegramUserId: String(chatId)
    });

    if (!createResult.success) {
      return editMessage(chatId, msgId, `❌ <b>Erreur</b>\n\n${createResult.error || 'Impossible de créer la connexion'}`);
    }

    if (createResult.alreadyConnected) {
      return editMessage(chatId, msgId,
        `✅ <b>Déjà connecté !</b>\n\nLe numéro <code>+${number}</code> est déjà connecté au bot.`
      );
    }

    const connectionId = createResult.connectionId;

    // Poll le statut jusqu'à obtention du code ou connexion
    const deadline = Date.now() + 95000;
    let code = null;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 1000));
      try {
        const status = await httpGetJSON(`${BOT_URL}/api/connection/${connectionId}/status`);
        if (status.pairingCode) {
          code = status.pairingCode;
          break;
        }
        if (status.status === 'connected') {
          return editMessage(chatId, msgId,
            `✅ <b>Déjà connecté !</b>\n\nLe numéro <code>+${number}</code> est déjà connecté.`
          );
        }
        if (status.status === 'failed') {
          return editMessage(chatId, msgId, `❌ <b>Échec</b>\n\nLa génération du code a échoué.`);
        }
      } catch (_) {}
    }

    if (!code) {
      return editMessage(chatId, msgId, `❌ <b>Timeout</b>\n\nLe code n'a pas pu être généré. Réessaie.`);
    }

    const codeFormatted = code.match(/.{1,4}/g)?.join(' ') || code;
    return editMessage(chatId, msgId,
      `🔑 <b>Code d'appairage</b>\n\n📱 <b>Numéro :</b> <code>+${number}</code>\n🎫 <b>Code :</b> <code>${codeFormatted}</code>\n\n⏱ <b>Expire dans :</b> 10 min\n\n<b>Instructions :</b>\n1. Ouvre WhatsApp\n2. Paramètres → Appareils liés\n3. Lier un appareil\n4. "Lier avec un numéro de téléphone"\n5. Saisis le code ci-dessus\n\n📡 <b>Statut :</b> En attente de confirmation...`
    );
  } catch (err) {
    return editMessage(chatId, msgId, `❌ <b>Erreur</b>\n\n${err.message}`);
  }
}

// ══════════════════════════════════════════════════════════════
// Command Router
// ══════════════════════════════════════════════════════════════

function isOwner(userId) {
  return String(userId) === OWNER_ID;
}

function routeMessage(msg) {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  const userId = String(msg.from?.id || '');

  // /start
  if (/^\/start(@\w+)?$/i.test(text)) {
    return sendMessage(chatId, WELCOME_MSG);
  }

  // /help
  if (/^\/help(@\w+)?$/i.test(text)) {
    return sendMessage(chatId, HELP_MSG);
  }

  // /menu
  if (/^\/menu(@\w+)?$/i.test(text)) {
    return sendMessage(chatId, MENU_MSG);
  }

  // /ping
  if (/^\/ping(@\w+)?$/i.test(text)) {
    const start = Date.now();
    return sendMessage(chatId, '🏓 Pong !').then(() => {
      const ms = Date.now() - start;
      return sendMessage(chatId, `🏓 Pong ! <b>${ms}ms</b>`);
    });
  }

  // /status
  if (/^\/status(@\w+)?$/i.test(text)) {
    return handleStatus(chatId);
  }

  // /qr
  if (/^\/qr(@\w+)?$/i.test(text)) {
    return handleQr(chatId);
  }

  // /cmd <commande>
  const cmdMatch = text.match(/^\/cmd(@\w+)?\s+(.+)/i);
  if (cmdMatch) {
    const command = cmdMatch[2].trim();
    if (!command.startsWith('.')) {
      return sendMessage(chatId, '❌ La commande doit commencer par <code>.</code>\nEx: <code>/cmd .ping</code>');
    }
    return handleCmd(chatId, command);
  }

  // /owner
  if (/^\/owner(@\w+)?$/i.test(text)) {
    return sendMessage(chatId,
      `👤 <b>Propriétaire</b>\n\nContact : <a href="https://wa.me/237693978044">WhatsApp</a>\nBot : @DJOUSSE_TECH_BOT`
    );
  }

  // /donate
  if (/^\/donate(@\w+)?$/i.test(text)) {
    return sendMessage(chatId,
      `💰 <b>Faire un don</b>\n\nMerci pour ton soutien !\n\n📱 <b>MTN Mobile Money :</b> <code>237693978044</code>\n📱 <b>Orange Money :</b> <code>237693978044</code>\n\n<i>Les dons aident à maintenir le bot en ligne 24/7.</i>`
    );
  }

  // /botinfo
  if (/^\/botinfo(@\w+)?$/i.test(text)) {
    return httpGetJSON(`${BOT_URL}/api/status`).then(status => {
      const uptime = status.uptime ? Math.floor(status.uptime / 3600) + 'h ' + Math.floor((status.uptime % 3600) / 60) + 'm' : 'N/A';
      return sendMessage(chatId,
        `🤖 <b>Bot Info</b>\n\n📊 <b>Version :</b> 3.0.0\n⏱ <b>Uptime :</b> ${uptime}\n📡 <b>Moteur :</b> ${status.engine || 'Baileys'}\n${status.connected ? '🟢' : '🟡'} <b>WhatsApp :</b> ${status.connected ? 'Connecté' : 'Déconnecté'}\n💾 <b>Mémoire :</b> ${status.memory || 'N/A'}`
      );
    }).catch(e => sendMessage(chatId, `❌ ${e.message}`));
  }

  // /pair <numéro> — Connexion WhatsApp par code d'appairage
  const pairMatch = text.match(/^\/pair(@\w+)?\s+(.+)/i);
  if (pairMatch) {
    const number = pairMatch[2].trim().replace(/[^0-9]/g, '');
    if (number.length < 8) {
      return sendMessage(chatId, '❌ Numéro invalide. Utilise: <code>/pair 2376XXXXXXXX</code>');
    }
    return handlePair(chatId, number);
  }
  if (/^\/pair(@\w+)?$/i.test(text)) {
    return sendMessage(chatId,
      '📱 <b>Connexion WhatsApp par code</b>\n\nUtilise: <code>/pair 2376XXXXXXXX</code>\n\nLe code d\'appairage sera généré et tu devras le saisir dans WhatsApp.'
    );
  }

  // Plain phone number → generate QR
  if (!text.startsWith('/')) {
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned.length >= 8 && cleaned.length <= 15 && /^\d+$/.test(cleaned)) {
      return sendMessage(chatId,
        `📱 <b>Numéro reçu :</b> <code>${cleaned}</code>\n\nPour connecter le bot, utilise /qr pour obtenir le QR code, ou va sur le site web.`
      );
    }
  }
}

function routeCallbackQuery(query) {
  const chatId = query.message?.chat.id;
  const data = query.data;
  answerCallbackQuery(query.id);

  if (data === 'help') return sendMessage(chatId, HELP_MSG);
  if (data === 'status') return handleStatus(chatId);
  if (data === 'menu') return sendMessage(chatId, MENU_MSG);
  if (data === 'qr') return handleQr(chatId);
}

// ══════════════════════════════════════════════════════════════
// Long Polling
// ══════════════════════════════════════════════════════════════

async function pollUpdates() {
  if (polling || stopping) return;
  polling = true;

  try {
    const res = await apiCall('getUpdates', { offset, timeout: 30 });
    if (!res.ok) {
      console.error('getUpdates failed:', res.description || JSON.stringify(res));
      polling = false;
      setTimeout(pollUpdates, pollRetryMs);
      pollRetryMs = Math.min(pollRetryMs * 2, 30000);
      return;
    }
    pollRetryMs = 1000;

    for (const update of res.result || []) {
      offset = update.update_id + 1;

      try {
        if (update.message) {
          routeMessage(update.message);
        }
        if (update.callback_query) {
          routeCallbackQuery(update.callback_query);
        }
      } catch (err) {
        console.error('Handler error:', err.message);
      }
    }
  } catch (err) {
    console.error('Poll error:', err.message);
  }

  polling = false;
  if (!stopping) setImmediate(pollUpdates);
}

// ══════════════════════════════════════════════════════════════
// Health Check HTTP Server (required by Render)
// ══════════════════════════════════════════════════════════════

const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', bot: 'djousse-telegram', uptime: process.uptime() }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// ══════════════════════════════════════════════════════════════
// Start
// ══════════════════════════════════════════════════════════════

(async () => {
  if (!BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN manquant.');
    process.exitCode = 1;
    return;
  }

  server.listen(PORT, () => {
    console.log(`🌐 Health check server on port ${PORT}`);
  });

  console.log('🚀 Starting DJOUSSE-TECH-MD Telegram Bot...');

  // Register commands
  await setMyCommands([
    { command: 'start', description: 'Message de bienvenue' },
    { command: 'help', description: 'Aide détaillée' },
    { command: 'menu', description: 'Menu complet du bot WhatsApp' },
    { command: 'ping', description: 'Tester la connexion' },
    { command: 'status', description: 'Statut du bot WhatsApp' },
    { command: 'qr', description: 'Recevoir le QR code WhatsApp' },
    { command: 'pair', description: 'Connexion par code (ex: /pair 2376XXXXXXXX)' },
    { command: 'cmd', description: 'Exécuter une commande WhatsApp (.cmd .ping)' },
    { command: 'botinfo', description: 'Infos du bot' },
    { command: 'owner', description: 'Contacter le propriétaire' },
    { command: 'donate', description: 'Faire un don' }
  ]).then(() => console.log('✅ Bot commands registered'));

  await setMyDescription('🤖 DJOUSSE-TECH-MD — Assistant WhatsApp\n\nConnecte et contrôle ton bot WhatsApp directement depuis Telegram.\n\n🔹 /pair <numéro> — Connecter un WhatsApp par code\n🔹 /qr — QR code pour connecter WhatsApp\n🔹 /cmd .ping — Exécuter des commandes WhatsApp\n🔹 /status — Voir l\'état du bot\n🔹 /menu — Liste complète des commandes\n\n🇨🇲 DJOUSSE TECH EVOLUTION — 450+ commandes, IA, Anti-ban, CRM');
  await setMyShortDescription('Assistant WhatsApp — Pairing, QR, commandes. 450+ commandes, IA, Anti-ban.');

  // Web App Menu Button
  await setChatMenuButton({
    type: 'web_app',
    text: '🌐 Ouvrir DJOUSSE TECH',
    web_app: { url: WEB_APP_URL }
  }).then(r => {
    if (r.ok) console.log('✅ Web App menu button configuré');
    else console.log('⚠️ Menu button:', r.description || JSON.stringify(r));
  });

  console.log('🤖 DJOUSSE-TECH-MD Telegram Bot is running!');
  console.log(`💬 Talk to it: https://t.me/DJOUSSE_TECH_BOT`);

  // Start polling
  pollUpdates();
})();

// ══════════════════════════════════════════════════════════════
// Graceful Shutdown
// ══════════════════════════════════════════════════════════════

function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  polling = false;
  console.log(`\n🛑 Shutting down Telegram bot (${signal})...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
