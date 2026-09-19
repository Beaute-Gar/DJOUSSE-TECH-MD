'use strict';

const { cmd } = require('../command.cjs');
const fs = require('fs');
const path = require('path');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

// ─── Group stats storage ─────────────────────────────────────────
const STATS_FILE = path.join(__dirname, '..', 'data', 'group-stats.json');

function loadStats() {
    try {
        fs.mkdirSync(path.dirname(STATS_FILE), { recursive: true });
        return JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));
    } catch { return {}; }
}

function saveStats(data) {
    fs.mkdirSync(path.dirname(STATS_FILE), { recursive: true });
    fs.writeFileSync(STATS_FILE, JSON.stringify(data, null, 2));
}

// ─── Track un message ────────────────────────────────────────────
function trackMessage(chat, sender, time) {
    const stats = loadStats();
    const today = new Date(time).toISOString().split('T')[0];
    const hour = new Date(time).getHours();

    if (!stats[chat]) {
        stats[chat] = { messages: {}, links: 0, media: 0, days: {}, hours: {} };
    }
    const cs = stats[chat];

    // Par membre
    const clean = sender.replace(/[^0-9]/g, '');
    if (!cs.messages[clean]) cs.messages[clean] = 0;
    cs.messages[clean]++;

    // Par jour
    if (!cs.days[today]) cs.days[today] = 0;
    cs.days[today]++;

    // Par heure
    const h = `${hour}:00`;
    if (!cs.hours[h]) cs.hours[h] = 0;
    cs.hours[h]++;

    saveStats(stats);
}

// ─── .groupstats ─────────────────────────────────────────────────
cmd({
    pattern: 'groupstats',
    alias: ['gstats', 'statsgroupe'],
    desc: 'Statistiques du groupe',
    category: 'group',
    filename: __filename
}, async (conn, m, commands, { reply, isGroup }) => {
    if (!isGroup) return reply(boxWithFooter('ERREUR', [{ raw: '❌ Cette commande est pour les groupes.' }]));

    const stats = loadStats();
    const cs = stats[m.chat];

    if (!cs || Object.keys(cs.messages).length === 0) {
        return reply(boxWithFooter('INFO', [{ raw: '📊 Aucune donnée pour ce groupe.' }]));
    }

    // Total messages
    const total = Object.values(cs.messages).reduce((a, b) => a + b, 0);

    // Top membres
    const sorted = Object.entries(cs.messages).sort((a, b) => b[1] - a[1]);
    const top5 = sorted.slice(0, 5);
    const topList = top5.map(([num, count], i) => {
        const pct = Math.round(count / total * 100);
        const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
        return `┃ ${i + 1}. @${num}\n┃    ${bar} ${count} (${pct}%)`;
    }).join('\n');

    // Jour le plus actif
    const topDay = Object.entries(cs.days).sort((a, b) => b[1] - a[1])[0];

    // Heure de pointe
    const topHour = Object.entries(cs.hours).sort((a, b) => b[1] - a[1])[0];

    // Nombre de membres actifs
    const activeMembers = sorted.length;

    const mentions = top5.map(([num]) => num + '@s.whatsapp.net');

    return reply(
        box('GROUP STATS', [
            '☣ GROUP STATS ☣',
            '',
            '👥 Membres actifs: ' + activeMembers,
            '📨 Total messages: ' + total.toLocaleString(),
            '📅 Jour le + actif: ' + (topDay ? topDay[0] : 'N/A'),
            '⏰ Heure de pointe: ' + (topHour ? topHour[0] : 'N/A'),
            '',
            '--- TOP MEMBRES ---',
            ...top5.map(([num, count], i) => {
                const pct = Math.round(count / total * 100);
                const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
                return (i + 1) + '. @' + num + ' ' + bar + ' ' + count + ' (' + pct + '%)';
            })
        ])
    );
});

// ─── Export ───────────────────────────────────────────────────────
module.exports = { trackMessage };
