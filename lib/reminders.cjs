'use strict';

/**
 * ============================================================
 * DJOUSSE TECH — REMINDERS STORE
 * ============================================================
 *
 * Persistent reminder storage:
 * - Add, cancel, list, mark delivered
 * - Recurring support (day/week)
 * - Max 20 per user
 * - Backup rotation (3 files)
 *
 * ============================================================
 */

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'database', 'reminders.json');
const MAX_REMINDERS_PER_USER = 20;

function load() {
    try {
        if (fs.existsSync(FILE)) {
            return JSON.parse(fs.readFileSync(FILE, 'utf8'));
        }
    } catch (e) {}
    return [];
}

function save(list) {
    try {
        const dir = path.dirname(FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        // Backup rotation (keep 3)
        if (fs.existsSync(FILE)) {
            for (let i = 2; i >= 1; i--) {
                const prev = `${FILE}.${i}`;
                const next = `${FILE}.${i + 1}`;
                if (fs.existsSync(prev)) {
                    if (fs.existsSync(next)) fs.unlinkSync(next);
                    fs.renameSync(prev, next);
                }
            }
            fs.copyFileSync(FILE, `${FILE}.1`);
        }

        fs.writeFileSync(FILE, JSON.stringify(list, null, 2));
    } catch (e) {}
}

function addReminder(r) {
    const list = load();
    const mine = list.filter(x => x.userJid === r.userJid && !x.delivered);
    if (mine.length >= MAX_REMINDERS_PER_USER) return null;

    r.id = 'r_' + Date.now().toString(36) + Math.floor(Math.random() * 999);
    r.delivered = false;
    r.created = r.created || Date.now();
    list.push(r);
    save(list);
    return r.id;
}

function cancelReminder(userJid, idOrIndex) {
    const list = load();
    // Try by ID first
    let idx = list.findIndex(x => x.id === idOrIndex && x.userJid === userJid && !x.delivered);
    // Try by index (1-based)
    if (idx === -1) {
        const num = parseInt(idOrIndex, 10);
        if (!isNaN(num) && num >= 1) {
            const mine = list.filter(x => x.userJid === userJid && !x.delivered)
                .sort((a, b) => a.dueAt - b.dueAt);
            if (num <= mine.length) {
                idx = list.indexOf(mine[num - 1]);
            }
        }
    }
    if (idx === -1) return false;
    list.splice(idx, 1);
    save(list);
    return true;
}

function listReminders(userJid) {
    return load()
        .filter(x => x.userJid === userJid && !x.delivered)
        .sort((a, b) => a.dueAt - b.dueAt);
}

function dueReminders(now = Date.now()) {
    return load()
        .filter(x => !x.delivered && x.dueAt <= now)
        .sort((a, b) => a.dueAt - b.dueAt);
}

function markDelivered(id) {
    const list = load();
    const r = list.find(x => x.id === id);
    if (!r) return;
    if (r.recurring) {
        r.dueAt = nextRecurring(r.recurring, r.dueAt);
    } else {
        r.delivered = true;
    }
    save(list);
}

function nextRecurring(rec, fromTs) {
    const from = new Date(fromTs);
    const tz = rec.tz || 'Africa/Douala';

    if (rec.every === 'day') {
        const next = new Date(from);
        next.setDate(next.getDate() + 1);
        // Parse time "HH:MM"
        const [h, m] = (rec.time || '09:00').split(':').map(Number);
        next.setHours(h, m, 0, 0);
        return next.getTime();
    }

    if (rec.every === 'week') {
        const next = new Date(from);
        next.setDate(next.getDate() + 7);
        const [h, m] = (rec.time || '09:00').split(':').map(Number);
        next.setHours(h, m, 0, 0);
        return next.getTime();
    }

    return fromTs + 86400000; // fallback: +1 day
}

function getStats(userJid) {
    const list = load();
    const mine = list.filter(x => x.userJid === userJid);
    return {
        active: mine.filter(x => !x.delivered).length,
        delivered: mine.filter(x => x.delivered).length,
        total: mine.length,
        maxPerUser: MAX_REMINDERS_PER_USER,
    };
}

module.exports = { addReminder, cancelReminder, listReminders, dueReminders, markDelivered, getStats, load };
