import config from "../config.cjs";

const groupInfo = async (message, sock) => {
    const prefix = config.PREFIX;
    const command = message.body.startsWith(prefix)
        ? message.body.slice(prefix.length).split(" ")[0].toLowerCase()
        : "";

    if (command !== "groupinfo") return;

    const chatId = message.key.remoteJid;
    const isGroup = chatId.endsWith("@g.us");
    if (!isGroup) return message.reply("*This command only works in group chats!*");

    try {
        const metadata = await sock.groupMetadata(chatId);
        const admins = metadata.participants.filter(p => p.admin);
        const creatorJid = metadata.owner || null;
        const creatorTag = creatorJid ? `@${creatorJid.split("@")[0]}` : "Unknown";
        const description = metadata.desc || "No description set.";
        const creationDate = new Date(metadata.creation * 1000).toLocaleString();

        const infoText = `
â•­â”€âŸª  *DJOUSSE-TECH-MD MAKES*  âŸ«â”€â•®
â”‚
â”‚ ðŸ›°ï¸ *Name:* _${metadata.subject}_
â”‚ ðŸ†” *ID:* _${metadata.id}_
â”‚ ðŸ‘¥ *Members:* _${metadata.participants.length}_
â”‚ ðŸ›¡ï¸ *Admins:* _${admins.length}_
â”‚ ðŸ‘‘ *Creator:* _${creatorTag}_
â”‚ ðŸ• *Created:* _${creationDate}_
â”‚
â•°â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â•¯

ðŸ§¾ *Description:*
_${description}_

â”€â”€â”€â”€â”€â”€ã€” âš¡ *DJOUSSE-TECH-MD* âš¡ ã€•â”€â”€â”€â”€â”€â”€
`.trim();

        await sock.sendMessage(chatId, {
            text: infoText,
            mentions: creatorJid ? [creatorJid] : []
        }, { quoted: message });

    } catch (error) {
        console.error(`Group Info Error in ${chatId}:`, error);
        return message.reply("*Something went wrong while fetching group info. Please try again later!*");
    }
};

export default groupInfo;

