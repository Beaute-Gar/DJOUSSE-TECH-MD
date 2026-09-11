'use strict';

const { cmd } = require('../../command.cjs');
const { STEPS, executeWorkflow } = require('../../src/core/workflow-engine.cjs');

cmd({
    pattern: 'workflow',
    alias: ['pipe', 'pipeline'],
    desc: 'Créer un workflow personnalisé',
    category: 'ainoria',
    filename: __filename
}, async (conn, m, commands, { q, reply }) => {
    if (!q) {
        const stepList = Object.entries(STEPS)
            .map(([k, v]) => `┃ ${v.label} → .${k}`)
            .join('\n');

        return reply(
            `┏━⍟「 ☣ WORKFLOW BUILDER ☣ 」⍟━┓\n` +
            `┃\n` +
            `┃ 🔧 Crée ton pipeline\n` +
            `┃\n` +
            `┃ 💡 Usage :\n` +
            `┃ .workflow enhance removebg sticker\n` +
            `┃ .workflow corrige traduire\n` +
            `┃ .workflow transcribe resume\n` +
            `┃\n` +
            `┃ 🔧 Steps disponibles :\n` +
            stepList + '\n' +
            `┃\n` +
            `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⍟`
        );
    }

    // Parser les steps
    const stepNames = q.toLowerCase().split(/\s+/).filter(Boolean);
    const steps = stepNames.filter(s => STEPS[s]);

    if (steps.length === 0) {
        return reply(`❌ Aucun step valide dans : ${q}`);
    }

    const invalid = stepNames.filter(s => !STEPS[s]);
    if (invalid.length > 0) {
        await reply(`⚠️ Steps ignorés : ${invalid.join(', ')}`);
    }

    // Afficher le plan
    const plan = steps.map((s, i) => `┃ ${i + 1}. ${STEPS[s].label}`).join('\n');

    await conn.sendMessage(m.chat, {
        text:
            `┏━⍟「 ☣ WORKFLOW PLAN ☣ 」⍟━┓\n` +
            `┃\n` +
            plan + '\n' +
            `┃\n` +
            `┃ 🔄 Exécution...\n` +
            `┃\n` +
            `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⍟`
    });

    // Exécuter
    await executeWorkflow(conn, m, steps, { text: q });
});

module.exports = {};
