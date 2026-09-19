const { cmd } = require('../command.cjs');
const config = require('../config-djousse.cjs');
const { t } = require('../lib/i18n.cjs');
const { randomImage } = require('../lib/images.cjs');
const { box } = require('../lib/djousse-ui.cjs');

cmd({
    pattern: "repo",
    alias: ["sc", "sourcecode", "github"],
    desc: "Show the bot's repository link",
    category: "main",
    react: "📦",
    filename: __filename
}, async (conn, m, commands, { from, reply }) => {
    try {
        const repoUrl = config.REPO_URL || 'https://github.com/Beaute-Gar/DJOUSSE-TECH-MD';
        return conn.sendMessage(from, { image: { url: randomImage() }, caption: box('REPO', [
            'To pair the bot, open this link:',
            { raw: repoUrl },
        ]) }, { quoted: m });
    } catch (error) {
        console.error('REPO ERROR:', error);
        reply(box('REPO', [{ raw: 'Error' }]));
    }
});
