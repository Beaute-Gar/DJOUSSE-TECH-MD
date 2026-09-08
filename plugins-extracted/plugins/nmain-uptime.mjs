import pkg, { prepareWAMessageMedia } from '@whiskeysockets/baileys';
const { generateWAMessageFromContent, proto } = pkg;

const alive = async (m, Matrix) => {
  const uptimeSeconds = process.uptime();
  const days = Math.floor(uptimeSeconds / (24 * 3600));
  const hours = Math.floor((uptimeSeconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = Math.floor(uptimeSeconds % 60);

  const prefix = /^[\\/!#.]/gi.test(m.body) ? m.body.match(/^[\\/!#.]/gi)[0] : '/';
  const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).toLowerCase() : '';

  if (['alive', 'hansuptime', 'uptime'].includes(cmd)) {
    const uptimeMessage = `
â•­â”â”â”â”â”â”â”â° ðŸ”¥ â±â”â”â”â”â”â”â”â•®
â”ƒðŸ§¿ *BOT : DJOUSSE-TECH-MD V2*
â”ƒ 
â”ƒâ³ *Uptime:*
â”ƒ   â”—â”âž¤ ${days}d ${hours}h ${minutes}m ${seconds}s
â”ƒ 
â”ƒðŸ’» *Status:* Online & Ready
â”ƒðŸ”‹ *Power Mode:* Ultra Instinct 
â”ƒðŸ‘‘ *Owner:* @${m.sender.split('@')[0]}
â•°â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â•¯
`;

    const buttons = [
      {
        "name": "quick_reply",
        "buttonParamsJson": JSON.stringify({
          display_text: "ðŸš€ Speed Test",
          id: `${prefix}ping`
        })
      }
    ];

    const msg = generateWAMessageFromContent(m.from, {
      viewOnceMessage: {
        message: {
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2
          },
          interactiveMessage: proto.Message.InteractiveMessage.create({
            body: proto.Message.InteractiveMessage.Body.create({
              text: uptimeMessage
            }),
            footer: proto.Message.InteractiveMessage.Footer.create({
              text: "POWERED BY DJOUSSE-TECH-MD V2"
            }),
            header: proto.Message.InteractiveMessage.Header.create({
              title: "ðŸš¨ SYSTEM STATUS",
              gifPlayback: true,
              subtitle: "ðŸ§¿ SYSTEM MONITOR",
              hasMediaAttachment: false
            }),
            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
              buttons
            }),
            contextInfo: {
              mentionedJid: [m.sender],
              forwardingScore: 999,
              isForwarded: true,
              forwardedNewsletterMessageInfo: {
                newsletterJid: '237693978044',
                newsletterName: "DJOUSSE-TECH-MD",
                serverMessageId: 143
              }
            }
          }),
        },
      },
    }, {});

    await Matrix.relayMessage(msg.key.remoteJid, msg.message, {
      messageId: msg.key.id
    });
  }
};

export default alive;
      

