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
            ? {
                message: m.msg.contextInfo.quotedMessage,
                stanzaId: m.msg.contextInfo.stanzaId,
                participant: m.msg.contextInfo.participant,
                mtype: getContentType(m.msg.contextInfo.quotedMessage),
                get text() {
                    const q = m.msg.contextInfo.quotedMessage;
                    const t = getContentType(q);
                    return q[t]?.caption || q[t]?.text || q.conversation || '';
                },
                get mimetype() {
                    const q = m.msg.contextInfo.quotedMessage;
                    const t = getContentType(q);
                    return q[t]?.mimetype || '';
                },
                download: async () => {
                    const q = m.msg.contextInfo.quotedMessage;
                    const t = getContentType(q);
                    const stream = await downloadContentFromMessage(q[t], t.replace('Message', ''));
                    let buffer = Buffer.from([]);
                    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                    return buffer;
                }
            }
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
