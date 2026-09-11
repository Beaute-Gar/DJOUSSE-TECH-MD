'use strict';

const { cmd } = require('../../command.cjs');
const { STEPS, detectMediaType, getCompatibleSteps } = require('../../src/core/workflow-engine.cjs');

cmd({
    pattern: 'media',
    desc: 'Analyse le média et propose des actions',
    category: 'ainoria',
    filename: __filename
}, async (conn, m, commands, { q, reply }) => {
    const mediaType = detectMediaType(m);

    const compatible = getCompatibleSteps(mediaType);

    if (compatible.length === 0) {
        return reply(
            `┏━⍟「 ☣ MEDIA ANALYZER ☣ 」⍟━┓\n` +
            `┃\n` +
            `┃ 📎 Type : ${mediaType}\n` +
            `┃ ❌ Aucune action disponible\n` +
            `┃\n` +
            `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⍟`
        );
    }

    const grouped = {};
    for (const s of compatible) {
        const meta = STEPS[s.id];
        const cat = meta.media.length > 0 ? 'Média' : 'Général';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(s);
    }

    const lines = Object.entries(grouped).map(([cat, items]) => {
        return `┃ ─── ${cat} ───\n` +
            items.map(s => `┃ ${s.label} → .${s.id}`).join('\n');
    }).join('\n');

    return reply(
        `┏━⍟「 ☣ MEDIA — ${mediaType.toUpperCase()} ☣ 」⍟━┓\n` +
        `┃\n` +
        `┃ 📎 Média détecté : ${mediaType}\n` +
        `┃\n` +
        lines + '\n' +
        `┃\n` +
        `┃ 💡 Utilise .smart <action> pour enchaîner\n` +
        `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⍟`
    );
});

module.exports = {};
