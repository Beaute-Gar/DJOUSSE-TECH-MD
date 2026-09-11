'use strict';

const { cmd } = require('../../command.cjs');
const { STEPS, parseIntent, detectMediaType, executeWorkflow } = require('../../src/core/workflow-engine.cjs');

cmd({
    pattern: 'smart',
    alias: ['ainoria', 'auto'],
    desc: 'Commande universelle — AINORIA analyse et exécute',
    category: 'ainoria',
    filename: __filename
}, async (conn, m, commands, { q, reply }) => {
    const mediaType = detectMediaType(m);

    if (!q && mediaType === 'text') {
        return reply(
            `┏━⍟「 ☣ SMART — AINORIA ☣ 」⍟━┓\n` +
            `┃\n` +
            `┃ 🧠 Commande universelle\n` +
            `┃\n` +
            `┃ 💡 Décris ce que tu veux :\n` +
            `┃ .smart améliore cette image\n` +
            `┃ .smart transforme en sticker\n` +
            `┃ .smart corrige et résume\n` +
            `┃ .smart traduis en anglais\n` +
            `┃\n` +
            `┃ 📎 Média détecté : ${mediaType}\n` +
            `┃\n` +
            `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⍟`
        );
    }

    // Parser l'intention
    const steps = parseIntent(q || '');

    if (steps.length === 0) {
        // Si média mais pas d'instruction, proposer des options
        if (mediaType !== 'text') {
            const compatible = {
                image: ['enhance', 'removebg', 'sticker', 'collage', 'logo'],
                video: ['sticker', 'transcribe'],
                audio: ['transcribe', 'bass', 'robot', 'deep', 'tts'],
                sticker: ['toimg'],
                text: ['formal', 'resume', 'corrige', 'traduire', 'explain']
            };
            const options = (compatible[mediaType] || []).map(s => `┃ ${STEPS[s].label} → .${s}`).join('\n');
            return reply(
                `┏━⍟「 ☣ SMART — ${mediaType.toUpperCase()} ☣ 」⍟━┓\n` +
                `┃\n` +
                `┃ 📎 Média détecté : ${mediaType}\n` +
                `┃\n` +
                `┃ Actions disponibles :\n` +
                options + '\n' +
                `┃\n` +
                `┃ 💡 Ou décris ce que tu veux :\n` +
                `┃ .smart améliore et enlève le fond\n` +
                `┃\n` +
                `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⍟`
            );
        }
        return reply('❌ Je n\'ai pas compris l\'action demandée.');
    }

    // Valider les steps
    const invalid = steps.filter(s => !STEPS[s]);
    if (invalid.length > 0) {
        return reply(`❌ Étapes inconnues : ${invalid.join(', ')}`);
    }

    // Exécuter le pipeline
    await executeWorkflow(conn, m, steps, { text: q, mediaType });
});

module.exports = {};
