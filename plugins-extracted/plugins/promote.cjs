const { cmd } = require('../command.cjs');

cmd({
    pattern: 'promote',
    aliases: [],
    desc: 'Promeut un admin',
    category: 'admin',
    filename: __filename,
}, async (conn, m, commands, config) => {
    await conn.sendMessage(m.chat, { text: '⚡ promote — fonctionnalite a connecter (via AINORIA)' });
});
