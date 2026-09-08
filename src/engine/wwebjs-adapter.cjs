'use strict';

/* src/engine/wwebjs-adapter.cjs — Moteur whatsapp-web.js présenté avec une surface
   compatible Baileys, pour que lib/msg.cjs, index.cjs et les 140+ plugins continuent
   de fonctionner. Moteur ALLUMÉ via ENGINE_TYPE=wwebjs (défaut: baileys inchangé).

   Ce moteur pilote un vrai Chromium (whatsapp-web.js) → risque de ban réduit,
   mais RAM ~300-500 MB/session (bien plus que Baileys sur Render).
   Chrome système priorisé via WWEBJS_CHROME_PATH, sinon Chromium bundled puppetears. */

const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs');
const { Client, LocalAuth, MessageMedia, Location, Poll } = require('whatsapp-web.js');

const DEFAULT_CHROME_CANDIDATES = [
  process.env.WWEBJS_CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

function findChrome() {
  for (const c of DEFAULT_CHROME_CANDIDATES) {
    try { if (fs.existsSync(c)) return c; } catch {}
  }
  return undefined;
}

function widToJid(wid) {
  const w = String(wid || '');
  if (w.endsWith('@c.us')) return w.slice(0, -5) + '@s.whatsapp.net';
  return w;
}
function jidToWid(jid) {
  const j = String(jid || '').split(':')[0];
  const suffix = '@s.whatsapp.net';
  if (j.endsWith(suffix)) return j.slice(0, -suffix.length) + '@c.us';
  return j;
}

/* Convertit un Message whatsapp-web.js en pseudo-proto compréhensible par sms() */
function translateMessage(client, wmsg) {
  const fromMe = !!wmsg.fromMe;
  /* wwebjs : pour un message fromMe (envoyé par le compte connecté),
     `msg.to` est le VRAI chat (groupe/DM), `msg.from` est l'expéditeur (LID).
     Pour un message reçu, `msg.from` est le chat. On suit _getChatId(). */
  const remoteJid = fromMe ? (wmsg.to || wmsg.remote || wmsg.from) : (wmsg.remote || wmsg.from);
  const jid = widToJid(remoteJid);
  const participant = wmsg.author ? widToJid(wmsg.author) : (wmsg.from ? widToJid(wmsg.from) : undefined);
  const key = {
    remoteJid: jid,
    fromMe,
    id: wmsg.id?.id || wmsg.id?._serialized || Date.now().toString(),
    participant: participant && participant !== jid ? participant : undefined,
  };

  let message = null;
  const type = wmsg.type;
  const body = wmsg.body || '';
  const mentioned = (wmsg.mentionedIds || []).map(id => widToJid(id));

  if (type === 'image' && wmsg.hasMedia) {
    message = { imageMessage: { url: 'wwebjs://media', mimetype: (wmsg.media && wmsg.media.mimetype) || 'image/jpeg', caption: body || undefined, _be_raw: wmsg } };
  } else if (type === 'video' && wmsg.hasMedia) {
    message = { videoMessage: { url: 'wwebjs://media', mimetype: (wmsg.media && wmsg.media.mimetype) || 'video/mp4', caption: body || undefined, _be_raw: wmsg } };
  } else if (type === 'audio' && wmsg.hasMedia) {
    message = { audioMessage: { url: 'wwebjs://media', mimetype: (wmsg.media && wmsg.media.mimetype) || 'audio/mpeg', _be_raw: wmsg } };
  } else if (type === 'sticker' && wmsg.hasMedia) {
    message = { stickerMessage: { url: 'wwebjs://media', mimetype: (wmsg.media && wmsg.media.mimetype) || 'image/webp', _be_raw: wmsg } };
  } else if (type === 'document' && wmsg.hasMedia) {
    message = { documentMessage: { url: 'wwebjs://media', mimetype: (wmsg.media && wmsg.media.mimetype) || 'application/octet-stream', fileName: (wmsg.media && wmsg.media.filename) || 'file', caption: body || undefined, _be_raw: wmsg } };
  } else if (type === 'location') {
    const lat = Number(wmsg.location?.latitude || 0);
    const lng = Number(wmsg.location?.longitude || 0);
    message = { locationMessage: { degreesLatitude: lat, degreesLongitude: lng } };
  } else if (type === 'poll') {
    const name = wmsg.poll?.name || wmsg.pollName || body;
    const opts = ((wmsg.poll && wmsg.poll.options) || []).map(o => ({ optionName: o.name || o }));
    message = { pollCreationMessage: { name, options: opts || [], selectableOptionsCount: opts.length } };
  } else {
    /* Prépare extendedTextMessage si mentions, sinon conversation */
    message = (mentioned.length || type === 'chat' && body)
      ? { extendedTextMessage: { text: body, contextInfo: { mentionedJid: mentioned } } }
      : { conversation: body };
  }

  /* Message vue-unique (👁️ view once) : wwebjs le rapporte comme image/vidéo/audio
     avec isViewOnce=true. On l'enveloppe en viewOnceMessage comme Baileys pour que
     sms() l'unwrap correctement, que le cache __recentViewOnce soit alimenté et que
     .vv puisse récupérer le média. */
  if (wmsg.isViewOnce && message) {
    message = { viewOnceMessage: { message } };
  }

  /* Quoted message (contextInfo.quotedMessage) */
  if (wmsg.hasQuotedMsg && wmsg._quotedLoaded) {
    const q = wmsg._quotedLoaded;
    const qBody = q.body || '';
    let qMsg = { conversation: qBody };
    if (q.type === 'image') qMsg = { imageMessage: { url: 'wwebjs://media', mimetype: (q.media && q.media.mimetype) || 'image/jpeg', _be_raw: q } };
    else if (q.type === 'video') qMsg = { videoMessage: { url: 'wwebjs://media', mimetype: (q.media && q.media.mimetype) || 'video/mp4', _be_raw: q } };
    else if (q.type === 'sticker') qMsg = { stickerMessage: { url: 'wwebjs://media', mimetype: 'image/webp', _be_raw: q } };
    else if (q.type === 'audio') qMsg = { audioMessage: { url: 'wwebjs://media', mimetype: 'audio/mpeg', _be_raw: q } };
    else if (q.type === 'document') qMsg = { documentMessage: { url: 'wwebjs://media', mimetype: (q.media && q.media.mimetype) || 'application/octet-stream', fileName: (q.media && q.media.filename) || 'file', _be_raw: q } };
    /* Citation vue-unique → wrapper viewOnceMessage (comme Baileys) */
    if (q.isViewOnce) qMsg = { viewOnceMessage: { message: qMsg } };
    const qCtx = { stanzaId: q.id?.id, participant: q.author ? widToJid(q.author) : (q.from ? widToJid(q.from) : undefined) };
    /* Le contextInfo doit porter sur le message effectif (le inner si viewOnce) */
    let quoteTarget = qMsg;
    if (qMsg.viewOnceMessage && qMsg.viewOnceMessage.message) quoteTarget = qMsg.viewOnceMessage.message;
    const inner = Object.keys(quoteTarget)[0];
    quoteTarget[inner].contextInfo = Object.keys(quoteTarget[inner]).length ? { participant: qCtx.participant } : { participant: qCtx.participant, stanzaId: qCtx.stanzaId };
    message[Object.keys(message)[0]].contextInfo = Object.assign(
      message[Object.keys(message)[0]].contextInfo || {},
      { participant: qCtx.participant, stanzaId: qCtx.stanzaId, quotedMessage: qMsg },
      mentioned.length ? { mentionedJid: mentioned } : {}
    );
  }

  const appMsg = {
    key,
    message,
    messageTimestamp: Math.trunc((wmsg.timestamp || Date.now() / 1000)),
    pushName: wmsg._contactName || undefined,
    _wwebjs: true,
    _raw: wmsg,
  };
  return appMsg;
}

/* Registre des derniers messages envoyés (instances Message wwebjs) —
   l'édition (edit) peut ainsi travailler en mémoire sans re-fetch fragile. */
function rememberSent(sentMsg) {
  try {
    if (!sentMsg || typeof sentMsg !== 'object') return;
    const sid = sentMsg.id?._serialized || sentMsg.id?.id;
    if (!sid) return;
    const reg = global.__wwebjsSent || (global.__wwebjsSent = new Map());
    reg.set(sid, sentMsg);
    if (reg.size > 250) {
      const now = Date.now();
      for (const [k, v] of reg) {
        if (reg.size <= 120) break;
        if (!v || !v.timestamp || now - v.timestamp * 1000 > 15 * 60 * 1000) reg.delete(k);
      }
    }
  } catch {}
}

function buildWwebjsSocket(opts = {}) {
  const ev = new EventEmitter();
  let client = null;
  let started = false;

  const sessionDir = opts.sessionDir || process.env.WWEBJS_SESSION_DIR || path.join(__dirname, '..', '..', 'session-wwebjs');

  const sock = {
    ev,
    _engine: 'wwebjs',
    _clientRef: () => client,
    user: null,

    /* nearly all plugins rely on conn.user.id split(':')[0] */
    async start() {
      if (started && client) return client;
      started = true;
      sock.__authLoggedOnce = false;

      const buildClient = () => {
        const chromePath = findChrome();
        const isRender = !!process.env.RENDER || !!process.env.RENDER_EXTERNAL_URL;
        const c = new Client({
          authStrategy: new LocalAuth({ dataPath: sessionDir }),
          puppeteer: {
            headless: isRender ? 'new' : (process.env.WWEBJS_HEADLESS !== 'false' ? 'new' : false),
            executablePath: chromePath || undefined,
            protocolTimeout: 300000,
            timeout: 300000,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-gpu',
              '--no-zygote',
              '--disable-dev-shm-usage',
              '--disable-background-timer-throttling',
              '--disable-backgrounding-occluded-windows',
              '--disable-renderer-backgrounding',
              '--disable-features=TranslateUI',
              '--disable-ipc-flooding-protection'
            ],
            defaultViewport: null,
            ignoreHTTPSErrors: true,
          },
          takeoverOnConflict: true,
          webVersionCache: {
            type: 'local',
            path: require('path').join(__dirname, '..', '..', 'data', '.wwebjs_cache'),
          },
        });
        return c;
      };

      const attachHandlers = (c) => {
        /* Watchdog de stabilité — frame Puppeteer détachée (reload de page
           WhatsApp) → auto-réparation : reload de la page, puis réinitialisation
           complète du Client si besoin. Cooldown 3 min, max 4 essais/heure. */
        const recoveryState = { inProgress: false, lastRecovery: 0, count: 0 };
        const pageAlive = async () => {
          try { if (!c.pupPage) return false; await c.pupPage.evaluate(() => true); return true; }
          catch { return false; }
        };
        const tryRecover = async (cause) => {
          if (recoveryState.inProgress) return;
          const now = Date.now();
          if (now - recoveryState.lastRecovery < 180000) return;
          if (recoveryState.count >= 4) {
            ev.emit('connection.update', { connection: 'close', lastDisconnect: { error: new Error('Zones de récupération épuisées (frame détachée)') } });
            return;
          }
          recoveryState.inProgress = true;
          recoveryState.lastRecovery = now;
          recoveryState.count++;
          const t0 = Date.now();
          console.log(`🔄 [WWEBJS] Récupération page (${cause}) — essai ${recoveryState.count}/4`);
          try {
            if (c.pupPage) { try { await c.pupPage.reload(); } catch {} }
            for (let w = 0; w < 8; w++) {
              await new Promise(r => setTimeout(r, 2000));
              if (await pageAlive()) break;
            }
            if (!(await pageAlive())) throw new Error('reload inefficace');
            global.__wwebjsGetChatsWarned = false;
            console.log(`✅ [WWEBJS] Page récupérée en ${((Date.now() - t0) / 1000).toFixed(1)}s`);
            /* Re-injecter les Store hooks (Msg.on('add') etc.) perdus après reload */
            try {
              await c.pupPage.evaluate(() => {
                const { Msg, Chat } = window.require('WAWebCollections');
                const AppState = window.require('WAWebSocketModel').Socket;
                if (typeof window.onAddMessageEvent !== 'function') return;
                /* Re-hook Msg.on('add') — idempotent: chaque hook est un NOUVEAU listener
                   sur la nouvelle instance de Store après reload */
                Msg.on('add', (msg) => {
                  if (!msg.isNewMsg) return;
                  if (msg.type !== 'ciphertext') {
                    window.onAddMessageEvent(window.WWebJS.getMessageModel(msg));
                    return;
                  }
                  window.onAddMessageCiphertextEvent(window.WWebJS.getMessageModel(msg));
                });
                Msg.on('change', (msg) => { window.onChangeMessageEvent(window.WWebJS.getMessageModel(msg)); });
                Msg.on('change:type', (msg) => { window.onChangeMessageTypeEvent(window.WWebJS.getMessageModel(msg)); });
                Msg.on('remove', (msg) => { if (msg.isNewMsg) window.onRemoveMessageEvent(window.WWebJS.getMessageModel(msg)); });
                console.log('✅ [WWEBJS] Store hooks ré-injectés après récupération');
              }).catch((e) => console.log('⚠️ [WWEBJS] Store re-inject failed:', e?.message));
            } catch {}
          } catch {
            console.log(`⚠️ [WWEBJS] Reload insuffisant — réinitialisation du Client…`);
            try { if (client) await client.destroy(); } catch {}
            /* Tuer les processus Chrome orphelins qui gardent le profil verrouillé */
            try {
              const { execSync } = require('child_process');
              execSync('taskkill /F /IM chrome.exe /T 2>NUL', { timeout: 8000, stdio: 'ignore' });
              await new Promise(r => setTimeout(r, 3000));
            } catch {}
            try { await client.initialize(); } catch (ie) {
              console.error('❌ [WWEBJS] re-init échoué:', ie.message);
              ev.emit('connection.update', { connection: 'close', lastDisconnect: { error: ie } });
            }
          } finally {
            recoveryState.inProgress = false;
          }
        };
        const frameDetached = async (reason) => { try { await tryRecover('frame détachée: ' + reason); } catch {} };

        c.on('frame_created', (frame) => {
          try { frame.on('detached', frameDetached); } catch {}
        });

        /* ═══ FIX CRITIQUE : onAppStateHasSynced jamais déclenché ═══
           Sur les builds WA récents, le sync peut être déjà fait quand
           wwebjs attache son listener → le bloc LoadUtils + ready ne
           s'exécute jamais. On force le ready manuellement depuis Node
           quand le socket est CONNECTED et que WWebJS manque. */
        const { LoadUtils } = require('whatsapp-web.js/src/util/Injected/Utils');
        const forceReadyIfStuck = async () => {
          try {
            if (!c.pupPage || !(await pageAlive())) return;
            const wwebjsOk = await c.pupPage.evaluate('typeof window.WWebJS !== "undefined"').catch(() => false);
            if (wwebjsOk) return; // déjà prêt
            const sockState = await c.pupPage.evaluate(
              "(() => { try { return window.require('WAWebSocketModel').Socket.state; } catch { return 'UNKNOWN'; } })()"
            ).catch(() => 'UNKNOWN');
            if (sockState !== 'CONNECTED') return;
            // Socket connecté mais WWebJS absent → on force l'injection
            console.log('🔧 [WWEBJS] Socket CONNECTED sans WWebJS → injection force...');
            if (typeof LoadUtils === 'function') {
              await c.pupPage.evaluate(LoadUtils).catch((e) => console.log('⚠️ [WWEBJS] LoadUtils error:', e?.message));
            }
            // Vérifier si ça a marché
            const ok = await c.pupPage.evaluate('typeof window.WWebJS !== "undefined"').catch(() => false);
            if (!ok) { console.log('⚠️ [WWEBJS] LoadUtils a échoué'); return; }
            // Récupérer les infos utilisateur
            const me = await c.pupPage.evaluate(`(() => {
              try {
                const wid = window.require('WAWebUserPrefsMeUser').getMaybeMePnUser() || window.require('WAWebUserPrefsMeUser').getMaybeMeLidUser();
                const conn = window.require('WAWebConnModel').Conn;
                return { id: wid._serialized, name: conn.me || conn.phone || '' };
              } catch(e) { return null; }
            })()`).catch(() => null);
            if (!me) { console.log('⚠️ [WWEBJS] user info unavailable'); return; }
            // CRITIQUE: attacher les listeners de messages AVANT le ready
            // exposeFunctionIfAbsent est idempotent (skip si déjà exposé)
            try { await c.attachEventListeners(); console.log('✅ [WWEBJS] Event listeners attachés'); } catch (aelErr) { console.log('⚠️ [WWEBJS] attachEventListeners:', aelErr?.message); }
            // Forcer le ready
            if (!sock.user) {
              sock.user = { id: me.id, name: me.name || me.id.split('@')[0] };
              global.__sessionOwnerNumber = me.id.split('@')[0];
              console.log('✅ [WWEBJS] Prêt (force ready) — user:', me.id.split('@')[0]);
              ev.emit('connection.update', { connection: 'open' });
            }
          } catch (e) { console.log('⚠️ [WWEBJS] forceReady error:', e.message); }
        };
        const forceReadyTimer = setInterval(forceReadyIfStuck, 8000);
        setTimeout(() => { try { clearInterval(forceReadyTimer); } catch {} }, 300000);
        c.on('qr', (qr) => {
          console.log('📱 [WWEBJS] QR code reçu, longueur:', qr?.length || 0);
          try {
            require('fs').writeFileSync(path.join(sessionDir || __dirname, 'qr-last.txt'), String(qr || ''));
            const QR = require('qrcode');
            QR.toFile(path.join(sessionDir || __dirname, 'qr-last.png'), String(qr || ''), { width: 260 }).catch(() => {});
          } catch (e) { console.log('⚠️ [WWEBJS] qr persist failed:', e.message); }
          ev.emit('connection.update', { connection: 'connecting', qr, isNewLogin: true });
        });
        c.on('authenticated', () => {
          if (!sock.__authLoggedOnce) {
            sock.__authLoggedOnce = true;
            console.log('✅ [WWEBJS] Authentifié');
          }
          ev.emit('connection.update', { connection: 'connecting', qr: null });
        });
        c.on('ready', async () => {
          try {
            const me = c.info.custom || c.info;
            const meNum = (me?.wid?._serialized || me?.me?._serialized || '').split('@')[0] || '0';
            sock.user = { id: meNum + ':0@s.whatsapp.net', name: (me?.name || me?.pushname || '') };
            global.__sessionOwnerNumber = meNum;
          } catch {}
          ev.emit('connection.update', { connection: 'open' });

          /* Heartbeat pour éviter les déconnexions 408 (ping WhatsApp toutes les 30s) */
          if (sock._heartbeat) clearInterval(sock._heartbeat);
          sock._heartbeat = setInterval(async () => {
            try {
              if (c && c.pupPage) {
                await c.pupPage.evaluate(() => {
                  if (window.Store && window.Store.Conn && window.Store.Conn.sendKeepAlive) {
                    window.Store.Conn.sendKeepAlive();
                  }
                }).catch(() => {});
              }
            } catch {}
          }, 30000);

          /* Watchdog de stabilité : sonde la frame Puppeteer ; si elle est
             détachée (reload interne de WhatsApp Web), auto-réparation. */
          if (sock._watchdog) clearInterval(sock._watchdog);
          sock._watchdog = setInterval(async () => {
            try {
              if (!c.pupPage || recoveryState.inProgress) return;
              await c.pupPage.evaluate(() => true);
            } catch (wgErr) {
              const wmsg = String(wgErr?.message || wgErr);
              if (/detached Frame|Execution context was destroyed|frame was detached|Target closed/i.test(wmsg)) {
                await tryRecover(wmsg);
              }
            }
          }, 45000);
        });
        c.on('auth_failure', (msg) => {
          ev.emit('connection.update', { connection: 'close', lastDisconnect: { error: new Error(String(msg)) } });
        });
        c.on('disconnected', (reason) => {
          if (sock._heartbeat) { clearInterval(sock._heartbeat); sock._heartbeat = null; }
          ev.emit('connection.update', { connection: 'close', lastDisconnect: { error: new Error(reason || 'disconnected') } });
        });

        /* Événements groupe (welcome/goodbye/warn) */
        c.on('group_join', (notification) => {
          try {
            const id = widToJid(notification.chatId) || widToJid(notification.id?.remote) || '';
            const participants = (notification.recipientIds || []).map(widToJid);
            if (id && participants.length) ev.emit('group-participants.update', { id, participants, action: 'add' });
          } catch {}
        });
        c.on('group_leave', (notification) => {
          try {
            const id = widToJid(notification.chatId) || widToJid(notification.id?.remote) || '';
            const participants = (notification.recipientIds || []).map(widToJid);
            if (id && participants.length) ev.emit('group-participants.update', { id, participants, action: 'remove' });
          } catch {}
        });

        c.on('message_create', async (wmsg) => {
          try {
            /* Résoudre le VRAI jid du chat (LID → groupe/DM réel) via l'API */
            try {
              const chat = await wmsg.getChat().catch(() => null);
              if (chat && chat.id?._serialized) wmsg.remote = chat.id._serialized;
            } catch {}
            /* Charger le contact pour pushName */
            try {
              const cnt = await wmsg.getContact().catch(() => null);
              if (cnt) wmsg._contactName = cnt.name || cnt.pushname || cnt.number;
            } catch {}
            try {
              if (wmsg.hasQuotedMsg) {
                wmsg._quotedLoaded = await wmsg.getQuotedMessage().catch(() => null);
              }
            } catch {}
            const appMsg = translateMessage(c, wmsg);
            const isStatus = wmsg.remote === 'status@broadcast' || (appMsg.key.remoteJid === 'status@broadcast');
            const payload = { messages: [appMsg], type: isStatus ? 'status' : 'notify' };
            ev.emit('messages.upsert', payload);
          } catch (e) {
            console.error('❌ wwebjs translate:', e.message);
          }
        });
      };

      const maxInitRetries = 5;
      for (let attempt = 1; attempt <= maxInitRetries; attempt++) {
        try {
          client = buildClient();
          sock._client = client;
          attachHandlers(client);
          await client.initialize();
          return client;
        } catch (initErr) {
          const msg = String(initErr?.message || initErr);
          /* Fermer proprement le navigateur AVANT retry pour libérer le profil */
          try { if (client) await client.destroy(); } catch {}
          client = null;
          if (attempt < maxInitRetries && /ERR_NAME_NOT_RESOLVED|Execution context was destroyed|net::|ECONNRESET|Target closed|Navigation failed|timed out|TimeoutError|Runtime\.callFunctionOn|already running|EBUSY|ERR_SSL|SOCKET|auth timeout|AuthTimeout|QRCodeParse/i.test(msg)) {
            const wait = 8000 * attempt;
            console.log(`⚠️ wwebjs init échec (${attempt}/${maxInitRetries}): ${msg.split('\n')[0]} — retry dans ${Math.round(wait / 1000)}s`);
            await new Promise(r => setTimeout(r, wait));
            continue;
          }
          started = false;
          throw initErr;
        }
      }
      return client;
    },

    /* sendMessage Baileys-compatible */
    async sendMessage(jid, content, options = {}) {
      if (!client) throw new Error('Engine non initialisé');
      const wid = jidToWid(jid);
      const quoted = options.quoted?.key || null;

      /* Health probe : si pupPage.evaluate() bloque, la page est morte → on
         tente une récupération avant de jeter. Évite les timeouts de 20s
         inutiles quand le contexte CDP est déjà mort. */
      try {
        await Promise.race([
          client.pupPage.evaluate(() => 1 + 1),
          new Promise((_, rej) => setTimeout(() => rej(new Error('page probe timeout')), 5000))
        ]);
      } catch (probeErr) {
        console.log('⚠️ [WWEBJS] Page health probe échoué:', probeErr?.message);
        /* Tenter une récupération silencieuse (reload de page) */
        try {
          await client.pupPage.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
          await new Promise(r => setTimeout(r, 3000));
          console.log('✅ [WWEBJS] Page rechargée après probe échoué');
        } catch {
          throw new Error('Page WhatsApp morte — envoi impossible');
        }
      }

      /* Timeout de sécurité : si pupPage.evaluate() bloque (page crashée),
         on libère après 20s au lieu de laisser le handler bloqué 45s. */
      const sendWithTimeout = (promise, ms = 15000) => Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`sendMessage timeout (${ms}ms)`)), ms))
      ]);

      if (content && content.react) {
        const text = content.react.text;
        const key = content.react.key || quoted;
        if (key) {
          await client.sendMessage(wid, { reaction: { message_id: key.id, text }, ...(key.participant || key.remoteJid ? { user: key.participant ? jidToWid(key.participant) : undefined } : {}) });
        } else {
          await client.sendMessage(wid, { reaction: { text } });
        }
        return { key: { remoteJid: jid, id: Date.now().toString() + '_react' } };
      }

      /* Suppression de message { delete: key } */
      if (content && content.delete) {
        const dkey = content.delete;
        const forEveryone = content.delete.forEveryone !== false;
        try {
          const target = await client.getMessageById(dkey.id).catch(() => null);
          if (target) {
            await target.delete(forEveryone, true);
            return { key: { remoteJid: jid, id: dkey.id } };
          }
        } catch {}
        /* Fallback: récupérer dans le chat */
        try {
          const chat = await client.getChatById(wid).catch(() => null);
          if (chat && typeof chat.fetchMessages === 'function') {
            const msgs = await chat.fetchMessages({ limit: 50 });
            const t = msgs.find(x => x.id?.id === dkey.id || x.id?._serialized === dkey.id);
            if (t) await t.delete(forEveryone, true);
          }
        } catch {}
        return { key: { remoteJid: jid, id: dkey.id } };
      }

      /* Transfert (forward) { forward: key } */
      if (content && content.forward) {
        const fkey = content.forward;
        try {
          const target = await client.getMessageById(fkey.id).catch(() => null);
          if (target && typeof target.forward === 'function') {
            await target.forward(wid);
            return { key: { remoteJid: jid, id: fkey.id } };
          }
        } catch {}
        throw new Error('Impossible de transférer ce message');
      }

      /* Épingler/désépingler { pin: { type, key } } */
      if (content && content.pin) {
        const p = content.pin;
        try {
          const target = await client.getMessageById(p.key?.id).catch(() => null);
          if (target) {
            if (String(p.type).startsWith('unpin')) await target.unpin();
            else await target.pin(86400);
            return { key: { remoteJid: jid, id: p.key?.id } };
          }
        } catch {}
        throw new Error('Impossible d\'épingler ce message');
      }

      /* Contact(s) { contacts: { displayName, contacts: [{ vcard }] } } */
      if (content && content.contacts) {
        const displayName = content.contacts.displayName || 'Contact';
        const vcards = (content.contacts.contacts || []);
        if (!vcards.length) throw new Error('Contact vide');
        const vcard = vcards[0].vcard || '';
        try {
          const { Contact } = require('whatsapp-web.js');
          const num = String(vcard.match(/waid=(\d+)/)?.[1] || vcard.match(/TEL.*:(\+?\d+)/)?.[1] || '');
          if (num) {
            const cid = num.includes('@') ? num : (num.startsWith('+') ? num.slice(1) + '@c.us' : num + '@c.us');
            await client.sendMessage(wid, new Contact({ id: { _serialized: cid, server: 'c.us', user: num }, name: displayName }));
            return { key: { remoteJid: jid, id: Date.now().toString() + '_vcard' } };
          }
          /* Fallback: envoyer la vcard comme document */
          const media = new MessageMedia('text/x-vcard', Buffer.from(vcard).toString('base64'), displayName + '.vcf');
          await client.sendMessage(wid, media, { sendMediaAsDocument: true });
          return { key: { remoteJid: jid, id: Date.now().toString() + '_vcard' } };
        } catch (e) {
          const media = new MessageMedia('text/x-vcard', Buffer.from(vcard).toString('base64'), displayName + '.vcf');
          await client.sendMessage(wid, media, { sendMediaAsDocument: true });
          return { key: { remoteJid: jid, id: Date.now().toString() + '_vcard' } };
        }
      }

      if (content && (content.image || content.video || content.audio || content.sticker || content.document)) {
        let media;
        const toBuf = (v) => (Buffer.isBuffer(v) ? v : v?.url ? Buffer.from('') : v);
        const getMedia = (v, mime, name) => {
          if (Buffer.isBuffer(v)) return new MessageMedia(mime, v.toString('base64'), name || 'media');
          if (typeof v === 'string') return MessageMedia.fromUrl(v);
          if (v && typeof v.url === 'string') return MessageMedia.fromUrl(v.url);
          return null;
        };
        if (content.image) media = getMedia(content.image, content.mimetype || 'image/jpeg', content.imageName || 'image.jpg');
        else if (content.video) media = getMedia(content.video, content.mimetype || 'video/mp4', content.videoName || 'video.mp4');
        else if (content.audio) media = getMedia(content.audio, content.mimetype || 'audio/mpeg', 'audio.mp3');
        else if (content.sticker) media = getMedia(content.sticker, 'image/webp', 'sticker.webp');
        else if (content.document) media = getMedia(content.document, content.mimetype || 'application/pdf', content.fileName || 'document.pdf');
        if (!media) throw new Error('Média non supporté');
        const sendOpts = {
          caption: content.caption || content.fileName || undefined,
          sendMediaAsSticker: !!(content.sticker),
          sendMediaAsDocument: !!(content.document),
          sendAudioAsVoice: !!(content.ptt),
          isViewOnce: !!content.viewOnce,
        };
        if (content.document && !content.sendMediaAsDocument && !content.sendMediaAsSticker) sendOpts.sendMediaAsDocument = true;
        if (quoted) { sendOpts.quotedMessageId = quoted.id; sendOpts.mentionQuoted = false; }
        const mentionList = content.contextInfo?.mentionedJid || content.mentions || [];
        if (Array.isArray(mentionList) && mentionList.length) sendOpts.mentions = mentionList.map(j => jidToWid(j));
        /* Publication de statut ({ statusJidList: [...] } en options) → status@broadcast */
        const isStatusRoute = jid === 'status@broadcast' || jid.endsWith('status@broadcast') || (Array.isArray(options.statusJidList) && options.statusJidList.length);
        if (options.isStatus || isStatusRoute) {
          sendOpts.sendMediaAsStatus = true;
          sendOpts.caption = content.caption || '';
        }
        const targetWid = isStatusRoute ? 'status@broadcast' : wid;
        const sentMsg = await sendWithTimeout(client.sendMessage(targetWid, media, sendOpts));
        rememberSent(sentMsg);
        const mid = sentMsg?.id?._serialized || (sentMsg?.id?.id ? `${jid}:${sentMsg.id.id}` : Date.now().toString() + '_media');
        return { key: { remoteJid: jid, id: mid } };
      }

      /* Édition de message { text, edit: key } — .ping, .fix, downloaders (YT/IG/FB/...)
         edit = clé du message à remplacer (même structure que key) */
      if (content && content.edit) {
        const ed = content.edit;
        const text = String(content.text ?? '');
        const editById = async (id) => {
          /* 1) Dans le registre mémoire des messages envoyés (fiable, zéro re-fetch) */
          const reg = global.__wwebjsSent;
          const cached = reg && reg.get(id);
          if (cached && typeof cached.edit === 'function') {
            try { await cached.edit(text); } catch (e) { console.log('⚠️ [WWEBJS] edit (mémoire) failed:', e.message); }
            return true;
          }
          /* 2) Re-fetch via l'API */
          const msg = await client.getMessageById(id).catch(() => null);
          if (msg && typeof msg.edit === 'function') {
            try { await msg.edit(text); } catch (e) { console.log('⚠️ [WWEBJS] edit by id failed:', e.message); }
            return true;
          }
          return false;
        };
        let done = false;
        if (ed.id) done = await editById(ed.id);
        if (!done) {
          try {
            const chat = await client.getChatById(wid).catch(() => null);
            if (chat && typeof chat.fetchMessages === 'function') {
              const found = await chat.fetchMessages({ limit: 50 });
              const t = found.find(x => x.id?.id === ed.id || x.id?._serialized === ed.id);
              if (t && typeof t.edit === 'function') { await t.edit(text).catch(() => {}); done = true; }
            }
          } catch {}
        }
        if (!done) throw new Error('Message à éditer introuvable');
        return { key: { remoteJid: ed.remoteJid || jid, id: ed.id || Date.now().toString() } };
      }

      if (content && typeof content.text === 'string') {
        const opt = {};
        if (quoted) {
          opt.quotedMessageId = quoted.id;
          opt.mentionQuoted = false;
        }
        const isStatusRoute = jid === 'status@broadcast' || jid.endsWith('status@broadcast') || (Array.isArray(options.statusJidList) && options.statusJidList.length);
        const statusWid = isStatusRoute ? 'status@broadcast' : wid;
        let sentMsg;
        if (content.contextInfo?.mentionedJid?.length || (content.mentions && content.mentions.length)) {
          const mentions = (content.contextInfo?.mentionedJid || content.mentions || []).map(j => jidToWid(j));
          sentMsg = await sendWithTimeout(client.sendMessage(statusWid, content.text, { mentions, ...(quoted ? { quotedMessageId: quoted.id } : {}) }));
        } else {
          sentMsg = await sendWithTimeout(client.sendMessage(statusWid, content.text, opt));
        }
        rememberSent(sentMsg);
        const sid = sentMsg?.id?._serialized || (sentMsg?.id?.id ? `${jid}:${sentMsg.id.id}` : Date.now().toString() + '_txt');
        return { key: { remoteJid: jid, id: sid } };
      }

      if (content && (content.location || content.poll || content.buttons || content.list)) {
        if (content.location) {
          await client.sendMessage(wid, new Location(content.location.degreesLatitude, content.location.degreesLongitude, content.location.address || undefined));
        } else if (content.poll) {
          const opts = (content.poll.options || content.poll.values || []).map(o => (typeof o === 'string' ? o : o.optionName)).filter(Boolean);
          const sel = Math.max(0, Math.min(Math.min(opts.length, 12), content.poll.selectableCount || 1));
          await client.sendMessage(wid, new Poll(content.poll.name || 'Sondage', opts.slice(0, 12), sel > 0 ? sel : opts.length));
        } else if (content.buttons) {
          const { Buttons } = require('whatsapp-web.js');
          const btns = (content.buttons.buttons || content.buttons).slice(0, 3).map((b, i) => new Buttons.Button(i, b.text || b.displayText || 'OK'));
          await client.sendMessage(wid, new Buttons(content.buttons.headerText || undefined, content.buttons.bodyText || content.text || '', content.buttons.footerText || undefined, btns));
        } else if (content.list) {
          const { List } = require('whatsapp-web.js');
          const secs = (content.list.sections || []).map(s => ({ title: s.title || '', rows: (s.rows || []).map(r => ({ title: r.title || '', rowId: r.id || '', description: r.description }) ) }));
          await client.sendMessage(wid, new List(content.list.title || 'Liste', content.list.buttonText || 'Voir', content.list.description || content.list.footerText || '', secs));
        }
        return { key: { remoteJid: jid, id: Date.now().toString() + '_xtra' } };
      }

      throw new Error('Contenu non supporté par le moteur wwebjs');
    },

    async readMessages(keys = []) {
      if (!client || !keys.length) return;
      try {
        for (const k of keys) {
          const wid = jidToWid(k.remoteJid);
          const chat = await client.getChatById(wid).catch(() => null);
          if (chat && typeof chat.sendSeen === 'function') await chat.sendSeen();
        }
      } catch {}
    },

    async sendPresenceUpdate(status, jid) {
      if (!client) return;
      try {
        await client.sendPresenceUpdate(status === 'composing' ? 'available' : 'available');
        if (jid) {
          const wid = jidToWid(jid);
          const chat = await client.getChatById(wid).catch(() => null);
          if (chat) {
            if (status === 'composing') await chat.sendStateTyping().catch(() => {});
            else await chat.clearState().catch(() => {});
          }
        }
      } catch {}
    },

    requestPairingCode: async () => { throw new Error('whatsapp-web.js: appairage par code non supporté (QR uniquement)'); },
    getContacts: async () => {
      if (!client) return [];
      try {
        const contacts = await client.getContacts();
        return (contacts || []).map(c => ({
          id: c.id?._serialized ? widToJid(c.id._serialized) : c.id,
          name: c.name || c.pushname || c.shortName || '',
          number: c.number || '',
          isMe: c.isMe || false,
          isGroup: c.isGroup || false,
        }));
      } catch { return []; }
    },
    userOf: () => sock.user,

    async groupMetadata(jid) {
      if (!client) return null;
      const wid = jidToWid(jid);
      const chat = await client.getChatById(wid).catch(() => null);
      if (!chat) throw new Error('Groupe introuvable');
      return {
        id: jid,
        subject: chat.name || '',
        desc: chat.description || '',
        participants: (chat.participants || []).map(p => ({
          id: widToJid(p.id._serialized),
          admin: p.isAdmin ? 'admin' : (p.isSuperAdmin ? 'superadmin' : undefined),
        })),
        owner: chat.groupMetadata?.owner ? widToJid(chat.groupMetadata.owner._serialized) : undefined,
        size: (chat.participants || []).length,
        restrict: !!chat.groupMetadata?.restrict,
        announce: !!chat.groupMetadata?.announce,
        creation: chat.groupMetadata?.creation,
        _chat: chat,
      };
    },
    async groupParticipantsUpdate(jid, participants, action) {
      if (!client || !participants?.length) return [];
      const wid = jidToWid(jid);
      const chat = await client.getChatById(wid).catch(() => null);
      if (!chat) throw new Error('Groupe introuvable');
      const ids = participants.map(p => jidToWid(p));
      if (action === 'add' || action === 'promote' || action === 'demote' || action === 'remove') {
        if (action === 'promote') await chat.promoteParticipants(ids);
        else if (action === 'demote') await chat.demoteParticipants(ids);
        else if (action === 'remove') await chat.removeParticipants(ids);
        else await chat.addParticipants(ids);
      }
      return ids.map(p => ({ jid: widToJid(p), status: '200' }));
    },
    async groupSettingUpdate(jid, setting) {
      if (!client) return;
      const wid = jidToWid(jid);
      const chat = await client.getChatById(wid).catch(() => null);
      if (!chat) return;
      if (setting === 'announcement') await chat.setMessagesAdminsOnly(true);
      else if (setting === 'not_announcement') await chat.setMessagesAdminsOnly(false);
      else if (setting === 'locked') await chat.setInfoAdminsOnly(true);
      else if (setting === 'unlocked') await chat.setInfoAdminsOnly(false);
    },
    async groupSettingsUpdate(jid) {
      if (!client) return {};
      const chat = await client.getChatById(jidToWid(jid)).catch(() => null);
      if (!chat) return {};
      return {
        announce: !!chat.groupMetadata?.announce,
        restrict: !!chat.groupMetadata?.restrict,
        ephemeral: !!chat.groupMetadata?.ephemeralDuration || 0,
        _chat: chat,
      };
    },
    async groupUpdateSubject(jid, subject) {
      if (!client) return;
      const chat = await client.getChatById(jidToWid(jid)).catch(() => null);
      if (chat) await chat.setSubject(String(subject));
    },
    async groupUpdateDescription(jid, desc) {
      if (!client) return;
      const chat = await client.getChatById(jidToWid(jid)).catch(() => null);
      if (chat) await chat.setDescription(String(desc || ''));
    },
    async groupLeave(jid) {
      if (!client) return;
      const chat = await client.getChatById(jidToWid(jid)).catch(() => null);
      if (chat && typeof chat.leave === 'function') await chat.leave();
    },
    async groupFetchAllParticipating() {
      if (!client) return {};
      /* Chemin rapide : API wwebjs standard (échoue si version web incompatible avec
         les helpers WWebJS.getChatModel → on retombe sur la lecture brute du Store). */
      try {
        const chats = await client.getChats();
        const outF = {};
        for (const c of chats) {
          const rawId = c.id?._serialized || c.id?.remote || '';
          if (!/g\.us$/.test(rawId)) continue;
          const jid = rawId.includes('@') ? rawId : `${rawId}@g.us`;
          outF[jid] = {
            id: jid,
            subject: String(c.name || c.title || jid.split('@')[0]).slice(0, 200),
            desc: c.description || '',
            participants: (c.participants || []).map(p => ({
              id: p.id?._serialized || p.id?.remote || p.id || '',
              admin: p.isAdmin ? 'admin' : (p.isSuperAdmin ? 'superadmin' : undefined),
            })),
          };
        }
        console.log(`👥 [WWEBJS] getChats=${chats.length} groupes=${Object.keys(outF).length}`);
        if (Object.keys(outF).length) return outF;
      } catch (e) {
        /* Erreur connue (WWebJS.getChatModel absent sur la version web) → le fallback
           Store ci-dessous couvre le cas. On ne log qu'une fois par session pour
           éviter de noyer les logs dans la synchro CRM. */
        if (!global.__wwebjsGetChatsWarned) {
          global.__wwebjsGetChatsWarned = true;
          console.log('⚠️ [WWEBJS] getChats standard:', e?.stack?.split('\n')[0] || e?.message, '(fallback Store actif)');
        }
      }

      /* Lecture brute du Store dans la page : évite WWebJS.getChatModel (qui casse
         sur les groupes si GroupMetadata est absent de la version web). */
      try {
        const groups = await client.pupPage.evaluate(() => {
          const load = (name) => { try { return window.require(name); } catch { return undefined; } };
          let coll = load('WAWebCollections')?.Chat;
          if (!coll) coll = window.Store?.Chat;
          if (!coll) return [];
          const models = typeof coll.getModelsArray === 'function' ? coll.getModelsArray() : [];
          const out = [];
          for (const m of (models || [])) {
            const id = m.id?._serialized || m.id?.remote || '';
            if (!/g\.us$/.test(id)) continue;
            const gm = m.groupMetadata || {};
            out.push({
              id,
              subject: String(m.name || m.formattedTitle || m.subject || id.split('@')[0]).slice(0, 200),
              desc: m.description || gm.desc || '',
              participants: (gm.participants || []).map(p => ({
                id: p.id?._serialized || p.id?.remote || p.id || '',
                admin: p.isAdmin ? 'admin' : (p.isSuperAdmin ? 'superadmin' : undefined),
              })),
            });
          }
          return out;
        });
        const outG = {};
        for (const g of (groups || [])) if (g.id) outG[g.id] = g;
        console.log(`👥 [WWEBJS] fallback Store: ${Object.keys(outG).length} groupes`);
        return outG;
      } catch (e) {
        console.log('⚠️ [WWEBJS] fallback Store:', e?.stack?.split('\n')[0] || e?.message);
        return {};
      }
    },
    async profilePictureUrl(jid, type) {
      if (!client) return '';
      try {
        const wid = jidToWid(jid);
        const url = await client.getProfilePicUrl(wid).catch(() => '');
        return url || '';
      } catch { return ''; }
    },
    async updateProfilePicture(jid, buffer) {
      if (!client || !Buffer.isBuffer(buffer)) return;
      const contact = await client.getContactById(jidToWid(jid)).catch(() => null);
      if (contact && typeof contact.setProfilePicture === 'function') {
        const media = new MessageMedia('image/jpeg', buffer.toString('base64'), 'pp.jpg');
        await contact.setProfilePicture(media);
      }
    },
    async removeProfilePicture(jid) {
      if (!client) return;
      const contact = await client.getContactById(jidToWid(jid)).catch(() => null);
      if (contact && typeof contact.removeProfilePicture === 'function') await contact.removeProfilePicture();
    },
    async loadMessages(jid, limit = 25, minDate) {
      if (!client) return [];
      try {
        const wid = jidToWid(jid);
        const chat = await client.getChatById(wid).catch(() => null);
        if (!chat || typeof chat.fetchMessages !== 'function') return [];
        const msgs = await chat.fetchMessages({ limit: Number(limit) || 25 });
        return msgs.map(m => translateMessage(client, m));
      } catch { return []; }
    },
    async loadMessage(jid, id) {
      if (!client) return undefined;
      try {
        const msg = await client.getMessageById(id).catch(() => null);
        return msg ? translateMessage(client, msg) : undefined;
      } catch { return undefined; }
    },
    async onWhatsApp(jid) {
      if (!client) return [];
      try {
        const wid = jidToWid(jid);
        const id = await client.getNumberId(wid).catch(() => null);
        return id ? [{ jid: widToJid(id._serialized), exists: true }] : [];
      } catch { return []; }
    },
    async groupCreate(subject, participants = []) {
      if (!client) return null;
      const ids = (participants || []).map(p => jidToWid(p));
      const chat = await client.createGroup(String(subject || 'Nouveau groupe'), ids);
      return { id: widToJid(chat.id._serialized), subject: chat.name || subject, participants: ids };
    },
    async groupAcceptInvite(inviteCode) {
      if (!client) throw new Error('Engine non initialisé');
      const chatId = await client.acceptInvite(String(inviteCode));
      return { id: widToJid(chatId), result: 'joined' };
    },
    async chatModify(mutation, jid, condition) {
      if (!client || !jid) return;
      const wid = jidToWid(jid);
      const chat = await client.getChatById(wid).catch(() => null);
      if (!chat) return;
      try {
        const m = mutation || {};
        if (m.archive === true) await client.archiveChat(wid).catch(() => chat.archive ? chat.archive() : null);
        else if (m.archive === false) await client.unarchiveChat(wid).catch(() => chat.unarchive ? chat.unarchive() : null);
        if (typeof m.pin === 'number') await chat.pin(m.pin).catch(() => {});
        else if (m.pin === false) await chat.unpin().catch(() => {});
        if (m.mute != null) {
          if (m.mute) await client.muteChat(wid, typeof m.mute === 'number' ? new Date(Date.now() + m.mute) : undefined).catch(() => {});
          else await client.unmuteChat(wid).catch(() => {});
        }
        if (m.star != null && chat.messages) {
          const target = chat.messages?._models?.[0];
          if (target) { if (m.star) await target.star().catch(() => {}); else await target.unstar().catch(() => {}); }
        }
      } catch {}
    },
    chats: {
      all: async () => {
        if (!client) return [];
        return client.getChats();
      },
    },
    async downloadMediaMessage(m, filename) {
      if (!m) return null;
      try {
        const { downloadMediaMessage: dm } = require('../../lib/wwebjs-msg.cjs');
        return await dm(m, filename);
      } catch { return null; }
    },
    async updateBlockStatus(jid, status) {
      if (!client) return;
      try {
        const contact = await client.getContactById(jidToWid(jid)).catch(() => null);
        if (!contact) return;
        if (status === 'block') await contact.block();
        else await contact.unblock();
      } catch {}
    },

    /* ── Extensions compatibilité Baileys (plugins biz/label/catalogue/...) ── */

    async getLabels() {
      if (!client) return [];
      try { return await client.getLabels(); } catch { return []; }
    },

    async getBusinessProfile(jid) {
      if (!client) return null;
      try {
        const contact = await client.getContactById(jidToWid(jid)).catch(() => null);
        if (!contact) return null;
        const name = contact.name || contact.number || '';
        const about = await contact.getAbout().catch(() => '');
        const pic = await contact.getProfilePicUrl().catch(() => '');
        return { name, description: about || undefined, website: undefined, address: undefined, email: undefined, categories: undefined, imgUrl: pic };
      } catch { return null; }
    },

    async getProductCatalog(jid) {
      if (!client) return [];
      try {
        const products = await client.pupPage.evaluate(() => {
          const cat = window.Store && window.Store.Product;
          return [];
        }).catch(() => []);
        return products;
      } catch { return []; }
    },

    async addProduct() {
      throw new Error('Ajout de produit non supporté par le moteur whatsapp-web.js');
    },

    async requestPayment() {
      throw new Error('Paiements non supportés par le moteur whatsapp-web.js');
    },

    async groupToggleEphemeral(jid, duration) {
      if (!client) return;
      const wid = jidToWid(jid);
      try {
        await client.pupPage.evaluate(async (wid, duration) => {
          const { Cmd } = window.require('WAWebCmd');
          const chat = await window.WWebJS.getChat(wid, { getAsModel: false });
          if (!chat) return;
          if (window.WWebJS.compareWwebVersions(window.Debug.VERSION, '>=', '2.3000.0')) {
            await Cmd.sendSetDisappearingMessages(chat, { duration });
          } else {
            await Cmd.sendSetDisappearingMessages(chat, duration);
          }
        }, wid, Number(duration) || 0);
      } catch (e) {
        console.log('⚠️ groupToggleEphemeral wwebjs:', e.message);
      }
    },

    async groupInviteCode(jid) {
      if (!client) return null;
      const chat = await client.getChatById(jidToWid(jid)).catch(() => null);
      if (!chat || typeof chat.getInviteCode !== 'function') return null;
      try { return await chat.getInviteCode(); } catch { return null; }
    },

    async groupRevokeInvite(jid) {
      if (!client) return;
      const chat = await client.getChatById(jidToWid(jid)).catch(() => null);
      if (chat && typeof chat.revokeInvite === 'function') await chat.revokeInvite();
    },
    async groupRevokeInviteCode(jid) {
      if (!client) return;
      const chat = await client.getChatById(jidToWid(jid)).catch(() => null);
      if (chat && typeof chat.revokeInvite === 'function') await chat.revokeInvite();
    },

    async newsletterFollow(invite) {
      if (!client) throw new Error('Chaînes non supportées par le moteur whatsapp-web.js');
      try { await client.subscribeToChannel(String(invite)); } catch (e) { throw new Error('Échec suivi de chaîne: ' + e.message); }
    },

    async newsletterUnfollow(jid) {
      if (!client) throw new Error('Chaînes non supportées par le moteur whatsapp-web.js');
      try { await client.unsubscribeFromChannel(String(jid)); } catch (e) { throw new Error('Échec retrait de chaîne: ' + e.message); }
    },

    async newsletterSubscriptions() {
      if (!client) return [];
      try {
        const channels = await client.getChannels();
        return (channels || []).map(c => ({ id: c.id?._serialized || c.id || '', name: c.name || c.title || '', _ch: c }));
      } catch { return []; }
    },

    async relayMessage(jid, content) {
      if (!client) return;
      const text = content?.extendedTextMessage?.text || content?.conversation || '';
      const mentions = (content?.extendedTextMessage?.contextInfo?.mentionedJid || []).map(j => jidToWid(j));
      if (mentions.length) await client.sendMessage(jidToWid(jid), String(text), { mentions });
      else await client.sendMessage(jidToWid(jid), String(text));
    },

    async query() {
      throw new Error('Requête protocole (2FA…) non supportée par le moteur whatsapp-web.js');
    },
    async sendPresenceUpdate(presence) {
      if (!client) return;
      try {
        const p = String(presence || 'available');
        if (p === 'available') await client.sendPresenceAvailable();
        else if (p === 'unavailable') await client.sendPresenceUnavailable();
        else if (p === 'composing') await client.sendPresenceComposing();
        else if (p === 'recording') await client.sendPresenceRecording();
        else if (p === 'paused') await client.sendPresencePaused();
        else await client.sendPresenceAvailable();
      } catch {}
    },
    async readMessages(jids) {
      if (!client || !Array.isArray(jids) || !jids.length) return;
      for (const jid of jids) { try { await client.sendSeen(jidToWid(jid)); } catch {} }
    },
    async getBlockList() {
      if (!client) return [];
      try { return await client.getBlockedContacts(); } catch { return []; }
    },
    async updateProfileStatus(status) {
      if (!client) return;
      try { await client.setStatus(String(status)); } catch {}
    },
    async fetchStatus(jid) {
      if (!client) return {};
      try {
        const contact = await client.getContactById(jidToWid(jid)).catch(() => null);
        if (contact && typeof contact.getAbout === 'function') {
          const about = await contact.getAbout().catch(() => '');
          return { status: about || '' };
        }
      } catch {}
      return {};
    },
    async removeDevice() {
      throw new Error('Suppression d\'appareil non supportée par le moteur whatsapp-web.js');
    },
    async rejectCall() {
      throw new Error('Gestion d\'appels non supportée par le moteur whatsapp-web.js');
    },
    async groupRequestParticipantsList() {
      return [];
    },
    async groupRequestParticipantsUpdate() {
      return [];
    },

    async logout() {
      if (client) { try { await client.logout(); } catch {} }
    },
    async end(error) {
      if (sock._heartbeat) { clearInterval(sock._heartbeat); sock._heartbeat = null; }
      if (client) { try { await client.destroy(); } catch {} }
      started = false;
    },
    authState: { creds: {}, keys: {} },
    store: {
      loadMessages: async (jid, limit) => sock.loadMessages(jid, limit),
    },
    get lid() {
      return sock.user?.id || null;
    },
  };

  return sock;
}

module.exports = { buildWwebjsSocket, widToJid, jidToWid };