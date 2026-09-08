const config = require('../config-djousse.cjs');

module.exports = {
    fakevCard: {
        key: {
            fromMe: false,
            participant: "0@s.whatsapp.net",
            remoteJid: "status@broadcast"
        },
        message: {
            contactMessage: {
                displayName: "© DJOUSSE-TECH-MD",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:Meta\nORG:META AI;\nTEL;type=CELL;type=VOICE;waid=237000000000:+237000000000\nEND:VCARD`
            }
        }
    }
};
