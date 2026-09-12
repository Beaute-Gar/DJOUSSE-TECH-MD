const {
    proto, getContentType, jidNormalizedUser, downloadContentFromMessage
} = require('@whiskeysockets/baileys');

const sms = (conn, m) => {
    if (!m) return m;
    if (m.key) {
        m.id = m.key.id;
        m.isBaileys = m.id.startsWith('BAE5') && m.id.length === 16;
        m.chat = m.key.remoteJid;
        m.fromMe = m.key.fromMe;
        m.isGroup = m.chat.endsWith('@g.us');
        m.sender = jidNormalizedUser(m.fromMe ? conn.user.id : (m.participant || m.key.participant || m.chat));
    }
    if (m.message) {
        m.mtype = getContentType(m.message);
        if (m.mtype === 'viewOnceMessageV2' || m.mtype === 'viewOnceMessage') {
            m.message = m.message[m.mtype].message;
            m.mtype = getContentType(m.message);
        }
        m.msg = m.message[m.mtype];
        m.quoted = m.msg?.contextInfo?.quotedMessage
            ? (() => {
                const rawQ = m.msg.contextInfo.quotedMessage;
                let qMsg = rawQ;
                let qType = getContentType(qMsg);
                if (qType === 'viewOnceMessageV2' || qType === 'viewOnceMessage') {
                    qMsg = qMsg[qType].message;
                    qType = getContentType(qMsg);
                }
                return {
                    message: rawQ,
                    stanzaId: m.msg.contextInfo.stanzaId,
                    participant: m.msg.contextInfo.participant,
                    mtype: qType,
                    get text() {
                        return qMsg[qType]?.caption || qMsg[qType]?.text || qMsg.conversation || '';
                    },
                    get mimetype() {
                        return qMsg[qType]?.mimetype || '';
                    },
                    download: async () => {
                        const typeMap = {
                            imageMessage: 'image', videoMessage: 'video',
                            audioMessage: 'audio', stickerMessage: 'sticker',
                            documentMessage: 'document'
                        };
                        const mediaType = typeMap[qType];
                        if (!mediaType) throw new Error('No valid media type: ' + qType);
                        const stream = await downloadContentFromMessage(qMsg[qType], mediaType);
                        let buffer = Buffer.from([]);
                        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                        return buffer;
                    }
                };
            })()
            : null;
        m.body = (m.mtype === 'conversation') ? m.message.conversation
            : (m.mtype == 'imageMessage') ? m.message.imageMessage.caption
            : (m.mtype == 'videoMessage') ? m.message.videoMessage.caption
            : (m.mtype == 'extendedTextMessage') ? m.message.extendedTextMessage.text
            : (m.mtype == 'buttonsResponseMessage') ? m.message.buttonsResponseMessage.selectedButtonId
            : (m.mtype == 'listResponseMessage') ? m.message.listResponseMessage.singleSelectReply.selectedRowId
            : (m.mtype == 'templateButtonReplyMessage') ? m.message.templateButtonReplyMessage.selectedId
            : (m.mtype == 'interactiveResponseMessage') ? (m.message.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson || '')
            : (m.mtype === 'messageContextInfo') ? (m.message.buttonsResponseMessage?.selectedButtonId || m.message.listResponseMessage?.singleSelectReply?.selectedRowId || m.message.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson || m.text) : '';
        m.reply = (text, chatId = m.chat, options = {}) => {
            return conn.sendMessage(chatId, { text: text }, { quoted: m, ...options });
        };
    }
    return m;
};

module.exports = { sms };
