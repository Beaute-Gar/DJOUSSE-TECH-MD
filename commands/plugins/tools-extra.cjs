const { cmd } = require('../command.cjs');
const config = require('../config-djousse.cjs');
const { box } = require('../lib/djousse-ui.cjs');

cmd({
    pattern: 'getpp',
    desc: 'Get a user profile picture',
    category: 'tools',
    react: '📸',
    filename: __filename
}, async (conn, m, commands, { from, sender, reply, isGroup }) => {
    try {
        const quotedParticipant = m.message?.extendedTextMessage?.contextInfo?.participant;
        const quotedMsg = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        let targetJid;

        if (isGroup) {
            if (quotedParticipant && quotedMsg) {
                targetJid = quotedParticipant;
            } else {
                return reply('❌ Reply to a user to get their profile photo.');
            }
        } else {
            targetJid = sender;
        }

        let imageUrl;
        try {
            imageUrl = await conn.profilePictureUrl(targetJid, 'image');
        } catch {
            imageUrl = 'media/djousse.jpg';
        }

        await conn.sendMessage(from, {
            image: { url: imageUrl },
            caption: box('PROFILE PICTURE', [`USER: @${targetJid.split('@')[0]}`]),
            mentions: [targetJid]
        }, { quoted: m });

    } catch (err) {
        console.error('GETPP ERROR:', err);
        reply('❌ Unable to retrieve profile photo.');
    }
});

cmd({
    pattern: 'owner',
    desc: 'Contact the creator',
    category: 'main',
    react: '👑'
}, async (conn, m, commands, { from }) => {
    const ownerNumber = config.BOT_OWNER || '';
    const ownerName = config.OWNER_NAME || 'DJOUSSE TECH';

    const vcard = 'BEGIN:VCARD\n' +
        'VERSION:3.0\n' +
        `FN:${ownerName}\n` +
        `ORG:${ownerName};\n` +
        `TEL;type=CELL;type=VOICE;waid=${ownerNumber}:${ownerNumber}\n` +
        'END:VCARD';

    await conn.sendMessage(from, {
        contacts: {
            displayName: ownerName,
            contacts: [{ vcard }]
        }
    }, { quoted: m });
});
