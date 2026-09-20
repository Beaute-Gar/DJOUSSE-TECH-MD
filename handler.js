/**
 * Message Handler - DJOUSSE TECH MD
 * Basé sur KnightBot-Mini, adapté par Beaute Gar
 * CORRIGÉ : sock is not defined dans isOwner()
 */

const config = require('./config');
const database = require('./database');
const { loadCommands } = require('./utils/commandLoader');
const { addMessage } = require('./utils/groupstats');
const { tryAutoLevelUp, formatLevelUpMessage } = require('./utils/economy');
const { jidDecode, jidEncode } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const bus = require('./src/core/eventBus');
const sessionManager = require('./src/sessions/sessionManager');
const antiBan = require('./lib/anti-ban.cjs');
const viewOnceSaver = require('./lib/view-once.cjs');
const antiFlood = require('./lib/anti-flood.cjs');
const { safeSend } = require('./lib/safesend.cjs');
const presence = require('./lib/presence.cjs');
const warmup = require('./lib/warmup.cjs');
const aiLimits = require('./lib/ai-limits.cjs');
const security = require('./lib/security.cjs');
const silentAutomations = require('./lib/silent-automations.cjs');
const { pmGate } = require('./commands/pmguard');
const { premiumGate } = require('./commands/premium');
const reactionAutomations = require('./lib/reaction-automations.cjs');
const { isButtonResponse, handleButtonClick } = require('./commands/lib/buttons/buttonHandler');
const { handlePendingInput } = require('./commands/lib/buttons/inputHandler');
const { handleNumberInput } = require('./commands/lib/buttons/numberHandler');
const { autoReact } = require('./utils/autoReact');

const commands = loadCommands();

const groupMetadataCache = new Map();
const CACHE_TTL = 60000;

const getMessageContent = (msg) => {
  if (!msg || !msg.message) return null;
  let m = msg.message;
  if (m.ephemeralMessage) m = m.ephemeralMessage.message;
  if (m.viewOnceMessageV2) m = m.viewOnceMessageV2.message;
  if (m.viewOnceMessage) m = m.viewOnceMessage.message;
  if (m.documentWithCaptionMessage) m = m.documentWithCaptionMessage.message;
  return m;
};

const getCachedGroupMetadata = async (sock, groupId) => {
  try {
    if (!groupId || !groupId.endsWith('@g.us')) return null;
    const cached = groupMetadataCache.get(groupId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;
    const metadata = await sock.groupMetadata(groupId);
    groupMetadataCache.set(groupId, { data: metadata, timestamp: Date.now() });
    return metadata;
  } catch (error) {
    if (error.message && (error.message.includes('forbidden') || error.message.includes('403'))) {
      groupMetadataCache.set(groupId, { data: null, timestamp: Date.now() });
      return null;
    }
    const cached = groupMetadataCache.get(groupId);
    return cached ? cached.data : null;
  }
};

const getLiveGroupMetadata = async (sock, groupId) => {
  try {
    const metadata = await sock.groupMetadata(groupId);
    groupMetadataCache.set(groupId, { data: metadata, timestamp: Date.now() });
    return metadata;
  } catch (error) {
    const cached = groupMetadataCache.get(groupId);
    return cached ? cached.data : null;
  }
};

const getGroupMetadata = getCachedGroupMetadata;

const normalizeJid = (jid) => {
  if (!jid || typeof jid !== 'string') return '';
  if (jid.includes(':')) return jid.split(':')[0];
  if (jid.includes('@')) return jid.split('@')[0];
  return jid;
};

const normalizeJidWithLid = (jid) => {
  if (!jid || typeof jid !== 'string') return '';
  try {
    const decoded = jidDecode(jid);
    if (!decoded?.user) return `${jid.split(':')[0].split('@')[0]}@s.whatsapp.net`;
    let user = decoded.user;
    let server = decoded.server === 'c.us' ? 's.whatsapp.net' : decoded.server;
    if (server === 'lid' || server === 'hosted.lid') server = 's.whatsapp.net';
    return jidEncode(user, server);
  } catch (e) {
    return jid;
  }
};

const buildComparableIds = (jid) => {
  if (!jid) return [];
  try {
    const decoded = jidDecode(jid);
    if (!decoded?.user) return [normalizeJidWithLid(jid)].filter(Boolean);
    const variants = new Set();
    const server = decoded.server === 'c.us' ? 's.whatsapp.net' : decoded.server;
    variants.add(jidEncode(decoded.user, server));
    return Array.from(variants);
  } catch (e) {
    return [jid];
  }
};

const findParticipant = (participants = [], userIds) => {
  const targets = (Array.isArray(userIds) ? userIds : [userIds]).filter(Boolean).flatMap(id => buildComparableIds(id));
  if (!targets.length) return null;
  return participants.find(p => {
    if (!p) return false;
    const ids = [p.id, p.lid, p.userJid].filter(Boolean).flatMap(id => buildComparableIds(id));
    return ids.some(id => targets.includes(id));
  }) || null;
};

// ✅ CORRIGÉ : sock est maintenant un paramètre explicite
const isOwner = (sock, sender) => {
  if (!sender || typeof sender !== 'string') return false;
  const senderNumber = normalizeJid(sender);

  // Check against owner numbers
  if (config.ownerNumber.some(owner => {
    if (!owner || typeof owner !== 'string') return false;
    const ownerNumber = normalizeJid(owner);
    return ownerNumber === senderNumber;
  })) return true;

  // Check if sender is the bot itself (LID or JID)
  if (sock && sock.user) {
    const botId = normalizeJid(sock.user.id);
    const botLid = sock.user.lid ? normalizeJid(sock.user.lid) : null;
    const senderNorm = normalizeJid(sender);
    if (senderNorm === botId) return true;
    if (botLid && senderNorm === botLid) return true;
    if (sender === sock.user.id) return true;
    if (botLid && sender === botLid) return true;
  }
  return false;
};

const isMod = (sender) => {
  if (!sender || typeof sender !== 'string') return false;
  const number = sender.split('@')[0];
  return database.isModerator(number);
};

const isAdmin = async (sock, participant, groupId, groupMetadata = null) => {
  if (!participant) return false;
  if (!groupId || !groupId.endsWith('@g.us')) return false;
  let liveMetadata = groupMetadata;
  if (!liveMetadata || !liveMetadata.participants) {
    liveMetadata = await getLiveGroupMetadata(sock, groupId);
  }
  if (!liveMetadata || !liveMetadata.participants) return false;
  const foundParticipant = findParticipant(liveMetadata.participants, participant);
  if (foundParticipant) {
    return foundParticipant.admin === 'admin' || foundParticipant.admin === 'superadmin';
  }
  // Fallback: check if participant matches owner number
  const participantNumber = normalizeJid(participant);
  if (config.ownerNumber.some(owner => normalizeJid(owner) === participantNumber)) return true;
  return false;
};

const isBotAdmin = async (sock, groupId, groupMetadata = null) => {
  if (!sock.user || !groupId) return false;
  if (!groupId.endsWith('@g.us')) return false;
  try {
    const botId = sock.user.id;
    const botLid = sock.user.lid;
    const botJids = [botId];
    if (botLid) botJids.push(botLid);
    const liveMetadata = await getLiveGroupMetadata(sock, groupId);
    if (!liveMetadata || !liveMetadata.participants) return false;
    const participant = findParticipant(liveMetadata.participants, botJids);
    if (participant) {
      return participant.admin === 'admin' || participant.admin === 'superadmin';
    }
    // Fallback: owner is always considered admin
    return true;
  } catch (error) {
    return false;
  }
};

const isSystemJid = (jid) => {
  if (!jid) return true;
  return jid.includes('@broadcast') || jid.includes('status.broadcast') || jid.includes('@newsletter') || jid.includes('@newsletter.');
};

const isBotJid = (jid, sock) => {
  if (!jid || !sock?.user) return false;
  const botRefs = [sock.user.id, sock.user.lid].filter(Boolean);
  const targetVariants = buildComparableIds(jid);
  return botRefs.some(botRef => buildComparableIds(botRef).some(botVariant => targetVariants.includes(botVariant)));
};

const handleMessage = async (sock, msg) => {
  try {
    if (!msg.message) return;
    const from = msg.key.remoteJid;

    // Security: validate JID
    if (!from || !from.includes('@')) return;

    // ═══ DEBUG: confirmer réception ═══
    const isGroupMsg = from.endsWith('@g.us');
    if (isGroupMsg && !msg.key.fromMe) {
      const dbgBody = (() => {
        const c = getMessageContent(msg);
        if (!c) return '(no content)';
        return c.conversation || c.extendedTextMessage?.text || c.imageMessage?.caption || c.videoMessage?.caption || '(media)';
      })();
      console.log(`[GROUP-RECV] 📩 ${from} → "${dbgBody}"`);
    }

    // Silent automation: auto-read (blue ticks, delayed)
    try { silentAutomations.autoRead(msg); } catch (_) {}

    // Auto view-once interception
    try { viewOnceSaver.interceptViewOnce(sock, msg); } catch (_) {}

    // Status@broadcast is handled by autoreact.cjs plugin listener — skip here
    if (from === 'status@broadcast') return;

    if (isSystemJid(from)) return;

    const content = getMessageContent(msg);
    let actualMessageTypes = [];
    if (content) {
      const protocolMessages = ['protocolMessage', 'senderKeyDistributionMessage', 'messageContextInfo'];
      actualMessageTypes = Object.keys(content).filter(key => !protocolMessages.includes(key));
    }

    const sender = msg.key.fromMe
      ? (sock.user?.id ? sock.user.id : '')
      : (msg.key.participant || msg.key.remoteJid || '');
    const isGroup = from.endsWith('@g.us');
    const groupMetadata = isGroup ? await getGroupMetadata(sock, from) : null;

    // ✅ Cache LID → PN
    try {
      const lidResolver = require('./utils/lid-resolver');
      const senderRaw = msg.key.participant || msg.key.remoteJid;
      if (senderRaw && sock.user?.id) {
        lidResolver.cacheLid(senderRaw, sock.user.id);
      }
      const ctxInfo = content?.extendedTextMessage?.contextInfo
        || content?.imageMessage?.contextInfo
        || content?.videoMessage?.contextInfo;
      if (ctxInfo?.participant && ctxInfo?.remoteJid) {
        lidResolver.cacheLid(ctxInfo.participant, ctxInfo.remoteJid);
      }
      if (isGroup && groupMetadata?.participants) {
        for (const p of groupMetadata.participants) {
          if (p.id && p.lid) {
            lidResolver.cacheLid(p.lid, p.id);
          }
        }
      }
    } catch (e) {}

    // Anti-flood in groups
    if (isGroup && !msg.key.fromMe) {
      const floodResult = antiFlood.trackMessage(from, sender);
      if (floodResult.action === 'muted') {
        console.log(`[ANTI-FLOOD] 🔇 Muet: ${sender.split('@')[0]} dans ${from}`);
        return;
      }
      if (floodResult.action === 'warned') {
        antiBan.queueMessage(async () => {
          await presence.simulateTyping(from);
          return sock.sendMessage(from, {
            text: `⚠️ *Anti-Flood*\n@${sender.split('@')[0]} ralentis !\nAvertissement ${floodResult.warns}/${floodResult.max}`,
            mentions: [sender]
          });
        }).catch(() => {});
        return;
      }
    }

    // Auto-réaction pour TOUS les messages (privés + groupes)
    autoReact(sock, msg).catch(() => {});

    // Auto-react messages groupes (with 10min/user cooldown)
    try {
      if (!msg.key.fromMe && isGroup) {
        const groupSettings = database.getGroupSettings(from);
        if (groupSettings.autoreact) {
          reactionAutomations.autoReactMessage(msg);
        }
      }
    } catch (e) {}

    let body = '';
    if (content) {
      if (content.conversation) body = content.conversation;
      else if (content.extendedTextMessage) body = content.extendedTextMessage.text || '';
      else if (content.imageMessage) body = content.imageMessage.caption || '';
      else if (content.videoMessage) body = content.videoMessage.caption || '';
    }
    body = (body || '').trim();

    // Anti-all
    if (isGroup) {
      const groupSettings = database.getGroupSettings(from);
      if (groupSettings.antiall) {
        const senderIsAdmin = await isAdmin(sock, sender, from, groupMetadata);
        const senderIsOwner = isOwner(sock, sender); // ✅ CORRIGÉ
        if (!senderIsAdmin && !senderIsOwner) {
          const botIsAdminCheck = await isBotAdmin(sock, from, groupMetadata);
          if (botIsAdminCheck) {
            await sock.sendMessage(from, { delete: msg.key }).catch(() => {});
            return;
          }
        }
      }
    }

    // Group stats
    if (isGroup) {
      addMessage(from, sender, { sticker: !!(content?.stickerMessage) });
      try {
        const levelResult = tryAutoLevelUp(from, sender);
        if (levelResult.leveled) {
          antiBan.queueMessage(async () => {
            await presence.simulateTyping(from);
            return sock.sendMessage(from, {
              text: formatLevelUpMessage(levelResult.before, levelResult.after, levelResult.role, levelResult.diamondsEarned),
              mentions: [sender]
            }, { quoted: msg });
          }).catch(() => {});
        }
      } catch (e) {}
    }

    if (!content || actualMessageTypes.length === 0) return;

    // Auto-sticker
    if (isGroup) {
      const groupSettings = database.getGroupSettings(from);
      if (groupSettings.autosticker) {
        const mediaMessage = content?.imageMessage || content?.videoMessage;
        if (mediaMessage && !body.startsWith(config.prefix)) {
          try {
            const stickerCmd = commands.get('sticker');
            if (stickerCmd) {
              await stickerCmd.execute(sock, msg, [], {
                from, sender, isGroup, groupMetadata,
                isOwner: isOwner(sock, sender), // ✅ CORRIGÉ
                isAdmin: await isAdmin(sock, sender, from, groupMetadata),
                isBotAdmin: await isBotAdmin(sock, from, groupMetadata),
                isMod: isMod(sender),
                reply: (text) => sock.sendMessage(from, { text }, { quoted: msg }),
                react: (emoji) => sock.sendMessage(from, { react: { text: emoji, key: msg.key } }).catch(() => {})
              });
              return;
            }
          } catch (e) {}
        }
      }
    }

    // AFK
    if (!msg.key.fromMe) {
      const afk = require('./utils/afk');
      if (afk.isEnabled() && !isOwner(sock, sender)) { // ✅ CORRIGÉ
        let shouldHandleAfk = false;
        if (!isGroup) {
          shouldHandleAfk = true;
        } else {
          const ctx = content.extendedTextMessage?.contextInfo;
          const mentionedJids = ctx?.mentionedJid || [];
          const isMentioned = mentionedJids.some(jid => isBotJid(jid, sock));
          const isReplyToBot = ctx?.participant && isBotJid(ctx.participant, sock);
          shouldHandleAfk = (isMentioned || isReplyToBot) && !body.startsWith(config.prefix);
        }
        if (shouldHandleAfk) {
          if (afk.shouldNotify(from, sender)) {
            afk.markNotified(from, sender);
            await sock.sendMessage(from, { text: afk.getMessage() }, { quoted: msg }).catch(() => {});
          }
          return;
        }
      }
    }

    // Chatbot
    if (!msg.key.fromMe && isGroup) {
      const groupSettings = database.getGroupSettings(from);
      if (groupSettings.chatbot) {
        const ctx = content.extendedTextMessage?.contextInfo;
        const mentionedJids = ctx?.mentionedJid || [];
        const isMentioned = mentionedJids.some(jid => isBotJid(jid, sock));
        const isReplyToBot = ctx?.participant && isBotJid(ctx.participant, sock);
        if ((isMentioned || isReplyToBot) && !body.startsWith(config.prefix)) {
          try {
            const chatbotCmd = commands.get('ai');
            if (chatbotCmd) {
              await chatbotCmd.execute(sock, msg, [body], {
                from, sender, isGroup, groupMetadata,
                isOwner: isOwner(sock, sender), // ✅ CORRIGÉ
                isAdmin: await isAdmin(sock, sender, from, groupMetadata),
                isBotAdmin: await isBotAdmin(sock, from, groupMetadata),
                isMod: isMod(sender),
                reply: (text) => sock.sendMessage(from, { text }, { quoted: msg }),
                react: (emoji) => sock.sendMessage(from, { react: { text: emoji, key: msg.key } }).catch(() => {})
              });
            }
          } catch (e) {}
          return;
        }
      }
    }

    // 🎮 Interception des jeux AVANT le check du préfixe
    if (body && !msg.key.fromMe) {
      try {
        const games = require('./commands/plugins/games.cjs');
        const handled = await games.handleRawReply(sock, {
          ...msg,
          sender,
          chat: from,
          body,
          isGroup,
          botNumber: sock.user?.id || '',
          reply: (text, mentions) => sock.sendMessage(from, { text, mentions }, { quoted: msg }).catch(() => {}),
          react: (emoji) => sock.sendMessage(from, { react: { text: emoji, key: msg.key } }).catch(() => {}),
        });
        if (handled) return;
      } catch (e) {
        // Jeu non actif, on continue
      }
    }

    // Gestion des clics de boutons (AVANT le check préfixe)
    if (isButtonResponse(msg)) {
      await handleButtonClick(sock, msg);
      return;
    }

    // Gestion des saisies en attente (menu interactif hybride)
    if (await handlePendingInput(sock, msg)) {
      return;
    }

    // Interception des numéros pour les menus actifs
    if (await handleNumberInput(sock, msg)) {
      return;
    }

    // Check prefix
    if (!body.startsWith(config.prefix)) return;

    // ═══ DEBUG LOG GROUPES ═══
    if (isGroup) {
      console.log(`[GROUP-CMD] 💬 ${commandName || '(vide)'} ← sender=${sender.split('@')[0]} from=${from}`);
    }

    // Security: inject command rate limit check
    const rateCheck = security.checkRateLimit(sender);
    if (!rateCheck.allowed) {
      return antiBan.queueMessage(async () => {
        await presence.simulateTyping(from);
        return sock.sendMessage(from, { text: `Trop de commandes. Attends ${Math.ceil(rateCheck.retryAfter / 1000)}s.` }, { quoted: msg });
      });
    }

    // Security: detect injection attempts
    const injectionCheck = security.detectInjection(body);
    if (injectionCheck.detected) {
      console.log(`[SECURITY] 🚨 Injection détectée de ${sender}: ${injectionCheck.pattern}`);
      return;
    }

    // Security: sanitize input
    const sanitizedBody = security.sanitizeInput(body);

    // PMGuard: protection discussions privées (avant exécution des commandes)
    if (!(await pmGate(sock, msg, isOwner(sock, sender)))) return;

    // Premium: vérification accès premium (avant exécution des commandes)
    if (!(await premiumGate(sock, msg, isOwner(sock, sender)))) return;

    const args = sanitizedBody.slice(config.prefix.length).trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();
    const command = commands.get(commandName);
    if (!command) {
      if (isGroup) console.log(`[GROUP-CMD] ❌ Commande "${commandName}" non trouvée dans la Map (${commands.size} commandes chargées)`);
      return;
    }

    // Permission checks
    if (config.selfMode && !isOwner(sock, sender)) {
      if (isGroup) console.log(`[GROUP-CMD] 🔒 selfMode bloque ${commandName}`);
      return;
    }

    if (command.ownerOnly && !isOwner(sock, sender)) { // ✅ CORRIGÉ
      if (isGroup) console.log(`[GROUP-CMD] 👑 ownerOnly bloque ${commandName}`);
      return antiBan.queueMessage(async () => {
        await presence.simulateTyping(from);
        return safeSend(sock, from, { text: config.messages.ownerOnly }, { quoted: msg });
      });
    }
    if (command.fromMe && !isOwner(sock, sender)) {
      if (isGroup) console.log(`[GROUP-CMD] 🔐 fromMe bloque ${commandName} (sender=${sender})`);
      return antiBan.queueMessage(async () => {
        await presence.simulateTyping(from);
        return safeSend(sock, from, { text: '❌ Cette commande est réservée au propriétaire du bot.' }, { quoted: msg });
      });
    }
    if (command.modOnly && !isMod(sender) && !isOwner(sock, sender)) { // ✅ CORRIGÉ
      return antiBan.queueMessage(async () => {
        await presence.simulateTyping(from);
        return safeSend(sock, from, { text: 'C est réservé aux modérateurs.' }, { quoted: msg });
      });
    }
    if (command.groupOnly && !isGroup) {
      return antiBan.queueMessage(async () => {
        await presence.simulateTyping(from);
        return safeSend(sock, from, { text: config.messages.groupOnly }, { quoted: msg });
      });
    }
    if (command.privateOnly && isGroup) {
      return antiBan.queueMessage(async () => {
        await presence.simulateTyping(from);
        return safeSend(sock, from, { text: config.messages.privateOnly }, { quoted: msg });
      });
    }
    if (command.adminOnly && !(await isAdmin(sock, sender, from, groupMetadata)) && !isOwner(sock, sender)) { // ✅ CORRIGÉ
      return antiBan.queueMessage(async () => {
        await presence.simulateTyping(from);
        return safeSend(sock, from, { text: config.messages.adminOnly }, { quoted: msg });
      });
    }
    if (command.botAdminNeeded) {
      const botIsAdminCheck = await isBotAdmin(sock, from, groupMetadata);
      if (!botIsAdminCheck) {
        return antiBan.queueMessage(async () => {
          await presence.simulateTyping(from);
          return safeSend(sock, from, { text: config.messages.botAdminNeeded }, { quoted: msg });
        });
      }
    }

    // AI limits check for AI commands
    const aiCommands = ['ai', 'aianalyze', 'gemini', 'gpt', 'chatgpt', 'analyze'];
    if (aiCommands.includes(commandName)) {
      const service = commandName.includes('analyze') ? 'analyze' : 'chat';
      const aiCheck = aiLimits.canUse(sender, service, isOwner(sock, sender), isMod(sender)); // ✅ CORRIGÉ
      if (!aiCheck.allowed) {
        return antiBan.queueMessage(async () => {
          await presence.simulateTyping(from);
          return sock.sendMessage(from, {
            text: ` Limite IA atteinte (${aiCheck.used}/${aiCheck.max}). Réessaie demain.`
          }, { quoted: msg });
        });
      }
      // Record usage
      aiLimits.recordUsage(sender, service);
    }

    // Auto-typing (using presence simulation)
    if (config.autoTyping) {
      await presence.simulateTyping(from, body.length);
    }

    // ✅ Affichage propre des commandes entrantes
    const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    console.log(`⚡ [${time}] .${commandName} ← ${sender.split('@')[0]}`);

    // Inject common props on msg so both module.exports and cmd() plugins work
    msg.sender = msg.sender || sender;
    msg.chat = msg.chat || from;
    msg.body = msg.body || body;
    msg.text = msg.text || body;
    msg.isGroup = msg.isGroup ?? isGroup;
    msg.isOwner = msg.isOwner ?? isOwner(sock, sender); // ✅ CORRIGÉ
    msg.from = from;

    // ✅ Injecter m.quoted complet avec download()
    try {
      const content = getMessageContent(msg);
      const ctxInfo = content?.extendedTextMessage?.contextInfo
        || content?.imageMessage?.contextInfo
        || content?.videoMessage?.contextInfo
        || content?.audioMessage?.contextInfo
        || content?.documentMessage?.contextInfo;

      if (ctxInfo?.quotedMessage) {
        const rawQ = ctxInfo.quotedMessage;
        let qMsg = rawQ;
        let qType = Object.keys(qMsg)[0];

        if (qType === 'viewOnceMessage' || qType === 'viewOnceMessageV2') {
          qMsg = qMsg[qType].message;
          qType = Object.keys(qMsg)[0];
        }

        msg.quoted = {
          message: rawQ,
          stanzaId: ctxInfo.stanzaId,
          participant: ctxInfo.participant,
          mtype: qType,
          type: qType,
          key: {
            remoteJid: from,
            fromMe: false,
            id: ctxInfo.stanzaId,
            participant: ctxInfo.participant,
          },
          get text() {
            return qMsg[qType]?.caption || qMsg[qType]?.text || qMsg.conversation || '';
          },
          get mimetype() {
            return qMsg[qType]?.mimetype || '';
          },
          get msg() {
            return qMsg[qType];
          },
          download: async () => {
            const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
            const typeMap = {
              imageMessage: 'image',
              videoMessage: 'video',
              audioMessage: 'audio',
              stickerMessage: 'sticker',
              documentMessage: 'document',
            };
            const mediaType = typeMap[qType];
            if (!mediaType) throw new Error('No valid media type: ' + qType);
            const stream = await downloadContentFromMessage(qMsg[qType], mediaType);
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
            return buffer;
          },
        };
      }
    } catch (e) {
      console.error('[HANDLER] quoted injection error:', e.message);
    }

    const ctx = {
      from, sender, isGroup, groupMetadata,
      isOwner: isOwner(sock, sender), // ✅ CORRIGÉ
      isAdmin: await isAdmin(sock, sender, from, groupMetadata),
      isBotAdmin: await isBotAdmin(sock, from, groupMetadata),
      isMod: isMod(sender),
      reply: (text) => antiBan.queueMessage(async () => {
        const len = typeof text === 'string' ? text.length : 0;
        await presence.simulateTyping(from, len);
        return safeSend(sock, from, { text }, { quoted: msg });
      }),
      react: (emoji) => antiBan.queueMessage(async () => {
        return safeSend(sock, from, { react: { text: emoji, key: msg.key } });
      }),
      body, q: args.join(' '), prefix: config.prefix, conn: sock,
      args, config
    };

    await command.execute(sock, msg, args, ctx);

    // Track stats for Command Center
    try {
      const sessionId = config.sessionName || 'session';
      sessionManager.incrementStat(sessionId, 'commandsExecuted');
      sessionManager.addCommandHistory(sessionId, {
        command: commandName,
        sender,
        from,
        isGroup,
      });
      bus.emit('command:executed', {
        sessionId,
        command: commandName,
        sender,
        from,
        isGroup,
      });
    } catch (e) {}

  } catch (error) {
    if (error.message && error.message.includes('rate-overlimit')) return;
    console.error('Erreur handler:', error.message);
    try {
      antiBan.queueMessage(async () => {
        return safeSend(sock, msg.key.remoteJid, { text: `${config.messages.error}\n${error.message}` }, { quoted: msg });
      });
    } catch (e) {}
  }
};

const handleGroupUpdate = async (sock, update) => {
  try {
    const { id, participants, action } = update;
    if (!id || !id.endsWith('@g.us')) return;
    const groupSettings = database.getGroupSettings(id);
    if (!groupSettings.welcome && !groupSettings.goodbye) return;
    const groupMetadata = await getGroupMetadata(sock, id);
    if (!groupMetadata) return;

    for (const participant of participants) {
      const participantJid = typeof participant === 'string' ? participant : participant?.id;
      if (!participantJid) continue;
      const participantNumber = participantJid.split('@')[0];

      // Queue welcome/goodbye with random delay 3-10s per member
      const delayMs = 3000 + Math.floor(Math.random() * 7000);

      if (action === 'add' && groupSettings.welcome) {
        const message = (groupSettings.welcomeMessage || 'Bienvenue @user !')
          .replace(/@user/g, `@${participantNumber}`)
          .replace(/@group/g, groupMetadata.subject || 'le groupe')
          .replace(/#memberCount/g, groupMetadata.participants?.length || '?');
        setTimeout(() => {
          antiBan.queueMessage(async () => {
            return sock.sendMessage(id, { text: message, mentions: [participantJid] });
          }).catch(() => {});
        }, delayMs);
      } else if (action === 'remove' && groupSettings.goodbye) {
        const message = (groupSettings.goodbyeMessage || '@user a quitté le groupe.')
          .replace(/@user/g, `@${participantNumber}`);
        setTimeout(() => {
          antiBan.queueMessage(async () => {
            return sock.sendMessage(id, { text: message, mentions: [participantJid] });
          }).catch(() => {});
        }, delayMs);
      }
    }
  } catch (error) {
    if (!error.message?.includes('forbidden')) {
      console.error('Erreur group update:', error.message);
    }
  }
};

const initializeAntiCall = (sock) => {
  sock.ev.on('call', async (calls) => {
    for (const call of calls) {
      if (call.status === 'offer') {
        const from = call.from;
        antiBan.queueMessage(async () => {
          return sock.sendMessage(from, { text: 'Les appels sont désactivés. Envoie un message.' });
        }).catch(() => {});
        await sock.rejectCall(call.id, call.from).catch(() => {});
      }
    }
  });
};

module.exports = { handleMessage, handleGroupUpdate, initializeAntiCall, getGroupMetadata, getCachedGroupMetadata };