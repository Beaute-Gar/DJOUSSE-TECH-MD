const { cmd, commandMap } = require('../command.cjs');
const config = require('../config-djousse.cjs');
const path = require('path');
const fs = require('fs');
const { box } = require('../lib/djousse-ui.cjs');

// Bot images
const ASSETS_DIR = path.join(__dirname, '..', '..', 'assets');
const BOT_IMAGES = [
    path.join(ASSETS_DIR, 'bot1.png'),
    path.join(ASSETS_DIR, 'bot2.png'),
];
let menuImageIndex = 0;

function getNextMenuImage() {
    const available = BOT_IMAGES.filter(f => fs.existsSync(f));
    if (available.length === 0) return null;
    const img = available[menuImageIndex % available.length];
    menuImageIndex++;
    return img;
}

function fmtUptime(s) {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m ${Math.floor(s % 60)}s`;
}

function commandsGroup(input) {
    let list = [];
    if (input instanceof Map) {
        list = [...input.values()];
    } else if (Array.isArray(input)) {
        list = input;
    } else if (input && typeof input === 'object') {
        list = Object.values(input);
    }

    const cats = {};
    const seen = new Set();

    for (const c of list) {
        if (!c) continue;
        const name = c.name || c.pattern;
        if (!name || typeof name !== 'string') continue;
        if (seen.has(name)) continue;
        seen.add(name);

        let cat = c.category;
        if (!cat || typeof cat !== 'string') {
            cat = inferCategory(c.filename);
        }
        cat = cat.toUpperCase().trim();

        if (!cats[cat]) cats[cat] = new Set();
        cats[cat].add(name.toLowerCase());
    }

    for (const cat of Object.keys(cats)) {
        cats[cat] = [...cats[cat]].sort();
    }

    return cats;
}

function inferCategory(filename) {
    if (!filename) return 'OTHER';
    const path = String(filename).toLowerCase();
    if (path.includes('\\group\\') || path.includes('/group/')) return 'GROUP';
    if (path.includes('\\admin\\') || path.includes('/admin/')) return 'ADMIN';
    if (path.includes('\\ai\\') || path.includes('/ai/') || path.includes('ainoria')) return 'AI';
    if (path.includes('\\anime\\') || path.includes('/anime/')) return 'ANIME';
    if (path.includes('\\game\\') || path.includes('/game/')) return 'GAME';
    if (path.includes('\\download\\') || path.includes('/download/')) return 'DOWNLOAD';
    if (path.includes('\\image\\') || path.includes('/image/')) return 'IMAGE';
    if (path.includes('\\sticker\\') || path.includes('/sticker/')) return 'STICKER';
    if (path.includes('\\convert\\') || path.includes('/convert/')) return 'CONVERT';
    if (path.includes('\\tool\\') || path.includes('/tool/')) return 'TOOLS';
    if (path.includes('\\owner\\') || path.includes('/owner/')) return 'OWNER';
    if (path.includes('\\main\\') || path.includes('/main/')) return 'MAIN';
    if (path.includes('\\search\\') || path.includes('/search/')) return 'SEARCH';
    if (path.includes('\\fun\\') || path.includes('/fun/')) return 'FUN';
    if (path.includes('\\security\\') || path.includes('/security/')) return 'SECURITY';
    if (path.includes('\\moderation\\') || path.includes('/moderation/')) return 'MODERATION';
    if (path.includes('\\economy\\') || path.includes('/economy/')) return 'ECONOMY';
    if (path.includes('\\media\\') || path.includes('/media/')) return 'MEDIA';
    if (path.includes('\\info\\') || path.includes('/info/')) return 'INFO';
    if (path.includes('\\news\\') || path.includes('/news/')) return 'NEWS';
    if (path.includes('\\business\\') || path.includes('/business/')) return 'BUSINESS';
    return 'OTHER';
}

function buildHeader(totalCmds) {
    const mem = (process.memoryUsage().rss / 1048576).toFixed(1);
    const up = fmtUptime(process.uptime());
    const num = config.OWNER_NUMBER || '';
    return box('MENU — DJOUSSE TECH', [
        { label: '👋 Salut', value: num },
        { label: '📡 Uptime', value: up },
        { label: '💾 RAM', value: `${mem} MB` },
        { label: '⚡ Commandes', value: totalCmds },
    ]);
}

function buildCategoryBlock(cat, cmds) {
    const lines = [];
    for (const c of cmds) {
        lines.push({ raw: `⚡ \`.${c}\`` });
    }
    return box(`〔 ${cat} 〕`, lines);
}

cmd({
    pattern: 'menu',
    alias: ['menuhacker', 'hackermenu', 'commands', 'cmd', 'help', 'h', 'm'],
    desc: 'Menu complet DJOUSSE TECH',
    category: 'MAIN',
    filename: __filename,
}, async (conn, m, cmdList, ctx) => {
    try {
        const args = (ctx.args || []).map(a => a.toLowerCase());
        const grouped = commandsGroup(commandMap);
        const totalCmds = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);

        if (args.length > 0) {
            const query = args[0].replace(/^\./, '').toUpperCase();

            let cat = Object.keys(grouped).find(c => c === query)
                || Object.keys(grouped).find(c => c.startsWith(query) || query.startsWith(c));

            if (!cat) {
                const available = Object.keys(grouped).sort().join(', ');
                return ctx.reply(box('ERROR', [
                    { raw: `Module \`${query}\` introuvable.` },
                    { blank: true },
                    { raw: `📂 *Modules disponibles :*` },
                    { raw: available },
                ]));
            }

            const cmds = grouped[cat];
            return ctx.reply(buildCategoryBlock(cat, cmds));
        }

        const header = buildHeader(totalCmds);
        const catList = Object.keys(grouped).sort();
        const blocks = [];

        for (const cat of catList) {
            const cmds = grouped[cat];
            blocks.push(buildCategoryBlock(cat, cmds));
        }

        let currentMsg = header;
        const messages = [];

        for (const block of blocks) {
            if (currentMsg.length + block.length + 10 > 3800) {
                messages.push(currentMsg);
                currentMsg = block;
            } else {
                currentMsg += '\n' + block;
            }
        }
        messages.push(currentMsg);

        const imgPath = getNextMenuImage();
        for (let i = 0; i < messages.length; i++) {
            const msgContent = messages[i];
            if (i === 0 && imgPath) {
                try {
                    await conn.sendMessage(m.chat, {
                        image: { url: imgPath },
                        caption: msgContent,
                        mentions: [m.sender]
                    }, { quoted: m });
                } catch (e) {
                    await ctx.reply(msgContent);
                }
            } else {
                await ctx.reply(msgContent);
            }
        }
    } catch (e) {
        console.error('[MENU]', e.message);
        return ctx.reply(box('ERROR', [{ raw: `Erreur menu: ${e.message}` }]));
    }
});

cmd({
    pattern: 'allmenu',
    alias: ['fullmenu', 'allcmd'],
    desc: 'Affiche toutes les commandes par catégorie',
    category: 'MAIN',
    filename: __filename,
}, async (conn, m, cmdList, ctx) => {
    try {
        const grouped = commandsGroup(commandMap);
        const totalCmds = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);
        const header = buildHeader(totalCmds);
        const catList = Object.keys(grouped).sort();
        const blocks = [];

        for (const cat of catList) {
            const cmds = grouped[cat];
            blocks.push(buildCategoryBlock(cat, cmds));
        }

        let currentMsg = header;
        const messages = [];

        for (const block of blocks) {
            if (currentMsg.length + block.length + 10 > 3800) {
                messages.push(currentMsg);
                currentMsg = block;
            } else {
                currentMsg += '\n' + block;
            }
        }
        messages.push(currentMsg);

        const imgPath = getNextMenuImage();
        for (let i = 0; i < messages.length; i++) {
            const msgContent = messages[i];
            if (i === 0 && imgPath) {
                try {
                    await conn.sendMessage(m.chat, {
                        image: { url: imgPath },
                        caption: msgContent,
                        mentions: [m.sender]
                    }, { quoted: m });
                } catch (e) {
                    await ctx.reply(msgContent);
                }
            } else {
                await ctx.reply(msgContent);
            }
        }
    } catch (e) {
        console.error('[ALLMENU]', e.message);
        return ctx.reply(box('ERROR', [{ raw: `Erreur: ${e.message}` }]));
    }
});
