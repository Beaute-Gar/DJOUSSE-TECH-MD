const { cmd } = require('../command.cjs');
const config = require('../config-djousse.cjs');
const { randomImage } = require('../lib/images.cjs');
const { t } = require('../lib/i18n.cjs');
const style = require('../lib/style.cjs');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { runtime } = require('../lib/functions.cjs');

cmd({
    pattern: "alive",
    desc: "Check bot alive status",
    category: "main",
    react: "💚",
    filename: __filename
}, async (conn, m, commands, { from, reply }) => {
    try {
        const start = Date.now();
        await conn.sendMessage(from, { react: { text: "⚡", key: m.key } });
        const end = Date.now();
        const pingTime = end - start;

        const botName = config.BOT_NAME || 'DJOUSSE-TECH-MD';
        const botNumber = conn.user.id.split(':')[0];
        const ownerNumber = config.OWNER_NUMBER || config.BOT_OWNER || '';
        const liveMsg = config.LIVE_MSG || 'I am active and running';
        const aliveImage = config.ALIVE_IMG || config.MENU_IMAGE_URL || randomImage();

        const usedMemory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
        const totalMemory = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
        const cpuUsage = os.loadavg()[0].toFixed(1);
        const uptime = runtime(process.uptime());

        let statusEmoji = "🟢", statusText = 'FAST';
        if (pingTime > 500) { statusEmoji = "🟡"; statusText = 'SLOW'; }
        else if (pingTime > 200) { statusEmoji = "🟠"; statusText = 'GOOD'; }

        const message = style.box(botName, [
            `ALIVE: ${liveMsg} ${statusEmoji}`,
            `RESPONSE: ${pingTime}ms`,
            `STATUS: ${statusText}`,
            `BOT: ${botName}`,
            `OWNER: ${ownerNumber}`,
            `NUMBER: ${botNumber}`,
            `RAM: ${usedMemory}MB / ${totalMemory}GB`,
            `CPU: ${cpuUsage}%`,
            `MODE: 🟢 ${config.MODE || 'public'}`,
            `UPTIME: ${uptime}`
        ]) + `\n\n> ${config.BOT_FOOTER || '© DJOUSSE TECH EVOLUTION'}`;

        const imageSource = /^https?:\/\//i.test(aliveImage)
            ? { url: aliveImage }
            : fs.existsSync(path.resolve(aliveImage))
                ? fs.readFileSync(path.resolve(aliveImage))
                : { url: randomImage() };

        try {
            await conn.sendMessage(from, { image: imageSource, caption: message }, { quoted: m });
        } catch (mediaError) {
            await reply(message);
        }

        if (pingTime < 200) await conn.sendMessage(from, { react: { text: "✅", key: m.key } });
        else if (pingTime < 500) await conn.sendMessage(from, { react: { text: "⚠️", key: m.key } });
        else await conn.sendMessage(from, { react: { text: "🐌", key: m.key } });

    } catch (error) {
        console.error("ALIVE COMMAND ERROR:", error);
        await reply(style.error(`Error: ${error.message}`));
    }
});
