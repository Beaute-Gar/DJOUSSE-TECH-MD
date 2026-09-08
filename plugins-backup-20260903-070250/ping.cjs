const { cmd } = require('../command.cjs');
const { box, uptime } = require('../lib/djousse-ui.cjs');
const os = require('os');

cmd({
    pattern: 'ping',
    desc: 'Vérifier la latence',
    category: 'main',
    filename: __filename,
}, async (conn, m) => {
    const start = Date.now();
    const msg = await conn.sendMessage(m.chat, { text: '🏓 Pinging...' });
    const latency = Date.now() - start;
    const text = box('🏓 *PING — LATENCE*', [
        { label: 'Statut', value: '✅ En ligne' },
        { label: 'Latence', value: `*${latency}ms*` },
        { label: 'Serveur', value: `*${os.hostname() || 'Render'}*` },
        { label: 'Uptime', value: `*${uptime(process.uptime())}*` },
    ]);
    /* Édition tolérante : si elle échoue, on envoie le résultat en message neuf —
       une erreur secondaire ne doit jamais faire échouer la commande. */
    try {
        await conn.sendMessage(m.chat, { text, edit: msg.key });
    } catch (e) {
        await conn.sendMessage(m.chat, { text });
    }
});
