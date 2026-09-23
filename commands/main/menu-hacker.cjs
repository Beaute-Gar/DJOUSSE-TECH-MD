const { cmd, commandMap } = require('../command.cjs');
const config = require('../config-djousse.cjs');
const path = require('path');
const fs = require('fs');

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
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    if (h > 0) return `${h}h ${m}m ${sec}s`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
}

function inferCategory(filename) {
    if (!filename) return 'OTHER';
    const p = String(filename).toLowerCase();
    if (p.includes('\\group\\') || p.includes('/group/')) return 'GROUP';
    if (p.includes('\\admin\\') || p.includes('/admin/')) return 'ADMIN';
    if (p.includes('\\ai\\') || p.includes('/ai/') || p.includes('ainoria')) return 'AI';
    if (p.includes('\\download\\') || p.includes('/download/')) return 'DOWNLOAD';
    if (p.includes('\\convert\\') || p.includes('/convert/')) return 'CONVERT';
    if (p.includes('\\owner\\') || p.includes('/owner/')) return 'OWNER';
    if (p.includes('\\main\\') || p.includes('/main/')) return 'MAIN';
    if (p.includes('\\search\\') || p.includes('/search/')) return 'SEARCH';
    if (p.includes('\\fun\\') || p.includes('/fun/')) return 'FUN';
    if (p.includes('\\security\\') || p.includes('/security/')) return 'SECURITY';
    if (p.includes('\\moderation\\') || p.includes('/moderation/')) return 'MODERATION';
    if (p.includes('\\economy\\') || p.includes('/economy/')) return 'ECONOMY';
    if (p.includes('\\media\\') || p.includes('/media/')) return 'MEDIA';
    if (p.includes('\\info\\') || p.includes('/info/')) return 'INFO';
    if (p.includes('\\business\\') || p.includes('/business/')) return 'BUSINESS';
    if (p.includes('\\tool\\') || p.includes('/tool/')) return 'TOOLS';
    if (p.includes('\\sticker\\') || p.includes('/sticker/')) return 'STICKER';
    if (p.includes('\\image\\') || p.includes('/image/')) return 'IMAGE';
    if (p.includes('\\logo\\') || p.includes('/logo/')) return 'LOGO';
    if (p.includes('\\profile\\') || p.includes('/profile/')) return 'PROFILE';
    if (p.includes('\\settings\\') || p.includes('/settings/')) return 'SETTINGS';
    if (p.includes('\\system\\') || p.includes('/system/')) return 'SYSTEM';
    if (p.includes('\\util\\') || p.includes('/util/') || p.includes('utility')) return 'UTILITY';
    return 'OTHER';
}

function buildCommandsGroup(input) {
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
        if (!cat) cat = 'OTHER';

        const aliases = Array.isArray(c.aliases) ? c.aliases.filter(a => a && typeof a === 'string') : [];

        if (!cats[cat]) cats[cat] = [];
        cats[cat].push({ name: name.toLowerCase(), aliases: aliases.map(a => a.toLowerCase()) });
    }

    for (const cat of Object.keys(cats)) {
        cats[cat].sort((a, b) => a.name.localeCompare(b.name));
    }

    return cats;
}

function safeStr(val, fallback = '') {
    if (val === null || val === undefined) return fallback;
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
}

function validateMenu(text) {
    if (!text || typeof text !== 'string') return false;
    if (text.includes('undefined')) return false;
    if (text.includes('[object Object]')) return false;
    if (text.includes('null')) return false;
    return true;
}

function buildMenuText(grouped) {
    const lines = [];
    const userNum = safeStr(config.OWNER_NUMBER, 'Owner');
    const uptime = fmtUptime(process.uptime());
    const mem = (process.memoryUsage().rss / 1048576).toFixed(1);
    const totalCmds = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);

    lines.push('╭━━━〔 ⛓️ DJOUSSE TECH 〕━━━╮');
    lines.push(`┃ 👋 Salut : ${userNum}`);
    lines.push(`┃ 📡 Uptime : ${uptime}`);
    lines.push(`┃ 💾 RAM : ${mem} MB`);
    lines.push(`┃ ⚡ Commandes : ${totalCmds}`);
    lines.push('╰━━━━━━━━━━━━━━━━━━━━━━╯');
    lines.push('');

    const catList = Object.keys(grouped).sort();

    for (const cat of catList) {
        const cmds = grouped[cat];
        lines.push(`╭─〔 ${cat} 〕`);
        for (const entry of cmds) {
            const allNames = [entry.name, ...entry.aliases];
            const display = allNames.map(n => `.${n}`).join(' | ');
            lines.push(`│ ⚡ ${display}`);
        }
        lines.push('╰──────────────────────');
    }

    lines.push('');
    lines.push('╭━━━〔 ⛓️ DJOUSSE TECH 〕━━━╮');
    lines.push(`┃ 📦 ${totalCmds} commandes disponibles`);
    lines.push('┃ 💡 Tape .help <commande>');
    lines.push('┃ 🚀 Bot opérationnel');
    lines.push('╰━━━━━━━━━━━━━━━━━━━━━━╯');

    return lines.join('\n');
}

cmd({
    pattern: 'menu',
    desc: 'Menu interactif DJOUSSE TECH (boutons + navigation)',
    category: 'MAIN',
    filename: __filename,
}, async (conn, m, cmdList, ctx) => {
    try {
        const args = (ctx.args || []).map(a => a.toLowerCase());

        // Recherche texte : .menu <module> → liste texte du module
        if (args.length > 0) {
            const grouped = buildCommandsGroup(commandMap);
            const query = args[0].replace(/^\./, '').toUpperCase();
            let cat = Object.keys(grouped).find(c => c === query)
                || Object.keys(grouped).find(c => c.startsWith(query) || query.startsWith(c));

            if (!cat) {
                const available = Object.keys(grouped).sort().join(', ');
                return ctx.reply(
                    '╭━━━〔 ❌ ERROR 〕━━━╮\n' +
                    `┃ Module \`${query}\` introuvable.\n` +
                    '╰━━━━━━━━━━━━━━━━━━━━━━╯\n\n' +
                    `📂 *Modules disponibles :*\n${available}`
                );
            }

            const cmds = grouped[cat];
            const catLines = [];
            catLines.push(`╭─〔 ${cat} 〕`);
            for (const entry of cmds) {
                const allNames = [entry.name, ...entry.aliases];
                const display = allNames.map(n => `.${n}`).join(' | ');
                catLines.push(`│ ⚡ ${display}`);
            }
            catLines.push('╰──────────────────────');
            return ctx.reply(catLines.join('\n'));
        }

        // Menu principal : HYBRIDE interactif (image + texte numéroté + boutons)
        const { buildMainMenu } = require('../lib/buttons/menuBuilder');
        await buildMainMenu(conn, m.chat, m, 1);
    } catch (e) {
        console.error('[MENU]', e.message);
        return ctx.reply('⚠️ Erreur menu: ' + safeStr(e.message, 'inconnue'));
    }
});

cmd({
    pattern: 'allmenu',
    desc: 'Affiche toutes les commandes par catégorie',
    category: 'MAIN',
    filename: __filename,
}, async (conn, m, cmdList, ctx) => {
    try {
        const grouped = buildCommandsGroup(commandMap);
        const menuText = buildMenuText(grouped);

        if (!validateMenu(menuText)) {
            return ctx.reply('⚠️ Erreur de génération du menu.');
        }

        const imgPath = getNextMenuImage();
        if (imgPath) {
            try {
                await conn.sendMessage(m.chat, {
                    image: { url: imgPath },
                    caption: menuText,
                    mentions: [m.sender]
                }, { quoted: m });
                return;
            } catch (e) {
                // fallback
            }
        }

        await ctx.reply(menuText);
    } catch (e) {
        console.error('[ALLMENU]', e.message);
        return ctx.reply('⚠️ Erreur: ' + safeStr(e.message, 'inconnue'));
    }
});
