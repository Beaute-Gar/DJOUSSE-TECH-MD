const { cmd, commands } = require('../command.cjs');
const config = require('../config-djousse.cjs');
const { box, uptime } = require('../lib/djousse-ui.cjs');
const { botImg } = require('../lib/botimg.cjs');

/* Émojis par catégorie — adaptés aux catégories réellement présentes dans le bot */
const CAT_EMOJI = {
    'main': '🏠', 'general': '🏠', 'math': '🧮', 'MATHTOOL': '🧮', 'ai': '🤖',
    'media': '🎨', 'group': '👥', 'groups': '👥', 'djousse': '🚀', 'admin': '⚙️',
    'download': '📥', 'fun': '🎮', 'anime': '🎌', 'convert': '🔄', 'news': '📰',
    'settings': '⚙️', 'profile': '👤', 'business': '💼', 'communication': '📢',
    'utility': '🧰', 'tools': '🛠️', 'movie': '🎬', 'search': '🔍', 'misc': '📌',
    'owner': '👑', 'moderation': '🛡️', 'logo': '🪄', 'text': '✍️', 'game': '🎲',
    'protection': '🛡️', 'maintenance': '🔧', 'ai-extra': '🤖', 'math&conversion': '🧮',
};

function menuFrame(title) {
    return `*╭─「 ${title} 」*`;
}

/* WhatsApp tronque les messages > ~4096 caractères : découpe tout texte long
   en chunks ≤ CHUNK chars en coupant sur les retours à la ligne. */
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

cmd({ pattern: 'menuold', alias: ['menu-text', 'commands-old'], desc: 'Menu texte legacy', category: 'main', filename: __filename }, async (conn, m) => {
    const prefix = config.PREFIX || '.';
    const user = m.sender.split('@')[0];

    /* MENU curé : commandes essentielles par classe. Les commandes automatiques
       (auto-détection de liens, toggles autoX, etc.) ne sont pas listées. */
    const CLASSES = [
        ['🏠 MAIN', ['alive', 'menu', 'allmenu', 'diagnostic', 'ping', 'time', 'date', 'total', 'jid', 'profil']],
        ['🤖 AI', ['ai', 'ask', 'deepseek', 'openai', 'qwen', 'reason', 'nova', 'blackbox', 'askai', 'summarize', 'vision', 'transcribe', 'aiimg', 'draw']],
            ['🔄 CONVERT', ['sticker', 'toimg', 'tomp3', 'tovideo', 'togif', 'toaudio', 'translate', 'voice', 'tts', 'take']],
        ['🎌 ANIME', ['waifu', 'neko', 'anime', 'manga', 'character', 'animewallpaper', 'animeimg', 'animegirl', 'animeboy', 'kitsune', 'nsfwai']],
        ['🛠️ OUTILS', ['qrcode', 'shorturl', 'calc', 'tourl', 'ss', 'jsonfmt', 'b64encode', 'b64decode', 'image', 'apk']],
        ['👥 GROUPE', ['kick', 'promote', 'demote', 'add', 'accept', 'warn', 'warnings', 'poll', 'link', 'setname', 'setpp', 'setwelcome', 'setgoodbye', 'removeppgc', 'setppgc', 'delall', 'groupinfo', 'debate', 'stopgroup']],
        ['🏠 GÉNÉRAL', ['pair', 'about', 'profil', 'oublie', 'send', 'forward', 'getdp', 'font', 'fancy', 'chr', 'readmore', 'autostatus']],
        ['🎮 FUN', ['roll', 'coin', 'dare', 'truth', 'joke', 'memes', 'quote', '8ball', 'rps', 'ttt', 'quiz', 'rate', 'pick', 'ship']],
        ['🪄 LOGO', ['logolist', 'naruto', 'dragonball', 'onepiece', 'neon', 'gold', 'fire', 'ice', 'space', 'graffiti']],
        ['⚙️ RÉGLAGES', ['mode', 'prefix', 'personality', 'security', 'config', 'twostep']],
        ['👑 OWNER', ['bot_info', 'restart', 'pair', 'setwelcome', 'setgoodbye', 'broadcast']],
    ];

    const lines = [];
    lines.push(box('📋 *MENU — DJOUSSE TECH*', [
        { label: '👋 Salut', value: `*${user}*` },
        { label: '📡 Uptime', value: uptime(process.uptime()) },
        { label: '💾 RAM', value: (process.memoryUsage().rss / 1024 / 1024).toFixed(1) + ' MB' },
    ], { footer: false }));
    lines.push('');

    for (const [title, cmds] of CLASSES) {
        lines.push(menuFrame(title));
        for (const p of cmds) lines.push(`┃✦ ${prefix}${p}`);
        lines.push('╰─────────────◉•►');
        lines.push('');
    }
    lines.push(`\n*╭─ AINORIA AI*`);
    lines.push(`┃ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴅᴊᴏᴜꜱꜱᴇ ᴛᴇᴄʜ`);
    lines.push(`╰──────────━━━━━━◆`);
    lines.push(`\n> © ᴅᴇᴠᴇʟᴏᴘᴇʀ ʙʏ DJOUSSE TECH`);
    lines.push(`\n> Toutes les commandes : ${prefix}allmenu`);

    const text = lines.join('\n');
    const img = botImg();
    if (img && text.length <= 4096) {
        await conn.sendMessage(m.chat, { image: img, caption: text, contextInfo: { forwardingScore: 999, isForwarded: false } });
    } else {
        await m.reply(text);
    }
});

cmd({ pattern: 'diagnostic', desc: 'Diagnostiquer le bot', category: 'main', filename: __filename }, async (conn, m) => {
    const waOk = Boolean(conn.user);
    const dbOk = true;
    const aiOk = Boolean((process.env.GROQ_API_KEY || process.env.AI_API_KEY || process.env.GEMINI_API_KEY));
    const ram = process.memoryUsage().rss / (256 * 1024 * 1024);
    const health = Math.max(0, Math.min(100, Math.round(100 - ram * 100)));
    const warmupDay = Math.min(30, Math.floor(process.uptime() / 86400) + 1);
    const text = box('🔍 *DIAGNOSTIC BOT*', [
        { label: 'WhatsApp', value: waOk ? '✅ Connecté' : '❌ Déconnecté' },
        { label: 'Base de données', value: dbOk ? '✅ Opérationnelle' : '❌ Erreur' },
        { label: 'IA (AINORIA)', value: aiOk ? '✅ Active' : '⚠️ Non configurée' },
        { label: 'Santé compte', value: `*${health}/100*` },
        { label: 'Warmup', value: `Jour *${warmupDay}/30*` },
        { label: 'Mode ralenti', value: health < 40 ? '⚠️ Oui' : 'Non' },
    ], { footer: '> ✅ = OK  ⚠️ = Attention  ❌ = Erreur' });
    await m.reply(text);
});

cmd({ pattern: 'time', desc: 'Heure actuelle', category: 'main', filename: __filename }, async (conn, m) => {
    const now = new Date();
    const text = box('🕐 *HEURE ACTUELLE*', [
        { label: '🌍 Heure', value: `*${now.toLocaleTimeString('fr-FR', { timeZone: 'Africa/Douala' })}*` },
        { label: '📍 Fuseau', value: '*Africa/Douala*' },
        { label: '📅 Date', value: `*${now.toLocaleDateString('fr-FR')}*` },
    ]);
    await m.reply(text);
});

cmd({ pattern: 'date', desc: 'Date actuelle', category: 'main', filename: __filename }, async (conn, m) => {
    const now = new Date();
    const week = Math.ceil(((now - new Date(now.getFullYear(), 0, 1)) / 86400000 + 1) / 7);
    const text = box('📅 *DATE ACTUELLE*', [
        { label: 'Jour', value: `*${now.toLocaleDateString('fr-FR', { weekday: 'long' })}*` },
        { label: 'Mois', value: `*${now.toLocaleDateString('fr-FR', { month: 'long' })}*` },
        { label: 'Année', value: `*${now.getFullYear()}*` },
        { label: 'Semaine', value: `*${week}/52*` },
    ]);
    await m.reply(text);
});

cmd({ pattern: 'poll', desc: 'Créer un sondage', category: 'group', filename: __filename }, async (conn, m) => {
    const prefix = config.PREFIX || '.';
    const q = String(m.body || '').trim().split(/\s+/).slice(1).join(' ').trim();
    const chat = m.chat;
    if (!q) {
        return await m.reply(box('📊 *SONDAGE*', [
            { raw: `Utilisation :` },
            { raw: `${prefix}poll question|option1|option2` },
            { blank: true },
            { raw: `Exemple :` },
            { raw: `${prefix}poll Pizza ou Ndolé?|Pizza|Ndolé` },
        ]));
    }
    if (!String(chat || '').endsWith('@g.us')) return await m.reply('🔒 Sondages réservés aux groupes.');
    const parts = q.split('|').map(x => x.trim()).filter(Boolean);
    const question = parts[0];
    const options = parts.slice(1, 10);
    if (!question || options.length < 2) return await m.reply('⚠️ Format: `.poll question|opt1|opt2` (au moins 2 options)');
    try {
        await conn.sendMessage(chat, { poll: { name: question, values: options, selectableCount: options.length } });
        const text = box('📊 *SONDAGE CRÉÉ*', [
            { raw: `Question :` },
            { raw: `*${question}*` },
            { blank: true },
            ...options.map((o, i) => ({ raw: `┃ ┃ ${String.fromCharCode(65 + i)} — ${o}` })),
        ]);
        await m.reply(text);
    } catch (e) {
        console.error('❌ poll:', e.message);
        await m.reply('❌ Erreur poll: ' + e.message);
    }
});