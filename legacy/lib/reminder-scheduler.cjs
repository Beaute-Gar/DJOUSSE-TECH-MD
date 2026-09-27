'use strict';

/**
 * ============================================================
 * DJOUSSE TECH — REMINDER SCHEDULER
 * ============================================================
 *
 * Checks for due reminders every 30s and delivers via anti-ban queue.
 * - Anti-rebound mutex (no double delivery)
 * - Groups overdue reminders (>24h) into one message
 * - Survives reconnections via getSock()
 *
 * ============================================================
 */

const { dueReminders, markDelivered } = require('./reminders.cjs');
const antiBan = require('./anti-ban.cjs');

let delivering = false;
let intervalId = null;

function startReminderScheduler(getSock) {
    if (intervalId) clearInterval(intervalId);

    intervalId = setInterval(async () => {
        if (delivering) return; // mutex
        const sock = getSock();
        if (!sock || !sock.user) return;

        delivering = true;
        try {
            const due = dueReminders();
            if (!due.length) return;

            // Separate: on-time (within 24h) vs overdue
            const now = Date.now();
            const overdue = due.filter(r => now - r.dueAt > 86400000); // >24h late
            const onTime = due.filter(r => now - r.dueAt <= 86400000);

            // Deliver on-time reminders individually
            for (const r of onTime) {
                await deliverReminder(sock, r);
                markDelivered(r.id);
                // Small delay between reminders
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            // Group overdue reminders per user into one message
            const overdueByUser = {};
            for (const r of overdue) {
                if (!overdueByUser[r.userJid]) overdueByUser[r.userJid] = [];
                overdueByUser[r.userJid].push(r);
            }
            for (const [userJid, reminders] of Object.entries(overdueByUser)) {
                const lines = reminders.map(r => `- ${r.text}`).join('\n');
                const chatJid = reminders[0].chatJid;
                await antiBan.queueMessage(async () => {
                    await sock.sendMessage(chatJid, {
                        text: `⏰ *RAPPELS EN RETARD*\n\n${lines}\n\n_Ces rappels avaient dépassé 24h._`,
                        mentions: [userJid],
                    });
                });
                // Mark all as delivered
                for (const r of reminders) {
                    markDelivered(r.id);
                }
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        } catch (err) {
            console.error('[REMINDERS] ❌ Scheduler error:', err.message);
        } finally {
            delivering = false;
        }
    }, 30000);

    console.log('[REMINDERS] 🟢 Scheduler started (tick every 30s)');
}

async function deliverReminder(sock, r) {
    const when = new Date(r.dueAt).toLocaleString('fr-FR', { timeZone: 'Africa/Douala' });
    const text = r.recurring
        ? `⏰ *RAPPEL* 🔁\n\n${r.text}\n\n_Heure : ${when}_\n_Récurrent : ${r.recurring.every === 'day' ? 'chaque jour' : 'chaque semaine'} à ${r.recurring.time}_`
        : `⏰ *RAPPEL*\n\n${r.text}\n\n_Heure : ${when}_`;

    await antiBan.queueMessage(async () => {
        await sock.sendMessage(r.chatJid, {
            text,
            mentions: [r.userJid],
        });
    });
}

function stopScheduler() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
    console.log('[REMINDERS] ⏹️ Scheduler stopped');
}

module.exports = { startReminderScheduler, stopScheduler };
