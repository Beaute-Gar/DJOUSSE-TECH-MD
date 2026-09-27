'use strict';

/**
 * ============================================================
 * DJOUSSE TECH — WEEKLY GROUP STATS
 * ============================================================
 *
 * Sends a weekly recap to each group every Sunday at 19:00.
 * Only for groups where .autostats is enabled.
 *
 * ============================================================
 */

const database = require('../database');
const bus = require('./src/core/eventBus');

const SENT_KEY = 'weekly_stats_sent';

function getThisWeekKey() {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);
    return `${startOfWeek.getFullYear()}-${startOfWeek.getMonth()}-${startOfWeek.getDate()}`;
}

function alreadySentThisWeek() {
    try {
        const sent = JSON.parse(process.env[SENT_KEY] || '{}');
        return sent.week === getThisWeekKey();
    } catch { return false; }
}

function markSent() {
    try {
        process.env[SENT_KEY] = JSON.stringify({ week: getThisWeekKey() });
    } catch {}
}

function isSunday19h() {
    const now = new Date();
    return now.getDay() === 0 && now.getHours() === 19 && now.getMinutes() < 5;
}

async function sendWeeklyStats(sock) {
    if (alreadySentThisWeek()) return;
    if (!isSunday19h()) return;

    const groups = require('./database').readDB
        ? (() => {
            try {
                const fs = require('fs');
                const path = require('path');
                const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'database', 'groups.json'), 'utf8'));
                return Object.entries(data).filter(([id, s]) => s.autostats && id.endsWith('@g.us'));
            } catch { return []; }
        })() : [];

    for (const [groupId] of groups) {
        try {
            const metadata = await sock.groupMetadata(groupId).catch(() => null);
            if (!metadata) continue;

            const msgCount = require('./groupstats')?.getStats?.(groupId)?.totalMessages || 0;
            const topUsers = require('./groupstats')?.getTopUsers?.(groupId, 5) || [];

            const topLines = topUsers.length > 0
                ? topUsers.map((u, i) => `${i + 1}. @${u.jid.split('@')[0]} — ${u.messages} msgs`).join('\n')
                : 'Aucune donnée';

            const text = `📊 *Récap Hebdomadaire*\n\n` +
                `👥 Membres : ${metadata.participants?.length || '?'}\n` +
                `💬 Messages cette semaine : ~${msgCount}\n\n` +
                `🏆 *Top actifs*\n${topLines}\n\n` +
                `_Stats silencieuses — désactiver : .autostats off_`;

            const mentions = topUsers.map(u => u.jid);
            await sock.sendMessage(groupId, { text, mentions }).catch(() => {});
        } catch (e) {}
    }

    markSent();
}

module.exports = { sendWeeklyStats, isSunday19h };
