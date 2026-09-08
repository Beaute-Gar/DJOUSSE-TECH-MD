const { cmd, commands } = require('../command.cjs');

cmd({
    pattern: 'total',
    desc: 'Affiche le nombre total de commandes',
    category: 'main',
    filename: __filename,
}, async (conn, m) => {
    const manual = commands.filter(c => c.pattern);
    const auto = commands.filter(c => !c.pattern);
    const categories = {};
    for (const c of manual) {
        const cat = c.category || 'misc';
        if (!categories[cat]) categories[cat] = 0;
        categories[cat]++;
    }
    const catList = Object.entries(categories)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, count]) => `  • ${cat}: ${count}`)
        .join('\n');

    await conn.sendMessage(m.chat, {
        text: `📊 *COMMANDES DÉCOMPTE*\n\n` +
            `🟢 *Manuelles (préfixe .)* : ${manual.length}\n` +
            `⚡ *Automatiques (features)* : ${auto.length}\n` +
            `📌 *Total* : ${commands.length}\n\n` +
            `── *Par catégorie* ──\n${catList}\n\n` +
            `> DJOUSSE TECH MD v2.0 — DJOUSSE-TECH + AINORIA`
    });
});
