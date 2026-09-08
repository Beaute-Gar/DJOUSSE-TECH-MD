// src/services/account-pipeline.cjs
// Pipeline COMPLET par compte WhatsApp secondaire — même logique que le handler
// principal d'index.cjs, mais paramétré par socket (chaque compte = son bot).
const { sms } = require('../../lib/msg.cjs');
const { buildContext } = require('../core/command-context.cjs');
const config = require('../../config-djousse.cjs');
const { commands } = require('../../command.cjs');
const botSettings = require('../../lib/settings.cjs');
const moderationManager = require('./auto-moderation.cjs');
const crossGroupBridge = require('./cross-group-bridge.cjs');
const { gererClicBouton } = require('../menu-interactif.cjs');
const { handleMenuClick } = require('../menu-professionnel.cjs');

const PRIORITY_NAMES = ['ping', 'alive', 'menu', 'help', 'time', 'date', 'jid', 'system', 'restart', 'testall'];
const withTimeout = (promise, ms) => Promise.race([
  promise,
  new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout (' + ms + 'ms)')), ms)),
]);
const PLUGIN_TIMEOUT = parseInt(process.env.DB_TIMEOUT || '45000', 10);
const DL_TIMEOUT = parseInt(process.env.DL_TIMEOUT || '300000', 10);
const PRIORITY_TIMEOUT = parseInt(process.env.MESSAGE_TIMEOUT || '10000', 10);

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
    sock.sendMessage(m.chat, { text: `📊 SYSTEM\n🕐 Uptime: ${h}h ${mi}m ${s}s\n💾 RAM: ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB\n✅ En ligne` });
  },
  restart: async (sock, m, commands, ctx, onEvent) => {
    if (ctx.isOwner) {
      await sock.sendMessage(m.chat, { text: '🔄 Reconnexion de ce compte...' });
      if (typeof onEvent === 'function') onEvent('restart-request');
    } else {
      await sock.sendMessage(m.chat, { text: '⛔ Accès refusé' });
    }
  },
};

/** Attache le pipeline complet à un socket de compte.
 *  opts: { ownerNumber (numéro du compte), onEvent (événements internes) }
 */
function attachAccountPipeline(sock, opts = {}) {
  const ownerNumber = String(opts.ownerNumber || '').replace(/[^0-9]/g, '');
  const onEvent = opts.onEvent || (() => {});
  const prefix = config.PREFIX || '.';
  let __messagesToday = 0;
  const undecryptable = { count: 0, start: 0 };

  const isOwnerSender = (sender) => {
    if (!sender) return false;
    const num = String(sender).split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
    return ownerNumber && ownerNumber.includes(num);
  };

  const buildCmdCtx = (m) => {
    const parts = m.body.slice(prefix.length).trim().split(' ');
    const rest = parts.slice(1).join(' ');
    const base = {
      ...config,
      q: rest,
      from: m.chat,
      args: parts.slice(1),
      reply: (text) => m.reply(text),
      quoted: m.quoted,
      isOwner: isOwnerSender(m.sender) || isOwnerSender(m.altSender),
      client: sock,
      commands,
    };
    return { ...base, ctx: buildContext(sock, m, commands, base) };
  };

  const findCmds = (name) => {
    const n = String(name || '').toLowerCase();
    return commands.filter(c => {
      if (!c.pattern) return false;
      const p = typeof c.pattern === 'string' ? c.pattern.toLowerCase() : '';
      const aliases = Array.isArray(c.alias) ? c.alias.map(a => String(a).toLowerCase()) : [];
      const regexHit = c.pattern instanceof RegExp && n.match(c.pattern);
      return p === n || aliases.includes(n) || regexHit;
    });
  };

  const runCommand = async (cmdName, argsText, m, effectiveMode, timeoutMs) => {
    const matches = findCmds(cmdName);
    if (matches.length === 0) return false;
    const m2 = (argsText ? { ...m, body: prefix + cmdName + ' ' + String(argsText).trim() } : m);
    if (effectiveMode === 'private' && !isOwnerSender(m.sender) && !isOwnerSender(m.altSender) && !matches.some(c => c.fromMe)) {
      await m.reply('🔒 Mode privé — réservé au propriétaire du compte.').catch(() => {});
      return true;
    }
    if (matches.every(c => c.fromMe) && !isOwnerSender(m.sender) && !isOwnerSender(m.altSender)) {
      await m.reply('👑 Commande réservée au propriétaire du compte.').catch(() => {});
      return true;
    }
    let lastErr = null;
    const isDownload = matches.some(c => String(c.category || '').toLowerCase() === 'download');
    const ttl = timeoutMs || (isDownload ? DL_TIMEOUT : PLUGIN_TIMEOUT);
    for (const cmd of matches) {
      try {
        await withTimeout(cmd.function(sock, m2, commands, buildCmdCtx(m2)), ttl);
        const be = global.__behaviorEngine;
        if (be && config.MODE === 'public') await be.attendreAvantReponse().catch(() => {});
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        console.error('❌ erreur .' + cmdName + ' (' + (cmd.filename || '?') + '):', e.message);
      }
    }
    if (lastErr) {
      try { await m.reply('❌ Erreur: ' + lastErr.message); } catch {}
    }
    return true;
  };

  const autoDetectHandler = async (m) => {
    if (m.fromMe) return;
    const text = String(m.body || '').trim();
    if (!text) return;
    const { detect } = require('../../lib/auto-detect.cjs');
    const res = detect(text);
    if (!res) return;
    if (res.kind === 'link') {
      await m.reply('⏳ ' + config.BOT_NAME + ' — téléchargement automatique…').catch(() => {});
      await runCommand(res.cmd, res.arg, m, 'public', DL_TIMEOUT);
      return;
    }
    if (res.kind === 'bang') {
      await runCommand(res.cmd, res.arg, m, 'public');
      return;
    }
    if (res.kind === 'stats') {
      let groups = 0, members = 0;
      try {
        const raw = await sock.groupFetchAllParticipating().catch(() => ({}));
        groups = Object.keys(raw || {}).length;
        for (const g of Object.values(raw || {})) members += g.participants?.length || 0;
      } catch {}
      const up = Math.floor(process.uptime());
      const h = Math.floor(up / 3600), mi = Math.floor((up % 3600) / 60), s = Math.floor(up % 60);
      await m.reply(`📊 *STATISTIQUES*\n✅ Uptime: ${h}h ${mi}m ${s}s\n💬 Messages aujourd'hui: ${__messagesToday}\n👥 Groupes: ${groups}\n🧑 Membres: ${members}\n💾 RAM: ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`).catch(() => {});
    }
  };

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const be = global.__behaviorEngine;
    for (const msg of messages) {
      try {
        if (!msg.message) {
          const jid = msg.key?.remoteJid || '';
          if (msg.key?.fromMe === false && msg.messageStubType === undefined && !jid.startsWith('status@')) {
            const now = Date.now();
            if (!undecryptable.start) undecryptable.start = now;
            undecryptable.count++;
            if (now - undecryptable.start > 60000) { undecryptable.start = now; undecryptable.count = 1; }
            if (undecryptable.count >= 8) {
              console.log('🔑 Session compte illisible — nouvel appairage requis');
              undecryptable.count = 0;
              onEvent('session-broken');
            }
          }
          continue;
        }
        const m = sms(sock, msg);
        m.altSender = msg.key?.participantAlt || msg.key?.remoteJidAlt || '';
          try {
            if (await handleMenuClick(sock, msg)) continue;
            if (await gererClicBouton(sock, msg, config)) continue;
          } catch (e) {
            console.error('❌ Menu interactif compte:', e.message);
          }
        const isOwner = isOwnerSender(m.sender) || isOwnerSender(m.altSender);
        const isCmd = m.body && m.body.startsWith(prefix);

        if (m.type === 'protocolMessage') continue;
        if (m.chat === 'status@broadcast') {
          if (config.AUTO_STATUS_SEEN && be) be.voirStatuts([msg]);
          else if (config.AUTO_STATUS_SEEN) await sock.readMessages([msg.key]).catch(() => {});
          continue;
        }

        if (botSettings.get('autoread') && m.chat !== 'status@broadcast') {
          try { await sock.readMessages([msg.key]); } catch {}
        }
        /* Auto-react / auto-typing / réactions contextuelles — DÉSACTIVÉS (mode silencieux, anti-spam) */
        if (false && botSettings.get('autoreact') && m.fromMe === false && m.chat !== 'status@broadcast' && !isCmd) {
          const reacts = ['👍', '❤️', '😊', '🔥', '👏'];
          try { await sock.sendMessage(m.chat, { react: { text: reacts[Math.floor(Math.random() * reacts.length)], key: msg.key } }); } catch {}
        }
        if (false && botSettings.get('autotyping') && m.fromMe === false && !isCmd) {
          try { await sock.sendPresenceUpdate('composing', m.chat); } catch {}
        }
        if (false && be && m.chat.endsWith('@g.us') && !isCmd) {
          be.reagirSiPertinent(msg);
        }

        __messagesToday++;

        if (m.fromMe === false) {
          try {
            const bridged = await crossGroupBridge.detectAndRespond(sock, m, msg);
            if (bridged) continue;
          } catch (e) { console.error('❌ Bridge:', e.message); }
        }

        /* Modération auto — DÉSACTIVÉE (mode silencieux, anti-ban) */
        if (false && !isCmd && m.fromMe === false) {
          try {
            const modRes = await moderationManager.inspect(sock, m, msg);
            if (modRes && modRes.length > 0) continue;
          } catch (e) { console.error('❌ Modération:', e.message); }
        }

        /* Auto-détection: liens sociaux → téléchargement, « !cmd » → jeu/émotion/logo/stats.
             RÉSERVÉ À L'OWNER (mode silencieux : aucun membre ne déclenche). */
        if (!isCmd && isOwner) {
          await autoDetectHandler(m);
          continue;
        }

        if (!isCmd) continue;

        const cmdName = m.body.slice(prefix.length).trim().split(' ')[0].toLowerCase();
        if (be) be.simuleTyping(m.chat, m.body).catch(() => {});
        const effectiveMode = botSettings.get('mode') || process.env.MODE || config.MODE || 'public';

        if (PRIORITY_NAMES.includes(cmdName)) {
          const plugin = commands.find(c => {
            if (!c.pattern) return false;
            const p = typeof c.pattern === 'string' ? c.pattern.toLowerCase() : '';
            const aliases = Array.isArray(c.alias) ? c.alias.map(a => String(a).toLowerCase()) : [];
            const regexHit = c.pattern instanceof RegExp && cmdName.match(c.pattern);
            return p === cmdName || aliases.includes(cmdName) || regexHit;
          });
          const fn = (plugin?.function) || PRIORITY_FALLBACK[cmdName];
          if (!fn) continue;
          if (cmdName === 'restart' && !isOwner) {
            await m.reply('👑 Commande réservée au propriétaire du compte.').catch(() => {});
            continue;
          }
          try {
            if (cmdName === 'restart') {
              await fn(sock, m, commands, buildCmdCtx(m), onEvent);
            } else {
              await withTimeout(fn(sock, m, commands, buildCmdCtx(m)), PRIORITY_TIMEOUT);
            }
          } catch (e) {
            console.error('❌ Prioritaire error .' + cmdName + ':', e.message);
            try { await m.reply('❌ Erreur: ' + e.message); } catch {}
          }
          continue;
        }

        const done = await runCommand(cmdName, '', m, effectiveMode);
        if (!done) {
          try { await m.reply('❌ Commande introuvable: .' + cmdName); } catch {}
        }
      } catch (msgError) {
        console.error('❌ Erreur traitement message (compte):', msgError.message);
      }
    }
  });

  return { isOwnerSender, runCommand };
}

module.exports = { attachAccountPipeline };