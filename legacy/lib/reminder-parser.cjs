'use strict';

/**
 * ============================================================
 * DJOUSSE TECH — REMINDER PARSER (FRENCH)
 * ============================================================
 *
 * Parses natural language French reminders:
 *   "rappelle-moi d'appeler le fournisseur demain à 15h"
 *   "rappel dans 2 heures : envoyer le devis"
 *   "chaque lundi à 8h sport"
 *   "tous les jours à 21h prendre mon médicament"
 *
 * Timezone: Africa/Douala (UTC+1, no DST)
 *
 * ============================================================
 */

const TIMEZONE_OFFSET = 1; // UTC+1 for Africa/Douala

const DAY_NAMES = {
    'lundi': 1, 'mardi': 2, 'mercredi': 3, 'jeudi': 4,
    'vendredi': 5, 'samedi': 6, 'dimanche': 0,
};

function toUTC(year, month, day, hours, minutes) {
    return Date.UTC(year, month, day, hours - TIMEZONE_OFFSET, minutes, 0, 0);
}

function parseTime(str) {
    // "15h", "15h30", "15:30", "8h"
    const m = str.match(/(\d{1,2})[h:](\d{2})?/i);
    if (!m) return null;
    return { hours: parseInt(m[1], 10), minutes: parseInt(m[2] || '0', 10) };
}

function getTargetDay(name) {
    const lower = name.toLowerCase();
    return DAY_NAMES[lower] !== undefined ? DAY_NAMES[lower] : -1;
}

function parseReminder(input) {
    if (!input || typeof input !== 'string') return null;

    let text = input.trim();
    const now = new Date();
    let recurring = null;
    let dueAt = null;

    // 1. Check recurring: "chaque/tous les/toutes les <period>"
    const recurringMatch = text.match(/(chaque|tous\s+les|toutes\s+les)\s+(jour|jours|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)/i);
    if (recurringMatch) {
        const period = recurringMatch[2].toLowerCase();
        let every = 'day';
        let targetDay = -1;

        if (['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'].includes(period)) {
            every = 'week';
            targetDay = getTargetDay(period);
        }

        // Extract time
        const timeMatch = text.match(/à\s+(\d{1,2})[h:](\d{2})?/i);
        const time = timeMatch ? `${timeMatch[1].padStart(2, '0')}:${(timeMatch[2] || '00').padStart(2, '0')}` : '09:00';
        const { hours, minutes } = parseTime(timeMatch ? `${timeMatch[1]}h${timeMatch[2] || '00'}` : '9h');

        // Calculate next occurrence
        const next = new Date(now);
        if (every === 'week' && targetDay >= 0) {
            const currentDay = next.getDay();
            let daysAhead = targetDay - currentDay;
            if (daysAhead <= 0) daysAhead += 7;
            next.setDate(next.getDate() + daysAhead);
        } else {
            // Daily: if time passed today, tomorrow
            const todayAtTime = new Date(next);
            todayAtTime.setHours(hours, minutes, 0, 0);
            if (todayAtTime <= next) {
                next.setDate(next.getDate() + 1);
            }
        }
        next.setHours(hours, minutes, 0, 0);
        dueAt = toUTC(next.getFullYear(), next.getMonth(), next.getDate(), hours, minutes);

        // Extract text: remove recurring + time parts
        text = text
            .replace(/(chaque|tous\s+les|toutes\s+les)\s+(jour|jours|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)/gi, '')
            .replace(/à\s+\d{1,2}[h:]\d{0,2}/gi, '')
            .replace(/rappelle(-moi)?(\s+de\s+|\s+d')?/gi, '')
            .replace(/rappel/gi, '')
            .replace(/me rappeler/gi, '')
            .replace(/\s+/g, ' ')
            .trim();

        if (text.length < 3) return null;

        recurring = { every, time, tz: 'Africa/Douala' };
        return { text, dueAt, recurring };
    }

    // 2. Relative duration: "dans X min/heure/h/jour/semaine"
    const relativeMatch = text.match(/dans\s+(\d+)\s*(min(?:ute)?|heures?|h|jours?|semaines?)/i);
    if (relativeMatch) {
        const amount = parseInt(relativeMatch[1], 10);
        const unit = relativeMatch[2].toLowerCase();
        let ms = 0;

        if (unit.startsWith('min')) ms = amount * 60000;
        else if (unit.startsWith('heure') || unit === 'h') ms = amount * 3600000;
        else if (unit.startsWith('jour')) ms = amount * 86400000;
        else if (unit.startsWith('semaine')) ms = amount * 7 * 86400000;

        dueAt = Date.now() + ms;

        // Extract text
        text = text
            .replace(/dans\s+\d+\s*(min(?:ute)?|heures?|h|jours?|semaines?)/gi, '')
            .replace(/rappelle(-moi)?(\s+de\s+|\s+d')?/gi, '')
            .replace(/rappel/gi, '')
            .replace(/:/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        if (text.length < 3) return null;
        return { text, dueAt, recurring: null };
    }

    // 3. Absolute date: "demain", "après-demain", "ce soir", "le 25"
    let targetDate = new Date(now);
    let dateFound = false;

    if (/demain/i.test(text) && !/après/i.test(text)) {
        targetDate.setDate(targetDate.getDate() + 1);
        dateFound = true;
        text = text.replace(/demain/gi, '');
    } else if (/après[- ]?demain/i.test(text)) {
        targetDate.setDate(targetDate.getDate() + 2);
        dateFound = true;
        text = text.replace(/après[- ]?demain/gi, '');
    } else if (/ce soir/i.test(text)) {
        dateFound = true;
        text = text.replace(/ce soir/gi, '');
    } else {
        // "le 25" or "le 25 juin"
        const dateMatch = text.match(/le\s+(\d{1,2})(?:\s+(\w+))?/i);
        if (dateMatch) {
            const day = parseInt(dateMatch[1], 10);
            const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
            let month = now.getMonth();
            if (dateMatch[2]) {
                const mIdx = monthNames.findIndex(m => m.startsWith(dateMatch[2].toLowerCase()));
                if (mIdx >= 0) month = mIdx;
            }
            targetDate = new Date(now.getFullYear(), month, day);
            if (targetDate <= now) {
                targetDate.setFullYear(targetDate.getFullYear() + 1);
            }
            dateFound = true;
            text = text.replace(/le\s+\d{1,2}(?:\s+\w+)?/i, '');
        }
    }

    // 4. Extract time
    const timeMatch = text.match(/à\s+(\d{1,2})[h:](\d{2})?/i);
    let hours = 9, minutes = 0;
    if (timeMatch) {
        hours = parseInt(timeMatch[1], 10);
        minutes = parseInt(timeMatch[2] || '0', 10);
        dateFound = true;
        text = text.replace(/à\s+\d{1,2}[h:]\d{0,2}/gi, '');
    }

    if (!dateFound) return null;

    // If time passed today and no date specified (or "ce soir"), default to tomorrow
    if (!timeMatch && targetDate.toDateString() === now.toDateString()) {
        // No time and no specific date = try "à présent" or fail
        return null;
    }

    dueAt = toUTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), hours, minutes);

    // If due time is in the past, shift to tomorrow
    if (dueAt <= Date.now() + 60000) {
        targetDate.setDate(targetDate.getDate() + 1);
        dueAt = toUTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), hours, minutes);
    }

    // Clean text
    text = text
        .replace(/rappelle(-moi)?(\s+de\s+|\s+d')?/gi, '')
        .replace(/rappel/gi, '')
        .replace(/me rappeler/gi, '')
        .replace(/:/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    if (text.length < 3) return null;

    return { text, dueAt, recurring: null };
}

module.exports = { parseReminder };
