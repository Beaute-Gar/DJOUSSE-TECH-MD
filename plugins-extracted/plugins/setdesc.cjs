const { cmd } = require('../command.cjs');

cmd({
    pattern: 'setdesc',
    aliases: [],
    desc: 'Change la description',
    category: 'admin',
    filename: __filename,
}, async (conn, m, commands, config) => {
    await conn.sendMessage(m.chat, { text: '⚡ setdesc — fonctionnalite a connecter (via AINORIA)' });
});
