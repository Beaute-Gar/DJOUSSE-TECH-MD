'use strict';

const { cmd } = require('../command.cjs');
const axios = require('axios');

// ─── .ai répond au message cité ──────────────────────────────────
cmd({
    pattern: 'ai',
    alias: ['ainoria', 'ask'],
    desc: 'AINORIA répond au message cité',
    category: 'ainoria',
    filename: __filename
}, async (conn, m, commands, { q, reply, sender }) => {
    // Récupérer le message cité
    const quoted = m.quoted;
    const quotedText = quoted?.message?.conversation
        || quoted?.message?.extendedTextMessage?.text
        || quoted?.message?.imageMessage?.caption
        || quoted?.message?.videoMessage?.caption;

    if (!quotedText && !q) {
        return reply(
            `┏━⍟「 ☣ AINORIA AI ☣ 」⍟━┓\n` +
            `┃\n` +
            `┃ 💡 Réponds à un message avec :\n` +
            `┃ .ai\n` +
            `┃\n` +
            `┃ Ou pose une question :\n` +
            `┃ .ai <question>\n` +
            `┃\n` +
            `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⍟`
        );
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
    if (!GEMINI_API_KEY) return reply('❌ Clé API Gemini manquante.');

    const context = quotedText || q;
    const instruction = q && quotedText ? q : 'Réponds de manière naturelle et utile.';

    try {
        await m.react('🧠');

        const prompt = `Contexte d'un message WhatsApp:\n"${context}"\n\nInstruction: ${instruction}\n\nRéponds directement, sans préambule. Sois naturel et utile.`;

        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`,
            { contents: [{ parts: [{ text: prompt }] }] },
            { timeout: 30000 }
        );

        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return reply('❌ AINORIA n\'a pas de réponse.');

        await m.react('✅');
        return reply('🧠 *AINORIA*\n\n' + text.trim());
    } catch (e) {
        return reply('❌ Erreur: ' + (e.response?.data?.error?.message || e.message));
    }
});

// ─── .ai 3 réponses — choix multiples ────────────────────────────
cmd({
    pattern: 'ai (%d)',
    desc: 'AINORIA propose N réponses',
    category: 'ainoria',
    filename: __filename,
    dontAddCommandList: true
}, async (conn, m, commands, { q, reply }) => {
    const match = q.match(/ai\s+(\d+)/);
    if (!match) return;

    const count = Math.min(parseInt(match[1]), 5);
    const quoted = m.quoted;
    const quotedText = quoted?.message?.conversation
        || quoted?.message?.extendedTextMessage?.text
        || quoted?.message?.imageMessage?.caption;

    if (!quotedText) return reply('❌ Réponds à un message avec `.ai <nombre>`');

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
    if (!GEMINI_API_KEY) return reply('❌ Clé API Gemini manquante.');

    try {
        await m.react('🧠');

        const tones = ['Professionnelle', 'Amicale', 'Courte', 'Détaillée', 'Humoristique'];
        const selectedTones = tones.slice(0, count);

        const prompt = `Message WhatsApp: "${quotedText}"\n\nGénère ${count} réponses différentes avec ces tons: ${selectedTones.join(', ')}. Format: [Ton] : réponse`;

        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`,
            { contents: [{ parts: [{ text: prompt }] }] },
            { timeout: 30000 }
        );

        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return reply('❌ Pas de réponse.');

        const lines = text.trim().split('\n').filter(l => l.trim());
        const formatted = lines.map((l, i) => `${i + 1}️⃣ ${l.trim()}`).join('\n\n');

        return reply('🧠 *AINORIA — ' + count + ' réponses*\n\n' + formatted);
    } catch (e) {
        return reply('❌ Erreur: ' + (e.response?.data?.error?.message || e.message));
    }
});

module.exports = {};
