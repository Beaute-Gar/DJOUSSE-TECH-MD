const { cmd } = require('../command.cjs');
const { sendMainMenu } = require('../src/menu-professionnel.cjs');

cmd({
    pattern: 'menu',
    alias: ['commands', 'cmd', 'aide', 'help', 'h', 'm'],
    desc: 'Menu interactif premium DJOUSSE TECH',
    category: 'main',
    filename: __filename,
}, async (conn, m) => {
    await sendMainMenu(conn, m);
});
