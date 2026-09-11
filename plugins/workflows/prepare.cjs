'use strict';

const { cmd } = require('../../command.cjs');
const { STEPS, parseIntent, executeWorkflow } = require('../../src/core/workflow-engine.cjs');

cmd({
    pattern: 'prepare',
    desc: 'Pipeline de traitement de texte',
    category: 'ainoria',
    filename: __filename
}, async (conn, m, commands, { q, reply }) => {
    if (!q) {
        return reply(
            `┏━⍟「 ☣ PREPARE — TEXTE ☣ 」⍟━┓\n` +
            `┃\n` +
            `┃ 📝 Pipeline de traitement\n` +
            `┃\n` +
            `┃ 💡 Décris le traitement souhaité :\n` +
            `┃ .prepare corrige et résume\n` +
            `┃ .prepare traduis en anglais\n` +
            `┃ .prepare corrige, résume et mets en forme\n` +
            `┃\n` +
            `┃ 🔧 Étapes disponibles :\n` +
            `┃ .corrige — correction orthographique\n` +
            `┃ .resume — résumé\n` +
            `┃ .formal — version professionnelle\n` +
            `┃ .amical — version amicale\n` +
            `┃ .court — version courte\n` +
            `┃ .traduire — traduction\n` +
            `┃ .explain — explication simple\n` +
            `┃\n` +
            `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⍟`
        );
    }

    // Parser les étapes
    const steps = parseIntent(q);

    if (steps.length === 0) {
        return reply('❌ Je n\'ai pas compris les étapes demandées.');
    }

    // Filtrer uniquement les steps texte
    const textSteps = steps.filter(s => {
        const meta = STEPS[s];
        return meta && (meta.media.includes('text') || meta.media.length === 0);
    });

    if (textSteps.length === 0) {
        return reply('❌ Aucune étape texte valide.');
    }

    await executeWorkflow(conn, m, textSteps, { text: q });
});

module.exports = {};
