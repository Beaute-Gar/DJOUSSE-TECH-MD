const { cmd } = require('../command.cjs');

cmd({
    pattern: 'upload',
    aliases: [],
    desc: 'Upload de fichier',
    category: 'tools',
    filename: __filename,
}, async (conn, m, commands, config) => {
    await conn.sendMessage(m.chat, { text: '⚡ upload — fonctionnalite a connecter (via AINORIA)' });
});
