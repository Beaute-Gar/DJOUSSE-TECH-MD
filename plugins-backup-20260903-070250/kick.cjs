const { cmd } = require('../command.cjs');

cmd({
    pattern: 'kick',
    aliases: [],
    desc: 'Expulse un membre',
    category: 'admin',
    filename: __filename,
}, async (conn, m, commands, config) => {
    await conn.sendMessage(m.chat, { text: '⚡ kick — fonctionnalite a connecter (via AINORIA)' });
});
