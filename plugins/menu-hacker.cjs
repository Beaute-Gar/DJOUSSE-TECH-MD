const { cmd, commands } = require('../command.cjs');
const config = require('../config-djousse.cjs');

const CMD_PER_PAGE = 40;

function fmtUptime(s) {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m ${Math.floor(s % 60)}s`;
}

let _cachedGroup = null;
let _cachedCount = 0;
function commandsGroup(cmds) {
    if (_cachedGroup && _cachedCount === cmds.length) return _cachedGroup;
    const cats = {};
    for (const c of cmds) {
        const cat = (c.category || 'OTHER').toUpperCase();
        if (!cats[cat]) cats[cat] = new Set();
        if (c.pattern) cats[cat].add(c.pattern.toLowerCase());
        if (c.alias) c.alias.forEach(a => cats[cat].add(a.toLowerCase()));
    }
    _cachedGroup = cats;
    _cachedCount = cmds.length;
    return cats;
}

async function sendCategory(ctx, query, page) {
    const { reply } = ctx;
    const q = query.toUpperCase();
    const grouped = commandsGroup(commands);

    let cat = Object.keys(grouped).find(c => c === q)
        || Object.keys(grouped).find(c => c.startsWith(q) || q.startsWith(c));

    if (!cat) {
        const available = Object.keys(grouped).sort().join(', ');
        return reply(`❌ Module \`${query}\` introuvable.\n\n📂 Modules dispo:\n${available}`);
    }

    const cmds = [...grouped[cat]].sort();
    const totalPages = Math.ceil(cmds.length / CMD_PER_PAGE);
    const p = Math.min(page, totalPages);
    const slice = cmds.slice((p - 1) * CMD_PER_PAGE, p * CMD_PER_PAGE);

    const botName = (config.BOT_NAME || 'DJOUSSE-TECH-MD').toUpperCase();
    const line = '━'.repeat(30);

    let out = `╭──⍟『 ☣ ${cat} ☣ 』⍟─\n`;
    out += `┃ ▸ MOD: ${cmds.length} cmds | PAGE: ${p}/${totalPages}\n`;
    out += `┣${line}\n`;
    out += slice.map((c, i) => `┃▸ ${String((p - 1) * CMD_PER_PAGE + i + 1).padStart(3, '0')} \`.${c}\``).join('\n');
    out += `\n┣${line}\n`;
    if (p < totalPages) out += `┃▸ SUIVANT: \`.menu ${query.toLowerCase()} ${p + 1}\`\n`;
    if (p > 1) out += `┃▸ PRÉCÉDENT: \`.menu ${query.toLowerCase()} ${p - 1}\`\n`;
    out += `╰────────────⍟\n`;
    out += `> root@${botName.toLowerCase()}:~$ _`;

    await reply(out);
}

cmd({
    pattern: 'menu',
    alias: ['menuhacker', 'hackermenu', 'commands', 'cmd', 'aide', 'help', 'h', 'm'],
    desc: 'Menu hacker DJOUSSE-TECH-MD',
    category: 'main',
    filename: __filename,
}, async (conn, m, cmdList, ctx) => {
    const args = (ctx.args || []).map(a => a.toLowerCase());

    if (args.length > 0) {
        const query = args[0].replace(/^\./, '');
        const page = Math.max(1, parseInt(args[1]) || 1);
        return sendCategory(ctx, query, page);
    }

    try {
        const grouped = commandsGroup(commands);
        const catList = Object.keys(grouped).sort();
        const totalCmds = commands.length;
        const mem = (process.memoryUsage().rss / 1048576).toFixed(1);
        const up = fmtUptime(process.uptime());
        const botName = (config.BOT_NAME || 'DJOUSSE-TECH-MD').toUpperCase();

        const line = '━'.repeat(30);
        let out = `┏━⍟「 ☣ ${botName} ☣ 」⍟━┓\n`;
        out += `┃ ▸ STATUS : ONLINE 🟢\n`;
        out += `┃ ▸ RAM    : ${mem} MB\n`;
        out += `┃ ▸ UPTIME : ${up}\n`;
        out += `┃ ▸ CMDS   : ${totalCmds}\n`;
        out += `┣${line}\n`;
        out += `┃ ▚▞ ACCESS GRANTED — TOUS LES COMMANDES:\n`;
        out += `┣${line}\n`;

        let i = 0;
        for (const cat of catList) {
            i++;
            const cmds = [...grouped[cat]].sort();
            out += `\n┃▸ [${String(i).padStart(2, '0')}] ▸ ${cat} (${cmds.length})\n`;
            out += `┃  ${cmds.map(c => '.' + c).join(' | ')}\n`;
        }

        out += `┣${line}\n`;
        out += `┃▸ USAGE: \`.menu <module>\` pour détails\n`;
        out += `┗${line}⍟\n`;
        out += `> root@${botName.toLowerCase()}:~$ _\n`;
        out += `> © DJOUSSE TECH EVOLUTION`;

        await ctx.reply(out);
    } catch (e) {
        console.error('[MENU-HACKER]', e.message);
        return ctx.reply('❌ Erreur menu: ' + e.message);
    }
});

cmd({
    pattern: 'menulist',
    alias: ['categories', 'mods'],
    desc: 'Liste des modules',
    category: 'main',
    filename: __filename,
}, async (conn, m, cmdList, ctx) => {
    try {
        const cats = {};
        for (const c of commands) {
            const cat = (c.category || 'OTHER').toUpperCase();
            cats[cat] = (cats[cat] || 0) + 1;
        }
        const botName = (config.BOT_NAME || 'DJOUSSE-TECH-MD').toUpperCase();
        let out = `╭──⍟『 📂 ${botName} MODULES 』\n`;
        Object.keys(cats).sort().forEach((c, i) => {
            out += `┃▸ ${String(i + 1).padStart(2, '0')}. ${c} — ${cats[c]}\n`;
        });
        out += `╰────────────⍟\n`;
        out += `> \`.menu <module>\` pour ouvrir un module`;
        await ctx.reply(out);
    } catch (e) {
        return ctx.reply('❌ ' + e.message);
    }
});
