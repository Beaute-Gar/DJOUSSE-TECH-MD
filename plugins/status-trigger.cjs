const { cmd } = require('../command.cjs');

cmd({
  pattern: ' ',
  desc: 'Status download trigger',
  category: 'status',
  filename: __filename,
  dontAddCommandList: true,
}, async (conn, m) => {
  try {
    const textLower = (m.body || '').toLowerCase();
    const triggerWords = ['send', 'statusdown', 'take', 'sent', 'giv', 'gib', 'upload', 'send me', 'sent me', 'znt', 'snt', 'ayak', 'do', 'mee'];
    if (!triggerWords.includes(textLower)) return;
    if (!m.message?.extendedTextMessage?.contextInfo?.quotedMessage) return;
    const quotedMessage = m.message.extendedTextMessage.contextInfo.quotedMessage;
    if (quotedMessage.imageMessage) {
      const imageUrl = await conn.downloadAndSaveMediaMessage(quotedMessage.imageMessage);
      await conn.sendMessage(m.chat, { image: { url: imageUrl }, caption: quotedMessage.imageMessage.caption, contextInfo: { mentionedJid: [m.sender], forwardingScore: 9999, isForwarded: true } });
    }
    if (quotedMessage.videoMessage) {
      const videoUrl = await conn.downloadAndSaveMediaMessage(quotedMessage.videoMessage);
      await conn.sendMessage(m.chat, { video: { url: videoUrl }, caption: quotedMessage.videoMessage.caption, contextInfo: { mentionedJid: [m.sender], forwardingScore: 9999, isForwarded: true } });
    }
  } catch (error) { console.error('Status trigger error:', error); }
});
