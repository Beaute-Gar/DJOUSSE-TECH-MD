const { cmd } = require('../command.cjs');

cmd({
    pattern: 'link',
    aliases: [],
    desc: 'Génère un lien WhatsApp',
    category: 'general',
    filename: __filename,
}, async (conn, m, commands, config) => {
    await conn.sendMessage(m.chat, { text: '⚡ link — fonctionnalite a connecter (via AINORIA)' });
});
