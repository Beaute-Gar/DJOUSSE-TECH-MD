const { cmd } = require('../command.cjs');

cmd({
    pattern: 'speak',
    aliases: [],
    desc: 'Texte vers vocal',
    category: 'general',
    filename: __filename,
}, async (conn, m, commands, config) => {
    await conn.sendMessage(m.chat, { text: '⚡ speak — fonctionnalite a connecter (via AINORIA)' });
});
