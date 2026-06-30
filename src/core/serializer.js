import { downloadMediaMessage, isJidGroup } from '@whiskeysockets/baileys';
import { createLogger } from './logger.js';
import { executor, ACTION_TYPES } from '../cognitive/action-executor.js';
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

      reply: (text) => executor.execute({
        type: ACTION_TYPES.SEND_MESSAGE,
        payload: { jid: chatJid, text: String(text), options: { quoted: rawMsg } },
        source: 'serializer:reply',
      }).catch(() => {}),

      react: (emoji) => executor.execute({
        type: ACTION_TYPES.REACT,
        payload: { jid: chatJid, emoji, messageKey: rawMsg.key },
        source: 'serializer:react',
      }).catch(() => {}),

      send: (content) => executor.execute({
        type: ACTION_TYPES.SEND_MESSAGE,
        payload: { jid: chatJid, ...content },
        source: 'serializer:send',
      }).catch(() => {}),

      mention: (jids, text) => executor.execute({
        type: ACTION_TYPES.SEND_MESSAGE,
        payload: {
          jid: chatJid, text,
          options: { mentions: Array.isArray(jids) ? jids : [jids], quoted: rawMsg },
        },
        source: 'serializer:mention',
      }).catch(() => {}),

      download: async () => {
        try { return await downloadMediaMessage(rawMsg, 'buffer', {}); }
        catch (e) { log.error({ e }, 'Erreur download media'); return null; }
      },

      getProfilePic: async () => {
        try { return await sock.profilePictureUrl(sender, 'image'); }
        catch { return null; }
      },

      sendImage: async (buffer, caption = '') =>
        executor.execute({
          type: ACTION_TYPES.SEND_IMAGE,
          payload: { jid: chatJid, buffer, caption, options: { quoted: rawMsg } },
          source: 'serializer:sendImage',
        }).catch(() => {}),

      sendVideo: async (buffer, caption = '') =>
        executor.execute({
          type: ACTION_TYPES.SEND_VIDEO,
          payload: { jid: chatJid, buffer, caption, options: { quoted: rawMsg } },
          source: 'serializer:sendVideo',
        }).catch(() => {}),

      sendAudio: async (buffer, ptt = false) =>
        executor.execute({
          type: ACTION_TYPES.SEND_AUDIO,
          payload: { jid: chatJid, buffer, mimetype: 'audio/mp4', ptt, options: { quoted: rawMsg } },
          source: 'serializer:sendAudio',
        }).catch(() => {}),

      sendSticker: async (buffer) =>
        executor.execute({
          type: ACTION_TYPES.SEND_MESSAGE,
          payload: { jid: chatJid, sticker: buffer, options: { quoted: rawMsg } },
          source: 'serializer:sendSticker',
        }).catch(() => {}),

      sendDocument: async (buffer, mimetype, filename) =>
        executor.execute({
          type: ACTION_TYPES.SEND_DOCUMENT,
          payload: { jid: chatJid, buffer, mimetype, fileName: filename, options: { quoted: rawMsg } },
          source: 'serializer:sendDocument',
        }).catch(() => {}),

      sendContact: async (name, number) => {
        const vcard = `BEGIN:VCARD\nVERSION:3.0\nN:;${name};;;\nFN:${name}\nTEL;type=CELL;type=VOICE;waid=${number}:+${number}\nEND:VCARD`;
        return executor.execute({
          type: ACTION_TYPES.SEND_MESSAGE,
          payload: { jid: chatJid, contacts: { displayName: name, contacts: [{ vcard }] }, options: { quoted: rawMsg } },
          source: 'serializer:sendContact',
        }).catch(() => {});
      },

      read: async () => {
        try {
          const sock = typeof executor._sockProvider === 'function' ? executor._sockProvider() : null;
          if (sock?.readMessages) await sock.readMessages([rawMsg.key]);
        } catch {}
      },

      delete: async () => executor.execute({
        type: ACTION_TYPES.DELETE_MESSAGE,
        payload: { jid: chatJid, messageKey: rawMsg.key },
        source: 'serializer:delete',
      }).catch(() => {}),
    };

    return m;
  } catch (err) {
    log.error({ err }, 'Erreur sérialisation message');
    return null;
  }
}
