const { cmd, commands } = require('../command.cjs');
const { runtime } = require('../lib/functions.cjs');
const config = require('../config.cjs');
const fs = require('fs');
const path = require('path');

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

    /* ── Collect CJS commands ── */
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
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push({ pattern, desc: cmd.desc || '' });
        cmdNumTotal++;
    }

    /* ── Collect ESM (N-main) commands ── */
    const esmPlugins = global.__esmPlugins || [];
    for (const esm of esmPlugins) {
        try {
            const content = require('fs').readFileSync(require('path').join(__dirname, esm.file), 'utf8');
            /* Extract validCommands arrays */
            const validMatch = content.match(/validCommands\s*=\s*\[([^\]]+)\]/g);
            if (validMatch) {
                for (const vm of validMatch) {
                    const cmds = vm.match(/\[([^\]]+)\]/)[1].replace(/['"]/g, '').split(',').map(s => s.trim());
                    for (const c of cmds) {
                        const pattern = c.toLowerCase();
                        if (!seenPatterns.has(pattern)) {
                            seenPatterns.add(pattern);
                            if (!categories['nmain']) categories['nmain'] = [];
                            categories['nmain'].push({ pattern, desc: '' });
                            cmdNumTotal++;
                        }
                    }
                }
            }
            /* Extract cmd === patterns */
            const cmdMatches = content.match(/cmd\s*===?\s*['"]([^'"]+)['"]/g);
            if (cmdMatches) {
                for (const cm of cmdMatches) {
                    const pattern = cm.match(/['"]([^'"]+)['"]/)[1].toLowerCase();
                    if (!seenPatterns.has(pattern)) {
                        seenPatterns.add(pattern);
                        if (!categories['nmain']) categories['nmain'] = [];
                        categories['nmain'].push({ pattern, desc: '' });
                        cmdNumTotal++;
                    }
                }
            }
        } catch {}
    }

    let menuText = `👋 Hello, *${user}*
╭───『 *DJOUSSE-TECH-MD* 』───●●►
┃ *📡 ʀᴜɴᴛɪᴍᴇ:* ${uptime}
┃ *💾 ʀᴀᴍ:* ${ram}
┃ *⚡ ᴄᴍᴅs:* ${cmdNumTotal}
╰─────────────❖●►

`;

    const emojiMap = {
        main: '✨', general: '🏠', group: '👥', ai: '🤖',
        misc: '⚙️', owner: '👑', fun: '🎮', search: '🔍',
        anime: '🎌', convert: '🔄', news: '📰', settings: '⚙️', media: '🎨',
        admin: '🛡️', moderation: '👥', game: '🎲', logo: '🎨',
        profile: '👤', business: '💼', communication: '📢', utility: '🧰',
        tools: '🛠️', djousse: '🌸', movie: '🎬', mathtool: '🧮',
        nmain: '🔥', 'ANTISPAM': '🚫',
    };

    let cmdNum = 1;
    const sortedCats = Object.keys(categories).sort();
    for (const cat of sortedCats) {
        const emoji = emojiMap[cat] || '📌';
        menuText += `*╭─「 ${emoji} ${cat.toUpperCase()} 」*\n`;
        for (const c of categories[cat]) {
            menuText += `┃❖ *${String(cmdNum).padStart(2, '0')}* ${prefix}${c.pattern}\n`;
            cmdNum++;
        }
        menuText += `╰─────────────❖●►\n\n`;
    }

    menuText += `*╭─「 DJOUSSE TECH 」*\n┃ *ᴘᴏᴡᴇʀᴇᴅ ʙʏ DJOUSSE TECH*\n╰──────────❖✦►\n\n> © DJOUSSE TECH EVOLUTION`;

    const chunks = chunkText(menuText);
    for (const chunk of chunks) {
        await conn.sendMessage(m.chat, { text: chunk });
    }
});
