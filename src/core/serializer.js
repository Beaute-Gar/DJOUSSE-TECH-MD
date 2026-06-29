import { downloadMediaMessage, isJidGroup } from '@whiskeysockets/baileys';
import { createLogger } from './logger.js';
const log = createLogger('SERIALIZER');

function extractBody(message) {
  if (!message) return '';
  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.documentMessage?.caption ||
    message.buttonsResponseMessage?.selectedButtonId ||
    message.listResponseMessage?.singleSelectReply?.selectedRowId ||
    message.templateButtonReplyMessage?.selectedId ||
    message.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson ||
    ''
  );
}

function normalizeJid(jid = '') {
  return jid.includes(':') ? jid.replace(/:.*@/, '@') : jid;
}

export async function serializeMessage(sock, rawMsg) {
  try {
    if (!rawMsg?.key || !rawMsg.message) return null;

    const chatJid  = rawMsg.key.remoteJid;
    const isGroup  = isJidGroup(chatJid);
    const msgType  = Object.keys(rawMsg.message)[0];
    const body     = extractBody(rawMsg.message);

    const sender = isGroup
      ? normalizeJid(rawMsg.key.participant || rawMsg.participant || '')
      : normalizeJid(chatJid);

    let groupMetadata = null;
    let isGroupAdmin = false;
    let botIsAdmin = false;
    if (isGroup) {
      try {
        groupMetadata = await sock.groupMetadata(chatJid);
        const admins = groupMetadata.participants?.filter(p => p.admin).map(p => p.id) || [];
        const botJid = sock.user?.id?.split(':')[0] + '@s.whatsapp.net' || '';
        isGroupAdmin = admins.includes(sender);
        botIsAdmin = admins.includes(botJid);
      } catch { groupMetadata = null; }
    }

    const m = {
      key        : rawMsg.key,
      message    : rawMsg.message,
      pushName   : rawMsg.pushName ?? '',
      msgType,
      body,
      sender,
      chatJid,
      isGroup,
      groupMetadata,
      fromMe     : rawMsg.key.fromMe ?? false,
      timestamp  : rawMsg.messageTimestamp
        ? new Date(Number(rawMsg.messageTimestamp) * 1000)
        : new Date(),
      isMedia    : ['imageMessage','videoMessage','audioMessage','documentMessage','stickerMessage'].includes(msgType),
      isQuoted   : !!(rawMsg.message?.extendedTextMessage?.contextInfo?.quotedMessage),
      quotedMsg  : rawMsg.message?.extendedTextMessage?.contextInfo ?? null,
      mentions   : rawMsg.message?.extendedTextMessage?.contextInfo?.mentionedJid ?? [],
      isGroupAdmin,
      botIsAdmin,

      reply: (text) => sock.sendMessage(chatJid, { text: String(text) }, { quoted: rawMsg }),

      react: (emoji) => sock.sendMessage(chatJid, { react: { text: emoji, key: rawMsg.key } }),

      send: (content) => sock.sendMessage(chatJid, content),

      mention: (jids, text) => sock.sendMessage(chatJid, {
        text,
        mentions: Array.isArray(jids) ? jids : [jids],
      }, { quoted: rawMsg }),

      download: async () => {
        try { return await downloadMediaMessage(rawMsg, 'buffer', {}); }
        catch (e) { log.error({ e }, 'Erreur download media'); return null; }
      },

      getProfilePic: async () => {
        try { return await sock.profilePictureUrl(sender, 'image'); }
        catch { return null; }
      },

      sendImage: async (buffer, caption = '') =>
        sock.sendMessage(chatJid, { image: buffer, caption }, { quoted: rawMsg }),

      sendVideo: async (buffer, caption = '') =>
        sock.sendMessage(chatJid, { video: buffer, caption }, { quoted: rawMsg }),

      sendAudio: async (buffer, ptt = false) =>
        sock.sendMessage(chatJid, { audio: buffer, mimetype: 'audio/mp4', ptt }, { quoted: rawMsg }),

      sendSticker: async (buffer) =>
        sock.sendMessage(chatJid, { sticker: buffer }, { quoted: rawMsg }),

      sendDocument: async (buffer, mimetype, filename) =>
        sock.sendMessage(chatJid, { document: buffer, mimetype, fileName: filename }, { quoted: rawMsg }),

      sendContact: async (name, number) => {
        const vcard = `BEGIN:VCARD\nVERSION:3.0\nN:;${name};;;\nFN:${name}\nTEL;type=CELL;type=VOICE;waid=${number}:+${number}\nEND:VCARD`;
        return sock.sendMessage(chatJid, { contacts: { displayName: name, contacts: [{ vcard }] } }, { quoted: rawMsg });
      },

      read: async () => { try { await sock.readMessages([rawMsg.key]); } catch {} },

      delete: async () => sock.sendMessage(chatJid, { delete: rawMsg.key }),
    };

    return m;
  } catch (err) {
    log.error({ err }, 'Erreur sérialisation message');
    return null;
  }
}
