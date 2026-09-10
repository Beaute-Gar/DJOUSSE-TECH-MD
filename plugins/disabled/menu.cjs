const { cmd, commands } = require('../command.cjs');
const config = require('../config-djousse.cjs');
const os = require('os');

function fmtUptime(s) {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
    return h > 0 ? `${h}h ${m}m ${sec}s` : m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function hackerMenu(categories, total, ram, uptime, botName, ownerName) {
    const line = '═'.repeat(36);
    return `┏━⍟「 ☣ ${botName.toUpperCase()} ☣ 」⍟━┓
┃ ▸ sys.status   : ONLINE 🟢
┃ ▸ sys.owner    : ${ownerName}
┃ ▸ sys.ram      : ${ram}
┃ ▸ sys.uptime   : ${uptime}
┃ ▸ cmd.total    : ${total}
┣${line}
┃ ▚▞ ACCESS GRANTED — MODULES:
┗${line}`;
}

function categoryBlock(cat, cmds) {
    let out = `╭──⍟『 ${cat} [${cmds.length}] 』\n`;
    out += cmds.map((c, i) => `┃▸ ${String(i + 1).padStart(2, '0')} \`.${c}\``).join('\n');
    out += `\n╰────────────⍟`;
    return out;
}

cmd({
    pattern: 'menu',
    alias: ['commands', 'cmd', 'aide', 'help', 'h', 'm'],
    desc: 'Menu hacker DJOUSSE-TECH-MD',
    category: 'main',
    filename: __filename,
}, async (conn, m, commands, ctx) => {
    const args = (ctx.args || []).map(a => a.toLowerCase());
    const cats = {};
    let total = 0;

    for (const c of commands) {
        const cat = (c.category || 'other').toUpperCase();
        if (!cats[cat]) cats[cat] = [];
        if (c.pattern) { cats[cat].push(c.pattern.toLowerCase()); total++; }
        if (c.alias) {
            for (const a of c.alias) { cats[cat].push(a.toLowerCase()); total++; }
        }
    }
    for (const k of Object.keys(cats)) cats[k] = [...new Set(cats[k])].sort();

    const ram = (process.memoryUsage().rss / 1048576).toFixed(1) + ' MB';
    const uptime = fmtUptime(process.uptime());
    const botName = config.BOT_NAME || 'DJOUSSE-TECH-MD';
    const ownerName = config.OWNER_NAME || 'DJOUSSSE';

    // .menu <catégorie> → affiche une seule catégorie
    if (args.length > 0) {
        const target = args[0].toUpperCase();
        const found = Object.keys(cats).find(c => c === target || c.includes(target));
        if (!found) {
            return m.reply(`❌ Module « ${args[0]} » introuvable.\n\nModules: ${Object.keys(cats).join(', ')}`);
        }
        const header = hackerMenu(cats, total, ram, uptime, botName, ownerName);
        const block = categoryBlock(found, cats[found]);
        return m.reply(`${header}\n\n${block}\n\n> root@${botName.toLowerCase()}:~$ _\n> © DJOUSSE TECH EVOLUTION`);
    }

    // .menu sans argument → liste des catégories + lien web
    const header = hackerMenu(cats, total, ram, uptime, botName, ownerName);
    let catList = Object.keys(cats).sort().map(c =>
        `┃▸ .menu ${c.toLowerCase().padEnd(12)} [${cats[c].length} cmds]`
    ).join('\n');

    const msg = `${header}
┃
${catList}
┃
┃ 💡 Tape *.menu <module>* pour voir les commandes
┃ 🌐 Menu web: https://djousse-tech-md.onrender.com/menu
┗${'═'.repeat(36)}

> root@${botName.toLowerCase()}:~$ _
> © DJOUSSE TECH EVOLUTION`;

    return m.reply(msg);
});
