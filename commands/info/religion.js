const { cmd } = require('../command.cjs');
const { boxWithFooter } = require('../lib/djousse-ui.cjs');
const axios = require('axios');

/* .hadith — Affiche un hadith aléatoire */
cmd({
    pattern: 'hadith',
    react: '📖',
    desc: 'Affiche un hadith aléatoire du jour',
    category: 'info',
    filename: __filename,
}, async (conn, m, commands, { reply }) => {
    try {
        const res = await axios.get('https://bk9.fun/Islam/hadith');
        const data = res.data;
        const hadithText = data.hadith || data.result || data.text || JSON.stringify(data);
        await reply(boxWithFooter('HADITH DU JOUR', [
            { raw: hadithText },
        ]));
    } catch (err) {
        console.error('Hadith Error:', err.message);
        await reply(boxWithFooter('HADITH DU JOUR', [
            { raw: '❌ Impossible de récupérer le hadith. Réessayez plus tard.' },
        ]));
    }
});

/* .bible <book> <chapter>:<verse> — Recherche un verset de la Bible */
cmd({
    pattern: 'bible',
    react: '✝️',
    desc: 'Affiche un verset de la Bible (ex: .bible Jean 3:16)',
    category: 'info',
    filename: __filename,
}, async (conn, m, commands, { reply, q }) => {
    if (!q) {
        return reply(boxWithFooter('BIBLE', [
            { raw: '❌ Format: .bible <livre> <chapitre>:<verset>' },
            { raw: 'Exemple: .bible Jean 3:16' },
        ]));
    }
    try {
        const query = q.trim().replace(/\s+/g, '+');
        const res = await axios.get(`https://bible-api.com/${query}?translation=fr`);
        const data = res.data;
        if (data.error) {
            return reply(boxWithFooter('BIBLE', [
                { raw: `❌ ${data.error}` },
            ]));
        }
        const reference = data.reference || q;
        const text = data.text || 'Aucun texte trouvé.';
        await reply(boxWithFooter('BIBLE', [
            { label: '📖 Référence', value: reference },
            { raw: '' },
            { raw: text },
        ]));
    } catch (err) {
        console.error('Bible Error:', err.message);
        await reply(boxWithFooter('BIBLE', [
            { raw: '❌ Verset introuvable. Vérifiez le format.' },
        ]));
    }
});

/* .prayertime [city] — Affiche les heures de prière */
cmd({
    pattern: 'prayertime',
    react: '🕌',
    desc: 'Affiche les heures de prière (ex: .prayertime Paris)',
    category: 'info',
    filename: __filename,
}, async (conn, m, commands, { reply, q }) => {
    const city = q?.trim() || 'Dakar';
    try {
        const res = await axios.get(`https://api.nexoracle.com/islamic/prayer-times?city=${encodeURIComponent(city)}`);
        const data = res.data;
        const times = data.data || data.result || data;
        const lines = [];
        if (times.Fajr) lines.push({ label: 'Fajr', value: times.Fajr });
        if (times.Sunrise) lines.push({ label: 'Sunrise', value: times.Sunrise });
        if (times.Dhuhr) lines.push({ label: 'Dhuhr', value: times.Dhuhr });
        if (times.Asr) lines.push({ label: 'Asr', value: times.Asr });
        if (times.Maghrib) lines.push({ label: 'Maghrib', value: times.Maghrib });
        if (times.Isha) lines.push({ label: 'Isha', value: times.Isha });
        if (times.Imsak) lines.push({ label: 'Imsak', value: times.Imsak });

        if (lines.length === 0) {
            return reply(boxWithFooter('HORAIRES DE PRIÈRE', [
                { raw: `❌ Aucune donnée trouvée pour "${city}".` },
            ]));
        }

        lines.unshift({ blank: true });
        lines.unshift({ label: '🏙️ Ville', value: city });

        await reply(boxWithFooter('HORAIRES DE PRIÈRE', lines));
    } catch (err) {
        console.error('PrayerTime Error:', err.message);
        await reply(boxWithFooter('HORAIRES DE PRIÈRE', [
            { raw: `❌ Impossible de récupérer les prières pour "${city}".` },
        ]));
    }
});
