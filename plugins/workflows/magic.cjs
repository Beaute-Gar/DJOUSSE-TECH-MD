'use strict';

const { cmd } = require('../../command.cjs');
const { STEPS, detectMediaType, executeWorkflow } = require('../../src/core/workflow-engine.cjs');

// ─── Preset pipelines ────────────────────────────────────────────
const PRESETS = {
    image:  ['enhance', 'removebg', 'img2sticker'],
    video:  ['sticker'],
    audio:  ['transcribe'],
    sticker: ['toimg'],
    text:   ['corrige', 'resume'],
};

cmd({
    pattern: 'magic',
    alias: ['✨'],
    desc: 'Pipeline automatique selon le média',
    category: 'ainoria',
    filename: __filename
}, async (conn, m, commands, { q, reply }) => {
    const mediaType = detectMediaType(m);
    const steps = PRESETS[mediaType];

    if (!steps) {
        return reply(
            `┏━⍟「 ☣ MAGIC ☣ 」⍟━┓\n` +
            `┃\n` +
            `┃ ✨ Pipeline automatique\n` +
            `┃\n` +
            `┃ 📎 Média : ${mediaType}\n` +
            `┃ ❌ Pas de pipeline défini\n` +
            `┃\n` +
            `┃ 💡 Envoie un média puis .magic\n` +
            `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⍟`
        );
    }

    await conn.sendMessage(m.chat, { react: { text: '✨', key: m.key } });

    await executeWorkflow(conn, m, steps, { mediaType });
});

module.exports = {};
