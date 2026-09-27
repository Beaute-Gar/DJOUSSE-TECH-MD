const { cmd } = require('../command.cjs');
const config = require('../config-djousse.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
    pattern: "owner",
    desc: "Contact the creator",
    category: "main",
    react: "👑",
    filename: __filename
}, async (conn, m, commands, { from }) => {
    const ownerNumber = config.OWNER_NUMBER || config.BOT_OWNER || '';
    const ownerName = config.OWNER_NAME || 'Beaute Gar';

    const vcard = 'BEGIN:VCARD\n' +
        'VERSION:3.0\n' +
        `FN:${ownerName} (Owner)\n` +
        `ORG:${config.BOT_NAME || 'DJOUSSE-TECH-MD'};\n` +
        `TEL;type=CELL;type=VOICE;waid=${ownerNumber}:${ownerNumber}\n` +
        'END:VCARD';

    await conn.sendMessage(from, {
        contacts: {
            displayName: ownerName,
            contacts: [{ vcard }]
        }
    }, { quoted: m });
});
