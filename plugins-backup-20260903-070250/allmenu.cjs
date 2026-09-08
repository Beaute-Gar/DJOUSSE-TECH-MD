const { cmd, commands } = require('../command.cjs');
const { runtime } = require('../lib/functions.cjs');
const config = require('../config-djousse.cjs');

function chunkText(text, CHUNK = 3800) {
    if (text.length <= CHUNK) return [text];
    const parts = [];
    let rest = text;
    while (rest.length > CHUNK) {
        const cut = rest.lastIndexOf('\n', CHUNK);
        const idx = cut > 0 ? cut : CHUNK;
        parts.push(rest.slice(0, idx));
        rest = rest.slice(idx).replace(/^\n+/, '');
    }
    if (rest.trim()) parts.push(rest);
    return parts;
}

cmd({
    pattern: 'allmenu',
    alias: ['menu2', 'allcommands'],
    desc: 'Show all commands',
    category: 'main',
    filename: __filename,
}, async (conn, m, commands, config) => {
    const prefix = config.PREFIX || '.';
    const uptime = runtime(process.uptime());
    const user = m.sender.split('@')[0];
    const used = process.memoryUsage();
    const ram = (used.rss / 1024 / 1024).toFixed(2) + ' MB';

    const EXCLUDED = /^download$/i;

    const categories = {};
    const seenPatterns = new Set();
    let cmdNumTotal = 0;
    for (const cmd of commands) {
        if (cmd.dontAddCommandList) continue;
        if (typeof cmd.pattern !== 'string') continue;
        const pattern = cmd.pattern.toLowerCase();
        if (seenPatterns.has(pattern)) continue;
        seenPatterns.add(pattern);
        const cat = cmd.category || 'misc';
        if (EXCLUDED.test(String(cat))) continue;
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(cmd);
        cmdNumTotal++;
    }

    let menuText = `👋 Hello, *${user}* 🫟
╭───『 *DJOUSSE TECH* 』───●●►
┃ *📡 ʀᴜɴᴛɪᴍᴇ:* ${uptime}
┃ *💾 ʀᴀᴍ:* ${ram}
┃ *⚡ ᴄᴍᴅs:* ${cmdNumTotal} (liens auto-téléchargés)
╰─────────────❖●►

`;

    const emojiMap = {
        main: '✨', general: '🏠', group: '👥', ai: '🤖',
        misc: '⚙️', owner: '👑', fun: '🎮', search: '🔍',
        anime: '🎌', convert: '🔄', news: '📰', settings: '⚙️', media: '🎨',
        admin: '🛡️', moderation: '👥', game: '🎲', logo: '🎨',
        profile: '👤', business: '💼', communication: '📢', utility: '🧰',
        tools: '🛠️', djousse: '🌸', movie: '🎬', mathtool: '🧮',
    };

    let cmdNum = 1;
    const sortedCats = Object.keys(categories).sort();
    for (const cat of sortedCats) {
        const emoji = emojiMap[cat] || '📌';
        menuText += `*╭─「 ${emoji} ${cat.toUpperCase()} 」*\n`;
        for (const c of categories[cat]) {
            const pattern = typeof c.pattern === 'string' ? c.pattern : 'cmd';
            menuText += `┃❖ *${String(cmdNum).padStart(2, '0')}* ${prefix}${pattern}\n`;
            cmdNum++;
        }
        menuText += `╰─────────────❖●►\n\n`;
    }

    menuText += `*╭─「 ᴀɪɴᴏʀɪᴀ ᴀɪ 」*\n┃ *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴅᴊᴏᴜꜱꜱᴇ ᴛᴇᴄʜ*\n╰──────────❖✦►\n\n> © ᴅᴇᴠᴇʟᴏᴘᴇʀ ʙʏ DJOUSSE TECH`;

    const chunks = chunkText(menuText);
    for (const chunk of chunks) {
        await conn.sendMessage(m.chat, { text: chunk });
    }
});
