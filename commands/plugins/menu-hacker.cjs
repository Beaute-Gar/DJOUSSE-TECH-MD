const { cmd, commands } = require('../command.cjs');
const config = require('../config-djousse.cjs');

const CMDS_PER_MSG = 35;

function fmtUptime(s) {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m ${Math.floor(s % 60)}s`;
}

function commandsGroup(cmds) {
    const cats = {};
    for (const c of cmds) {
        const cat = (c.category || 'OTHER').toUpperCase();
        if (!cats[cat]) cats[cat] = new Set();
        if (c.pattern && typeof c.pattern === 'string') cats[cat].add(c.pattern.toLowerCase());
        if (c.alias && Array.isArray(c.alias)) c.alias.forEach(a => cats[cat].add(String(a).toLowerCase()));
    }
    return cats;
}

function buildHeader(totalCmds) {
    const mem = (process.memoryUsage().rss / 1048576).toFixed(1);
    const up = fmtUptime(process.uptime());
    const num = config.OWNER_NUMBER || '';
    return [
        `╭───『 DJOUSSE TECH 』───●●►`,
        `┃ 📋 MENU — DJOUSSE TECH`,
        `┃ ┃ 👋 Salut : ${num}`,
        `┃ ┃ 📡 Uptime : ${up}`,
        `┃ ┃ 💾 RAM : ${mem} MB`,
        `┃ ┃ ⚡ Commandes : ${totalCmds}`,
        `╰─────────────❖●►`,
    ].join('\n');
}

function buildCategoryBlock(cat, cmds, page, totalPages) {
    const slice = cmds.slice((page - 1) * CMDS_PER_MSG, page * CMDS_PER_MSG);
    const lines = [`╭─「 ${cat} 」`];
    for (const c of slice) {
        lines.push(`┃✦ .${c}`);
    }
    if (totalPages > 1) {
        lines.push(`┃ 📄 Page ${page}/${totalPages}`);
        if (page < totalPages) lines.push(`┃ ➡ .menu ${cat.toLowerCase()} ${page + 1}`);
        if (page > 1) lines.push(`┃ ⬅ .menu ${cat.toLowerCase()} ${page - 1}`);
    }
    lines.push(`╰─────────────◉•►`);
    return lines.join('\n');
}

cmd({
    pattern: 'menu',
    alias: ['menuhacker', 'hackermenu', 'commands', 'cmd', 'help', 'h', 'm'],
    desc: 'Menu complet DJOUSSE TECH',
    category: 'main',
    filename: __filename,
}, async (conn, m, cmdList, ctx) => {
    try {
        const args = (ctx.args || []).map(a => a.toLowerCase());
        const grouped = commandsGroup(commands);
        const totalCmds = commands.length;

        if (args.length > 0) {
            const query = args[0].replace(/^\./, '').toUpperCase();
            const page = Math.max(1, parseInt(args[1]) || 1);

            let cat = Object.keys(grouped).find(c => c === query)
                || Object.keys(grouped).find(c => c.startsWith(query) || query.startsWith(c));

            if (!cat) {
                const available = Object.keys(grouped).sort().join(', ');
                return ctx.reply(`❌ Module \`${query}\` introuvable.\n\n📂 Modules:\n${available}`);
            }

            const cmds = [...grouped[cat]].sort();
            const totalPages = Math.ceil(cmds.length / CMDS_PER_MSG);
            const out = buildCategoryBlock(cat, cmds, page, totalPages);
            return ctx.reply(out);
        }

        const header = buildHeader(totalCmds);
        const catList = Object.keys(grouped).sort();
        const pages = [];

        for (const cat of catList) {
            const cmds = [...grouped[cat]].sort();
            pages.push(buildCategoryBlock(cat, cmds, 1, 1));
        }

        let currentMsg = header;
        const messages = [];

        for (const block of pages) {
            if (currentMsg.length + block.length + 10 > 3800) {
                messages.push(currentMsg);
                currentMsg = block;
            } else {
                currentMsg += '\n' + block;
            }
        }
        messages.push(currentMsg);

        for (const msg of messages) {
            await ctx.reply(msg);
        }
    } catch (e) {
        console.error('[MENU]', e.message);
        return ctx.reply('❌ Erreur menu: ' + e.message);
    }
});

cmd({
    pattern: 'allmenu',
    alias: ['fullmenu', 'allcmd'],
    desc: 'Affiche toutes les commandes par catégorie',
    category: 'main',
    filename: __filename,
}, async (conn, m, cmdList, ctx) => {
    try {
        const grouped = commandsGroup(commands);
        const totalCmds = commands.length;
        const header = buildHeader(totalCmds);
        const catList = Object.keys(grouped).sort();
        const pages = [];

        for (const cat of catList) {
            const cmds = [...grouped[cat]].sort();
            const totalPages = Math.ceil(cmds.length / CMDS_PER_MSG);
            for (let p = 1; p <= totalPages; p++) {
                pages.push(buildCategoryBlock(cat, cmds, p, totalPages));
            }
        }

        let currentMsg = header;
        const messages = [];

        for (const block of pages) {
            if (currentMsg.length + block.length + 10 > 3800) {
                messages.push(currentMsg);
                currentMsg = block;
            } else {
                currentMsg += '\n' + block;
            }
        }
        messages.push(currentMsg);

        for (const msg of messages) {
            await ctx.reply(msg);
        }
    } catch (e) {
        console.error('[ALLMENU]', e.message);
        return ctx.reply('❌ Erreur: ' + e.message);
    }
});
