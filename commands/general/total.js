const { cmd, commands } = require('../command.cjs');
const config = require('../config-djousse.cjs');
const { randomImage } = require('../lib/images.cjs');

cmd({
    pattern: 'total',
    desc: 'Nombre total de commandes',
    category: 'main',
    filename: __filename,
}, async (conn, m) => {
    const manual = commands.filter(c => c.pattern);
    const auto = commands.filter(c => !c.pattern);
    const categories = {};
    for (const c of manual) {
        const cat = (c.category || 'other').toUpperCase();
        if (!categories[cat]) categories[cat] = 0;
        categories[cat]++;
    }
    const catList = Object.entries(categories)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, count]) => `┃ ✦ ${cat} : ${count}`)
        .join('\n');

    const text = `╭───『 📊 TOTAL 』───●●►
┃ 🟢 *Manuelles* : ${manual.length}
┃ ⚡ *Automatiques* : ${auto.length}
┃ 📌 *Total* : ${commands.length}
╰─────────────❖●►
╭─「 PAR CATÉGORIE 」
${catList}
╰─────────────◉•►
> ᴘᴏᴡᴇʀᴇᴅ ʙʏ DJOUSSE TECH`;

    try {
        await conn.sendMessage(m.chat, { image: { url: randomImage() }, caption: text }, { quoted: m });
    } catch (_) {
        await m.reply(text);
    }
});
