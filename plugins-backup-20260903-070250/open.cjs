const { cmd } = require('../command.cjs');

cmd({
    pattern: 'open',
    aliases: [],
    desc: 'Ouvre le groupe',
    category: 'admin',
    filename: __filename,
}, async (conn, m, commands, config) => {
    await conn.sendMessage(m.chat, { text: '⚡ open — fonctionnalite a connecter (via AINORIA)' });
});
