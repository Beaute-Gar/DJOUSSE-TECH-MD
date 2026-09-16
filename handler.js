/**
 * Message Handler - DJOUSSE TECH MD
 * Basé sur KnightBot-Mini, adapté par Beaute Gar
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

const isOwner = (sender) => {
  if (!sender || typeof sender !== 'string') return false;
  const normalizedSender = normalizeJidWithLid(sender);
  const senderNumber = normalizeJid(normalizedSender);
  return config.ownerNumber.some(owner => {
    if (!owner || typeof owner !== 'string') return false;
    const normalizedOwner = normalizeJidWithLid(owner.includes('@') ? owner : `${owner}@s.whatsapp.net`);
    const ownerNumber = normalizeJid(normalizedOwner);
    return ownerNumber === senderNumber;
  });
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
  if (!foundParticipant) return false;
  return foundParticipant.admin === 'admin' || foundParticipant.admin === 'superadmin';
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
    if (!participant) return false;
    return participant.admin === 'admin' || participant.admin === 'superadmin';
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
      ? (sock.user?.id ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : '')
      : (msg.key.participant || msg.key.remoteJid || '');
    const isGroup = from.endsWith('@g.us');
    const groupMetadata = isGroup ? await getGroupMetadata(sock, from) : null;

    // Anti-flood in groups
    if (isGroup && !msg.key.fromMe) {
      const floodResult = antiFlood.trackMessage(from, sender);
      if (floodResult.action === 'muted') {
        console.log(`[ANTI-FLOOD] 🔇 Muet: ${sender.split('@')[0]} dans ${from}`);
        return;
      }
      if (floodResult.action === 'warned') {
        await sock.sendMessage(from, {
          text: `⚠️ *Anti-Flood*\n@${sender.split('@')[0]} ralentis !\nAvertissement ${floodResult.warns}/${floodResult.max}`,
          mentions: [sender]
        }).catch(() => {});
        return;
      }
    }

    // Auto-react
    try {
      delete require.cache[require.resolve('./config')];
      const cfg = require('./config');
      if (cfg.autoReact && msg.message && !msg.key.fromMe) {
        const emojis = ['❤️','🔥','👌','💀','😁','✨','👍','😎','😂','🤝'];
        const emoji = emojis[Math.floor(Math.random() * emojis.length)];
        antiBan.queueMessage(async () => {
          return sock.sendMessage(from, { react: { text: emoji, key: msg.key } });
        });
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
        const senderIsOwner = isOwner(sender);
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
          await sock.sendMessage(from, {
            text: formatLevelUpMessage(levelResult.before, levelResult.after, levelResult.role, levelResult.diamondsEarned),
            mentions: [sender]
          }, { quoted: msg }).catch(() => {});
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
                isOwner: isOwner(sender), isAdmin: await isAdmin(sock, sender, from, groupMetadata),
                isBotAdmin: await isBotAdmin(sock, from, groupMetadata), isMod: isMod(sender),
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
      if (afk.isEnabled() && !isOwner(sender)) {
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
                isOwner: isOwner(sender), isAdmin: await isAdmin(sock, sender, from, groupMetadata),
                isBotAdmin: await isBotAdmin(sock, from, groupMetadata), isMod: isMod(sender),
                reply: (text) => sock.sendMessage(from, { text }, { quoted: msg }),
                react: (emoji) => sock.sendMessage(from, { react: { text: emoji, key: msg.key } }).catch(() => {})
              });
            }
          } catch (e) {}
          return;
        }
      }
    }

    // Check prefix
    if (!body.startsWith(config.prefix)) return;

    const args = body.slice(config.prefix.length).trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();
    const command = commands.get(commandName);
    if (!command) return;

    // Permission checks
    if (config.selfMode && !isOwner(sender)) return;
    if (command.ownerOnly && !isOwner(sender)) {
      return antiBan.queueMessage(async () => {
        await antiBan.simulateTyping(from);
        return sock.sendMessage(from, { text: config.messages.ownerOnly }, { quoted: msg });
      });
    }
    if (command.modOnly && !isMod(sender) && !isOwner(sender)) {
      return antiBan.queueMessage(async () => {
        await antiBan.simulateTyping(from);
        return sock.sendMessage(from, { text: 'C est réservé aux modérateurs.' }, { quoted: msg });
      });
    }
    if (command.groupOnly && !isGroup) {
      return antiBan.queueMessage(async () => {
        await antiBan.simulateTyping(from);
        return sock.sendMessage(from, { text: config.messages.groupOnly }, { quoted: msg });
      });
    }
    if (command.privateOnly && isGroup) {
      return antiBan.queueMessage(async () => {
        await antiBan.simulateTyping(from);
        return sock.sendMessage(from, { text: config.messages.privateOnly }, { quoted: msg });
      });
    }
    if (command.adminOnly && !(await isAdmin(sock, sender, from, groupMetadata)) && !isOwner(sender)) {
      return antiBan.queueMessage(async () => {
        await antiBan.simulateTyping(from);
        return sock.sendMessage(from, { text: config.messages.adminOnly }, { quoted: msg });
      });
    }
    if (command.botAdminNeeded) {
      const botIsAdminCheck = await isBotAdmin(sock, from, groupMetadata);
      if (!botIsAdminCheck) {
        return antiBan.queueMessage(async () => {
          await antiBan.simulateTyping(from);
          return sock.sendMessage(from, { text: config.messages.botAdminNeeded }, { quoted: msg });
        });
      }
    }

    // Auto-typing (using anti-ban typing simulation)
    if (config.autoTyping) {
      await antiBan.simulateTyping(from);
    }

    // Execute
    console.log(`Commande: ${commandName} | Sender: ${sender}`);

    // Inject common props on msg so both module.exports and cmd() plugins work
    msg.sender = msg.sender || sender;
    msg.chat = msg.chat || from;
    msg.body = msg.body || body;
    msg.text = msg.text || body;
    msg.isGroup = msg.isGroup ?? isGroup;
    msg.isOwner = msg.isOwner ?? isOwner(sender);
    msg.from = from;

    const ctx = {
      from, sender, isGroup, groupMetadata,
      isOwner: isOwner(sender),
      isAdmin: await isAdmin(sock, sender, from, groupMetadata),
      isBotAdmin: await isBotAdmin(sock, from, groupMetadata),
      isMod: isMod(sender),
      reply: (text) => antiBan.queueMessage(async () => {
        await antiBan.simulateTyping(from);
        return sock.sendMessage(from, { text }, { quoted: msg });
      }),
      react: (emoji) => antiBan.queueMessage(async () => {
        return sock.sendMessage(from, { react: { text: emoji, key: msg.key } });
      }),
      body, q: args.join(' '), prefix: config.prefix, conn: sock,
      args
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
        return sock.sendMessage(msg.key.remoteJid, { text: `${config.messages.error}\n${error.message}` }, { quoted: msg });
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

      if (action === 'add' && groupSettings.welcome) {
        const message = (groupSettings.welcomeMessage || 'Bienvenue @user !')
          .replace(/@user/g, `@${participantNumber}`)
          .replace(/@group/g, groupMetadata.subject || 'le groupe')
          .replace(/#memberCount/g, groupMetadata.participants?.length || '?');
        await sock.sendMessage(id, { text: message, mentions: [participantJid] }).catch(() => {});
      } else if (action === 'remove' && groupSettings.goodbye) {
        const message = (groupSettings.goodbyeMessage || '@user a quitté le groupe.')
          .replace(/@user/g, `@${participantNumber}`);
        await sock.sendMessage(id, { text: message, mentions: [participantJid] }).catch(() => {});
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
        await sock.sendMessage(from, { text: 'Les appels sont désactivés. Envoie un message.' }).catch(() => {});
        await sock.rejectCall(call.id, call.from).catch(() => {});
      }
    }
  });
};

module.exports = { handleMessage, handleGroupUpdate, initializeAntiCall, getGroupMetadata, getCachedGroupMetadata };
