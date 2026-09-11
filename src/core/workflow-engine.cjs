/**
 * DJOUSSE TECH — Workflow Engine v1.0
 * Moteur d'exécution de pipelines de plugins
 */

'use strict';

const { commands } = require('../../command.cjs');

// ─── Registry des steps disponibles ──────────────────────────────
const STEPS = {
    // Media
    enhance:     { label: '🎨 Améliorer',    media: ['image'],              plugin: 'enhance' },
    removebg:    { label: '🧹 Supprimer fond', media: ['image'],            plugin: 'removebg' },
    img2sticker: { label: '📦 Image → Sticker', media: ['image'],          plugin: 'img2sticker' },
    sticker:     { label: '🎨 Sticker',       media: ['image', 'video'],    plugin: 'sticker-actions' },
    toimg:       { label: '🖼️ Sticker → Image', media: ['sticker'],        plugin: 'sticker-to-image' },
    collage:     { label: '🖼️ Collage',       media: ['image'],             plugin: 'image_college_maker' },
    logo:        { label: '✨ Logo',           media: ['image'],             plugin: 'logo' },
    enhancehd:   { label: '✨ HD',            media: ['image'],             plugin: 'enhance' },

    // Audio
    transcribe:  { label: '🎙️ Transcrire',   media: ['audio', 'video', 'ptt'], plugin: 'transcribe' },
    bass:        { label: '🔊 Bass',          media: ['audio', 'video'],    plugin: 'audio-effects' },
    robot:       { label: '🤖 Robot',         media: ['audio', 'video'],    plugin: 'audio-effects' },
    deep:        { label: '🔽 Deep',          media: ['audio', 'video'],    plugin: 'audio-effects' },
    tts:         { label: '🗣️ TTS',           media: ['text'],              plugin: 'text_to_speech_' },
    clonevoice:  { label: '🎤 Clone Voice',   media: ['audio'],             plugin: 'clonevoice' },

    // Text
    formal:      { label: '📝 Professionnel', media: ['text'],              plugin: 'message-transformer' },
    resume:      { label: '📋 Résumé',        media: ['text'],              plugin: 'message-transformer' },
    corrige:     { label: '✏️ Corriger',      media: ['text'],              plugin: 'message-transformer' },
    amical:      { label: '😊 Amical',        media: ['text'],              plugin: 'message-transformer' },
    court:       { label: '✂️ Court',         media: ['text'],              plugin: 'message-transformer' },
    traduire:    { label: '🌐 Traduire',      media: ['text'],              plugin: 'message-transformer' },
    explain:     { label: '💡 Expliquer',     media: ['text'],              plugin: 'message-transformer' },

    // Security
    antilink:    { label: '🔗 Anti-Link',     media: [],                    plugin: 'guardian' },
    antispam:    { label: '🚫 Anti-Spam',     media: [],                    plugin: 'guardian' },
    antiflood:   { label: '🌊 Anti-Flood',    media: [],                    plugin: 'guardian' },
    antibad:     { label: '🤬 Anti-Bad',      media: [],                    plugin: 'guardian' },
    antiscam:    { label: '🚨 Anti-Scam',     media: [],                    plugin: 'anti-scam' },

    // AI
    ask:         { label: '🧠 AINORIA',       media: ['text'],              plugin: 'smart-reply' },
    ai:          { label: '🧠 AI Reply',      media: ['text'],              plugin: 'smart-reply' },
    vision:      { label: '👁️ Vision',        media: ['image'],             plugin: 'vision' },
};

// ─── Parser d'intention simple ───────────────────────────────────
function parseIntent(text) {
    const lower = text.toLowerCase();
    const steps = [];

    if (/améliore|enhance|hd|upscale|qualité/.test(lower)) steps.push('enhance');
    if (/fond|arrière-plan|removebg|supprime.*fond/.test(lower)) steps.push('removebg');
    if (/sticker/.test(lower)) {
        steps.push(steps.includes('enhance') || steps.includes('removebg') ? 'img2sticker' : 'sticker');
    }
    if (/collage/.test(lower)) steps.push('collage');
    if (/logo/.test(lower)) steps.push('logo');
    if (/transcri/.test(lower)) steps.push('transcribe');
    if (/bass|grave/.test(lower)) steps.push('bass');
    if (/robot/.test(lower)) steps.push('robot');
    if (/deep|profond/.test(lower)) steps.push('deep');
    if (/tts|parle|voix/.test(lower)) steps.push('tts');
    if (/clone.*voice|clonage/.test(lower)) steps.push('clonevoice');
    if (/formel|professionnel|pro/.test(lower)) steps.push('formal');
    if (/résum|resume|résumer/.test(lower)) steps.push('resume');
    if (/corrig|faute|orthographe/.test(lower)) steps.push('corrige');
    if (/amica|chaleureux|friendly/.test(lower)) steps.push('amical');
    if (/court|raccour|court|concis/.test(lower)) steps.push('court');
    if (/tradui|traduct|anglais|english|français/.test(lower)) steps.push('traduire');
    if (/expliq|comprend|simple/.test(lower)) steps.push('explain');
    if (/question|ask|demande/.test(lower)) steps.push('ask');
    if (/image|photo|picture/.test(lower) && steps.length === 0) steps.push('enhance');

    return steps;
}

// ─── Détecter le type de média ───────────────────────────────────
function detectMediaType(m) {
    if (!m) return 'text';
    const type = m.mtype || '';
    if (/image/.test(type)) return 'image';
    if (/video/.test(type)) return 'video';
    if (/audio|ptt/.test(type)) return 'audio';
    if (/sticker/.test(type)) return 'sticker';
    if (/document/.test(type)) return 'document';
    if (/conversation|extendedText/.test(type)) return 'text';
    return 'text';
}

// ─── Exécuter un workflow ────────────────────────────────────────
async function executeWorkflow(conn, m, steps, context = {}) {
    const results = [];
    let currentData = context.mediaBuffer || null;
    let currentMime = context.mediaMime || null;

    const progress = await m.reply(
        `┏━⍟「 ☣ WORKFLOW ENGINE ☣ 」⍟━┓\n` +
        `┃\n` +
        `┃ 🔄 Exécution de ${steps.length} étape(s)...\n` +
        `┃\n` +
        steps.map((s, i) => `┃ ${i + 1}. ${STEPS[s]?.label || s}`).join('\n') + '\n' +
        `┃\n` +
        `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⍟`
    ).catch(() => null);

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const meta = STEPS[step];

        if (!meta) {
            results.push({ step, status: 'skip', reason: 'unknown step' });
            continue;
        }

        try {
            // Trouver le plugin correspondant
            const plugin = commands.find(c => c.pattern === meta.plugin || c.filename?.includes(meta.plugin));

            if (!plugin) {
                results.push({ step, status: 'skip', reason: 'plugin not found' });
                continue;
            }

            // Construire le contexte pour le plugin
            const pluginCtx = {
                q: context.text || '',
                reply: (text) => conn.sendMessage(m.chat, { text }),
                sender: m.sender,
                chat: m.chat,
                isGroup: m.isGroup,
                botNumber: m.botNumber,
            };

            // Exécuter
            if (plugin.execute) {
                await plugin.execute(conn, m, commands, pluginCtx);
            }

            results.push({ step, status: 'ok', label: meta.label });
            await new Promise(r => setTimeout(r, 1000)); // Délai entre étapes

        } catch (e) {
            results.push({ step, status: 'error', error: e.message });
        }
    }

    // Rapport final
    const ok = results.filter(r => r.status === 'ok').length;
    const fail = results.filter(r => r.status === 'error').length;
    const skip = results.filter(r => r.status === 'skip').length;

    const report = results.map(r => {
        const icon = r.status === 'ok' ? '✅' : r.status === 'error' ? '❌' : '⏭️';
        return `┃ ${icon} ${r.label || r.step}${r.error ? ' — ' + r.error : ''}`;
    }).join('\n');

    if (progress) {
        try {
            await conn.sendMessage(m.chat, { delete: progress.key });
        } catch (_) {}
    }

    await conn.sendMessage(m.chat, {
        text:
            `┏━⍟「 ☣ WORKFLOW TERMINÉ ☣ 」⍟━┓\n` +
            `┃\n` +
            report + '\n' +
            `┃\n` +
            `┃ 📊 ${ok} ok / ${fail} erreurs / ${skip} ignorés\n` +
            `┃\n` +
            `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⍟`
    });
}

// ─── Obtenir les steps compatibles avec un média ─────────────────
function getCompatibleSteps(mediaType) {
    return Object.entries(STEPS)
        .filter(([, meta]) => meta.media.length === 0 || meta.media.includes(mediaType))
        .map(([key, meta]) => ({ id: key, label: meta.label }));
}

module.exports = { STEPS, parseIntent, detectMediaType, executeWorkflow, getCompatibleSteps };
