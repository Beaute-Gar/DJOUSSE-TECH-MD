'use strict';

const { cmd } = require('../command.cjs');
const ainoria = require('../lib/ainoria.cjs');

// ─── .ai répond au message cité ──────────────────────────────────
cmd({
    pattern: 'ai',
    alias: ['ainoria', 'ask'],
    desc: 'AINORIA répond au message cité',
    category: 'ainoria',
    filename: __filename
}, async (conn, m, commands, { q, reply, sender }) => {
    const quoted = m.quoted;
    const quotedText = quoted?.message?.conversation
        || quoted?.message?.extendedTextMessage?.text
        || quoted?.message?.imageMessage?.caption
        || quoted?.message?.videoMessage?.caption;

    if (!quotedText && !q) {
        return reply('Réponds à un message avec .ai\nOu pose une question: .ai <question>');
    }

    const context = quotedText || q;
    const instruction = q && quotedText ? q : 'Réponds de manière naturelle et utile.';

    try {
        await m.react('🧠');

        const prompt = `Message WhatsApp: "${context}"\n\nInstruction: ${instruction}\n\nRéponds directement, sans préambule. Sois naturel et utile.`;
        const reponse = await ainoria.chat(prompt);
        if (!reponse) return reply('AINORIA est indisponible.');

        await m.react('✅');
        return reply(reponse);
    } catch (e) {
        return reply('Erreur: ' + e.message);
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

    if (!quotedText) return reply('Réponds à un message avec `.ai <nombre>`');

    try {
        await m.react('🧠');
        const tones = ['Professionnelle', 'Amicale', 'Courte', 'Détaillée', 'Humoristique'];
        const selectedTones = tones.slice(0, count);
        const prompt = `Message WhatsApp: "${quotedText}"\n\nGénère ${count} réponses différentes avec ces tons: ${selectedTones.join(', ')}. Format: [Ton] : réponse`;

        const reponse = await ainoria.chat(prompt);
        if (!reponse) return reply('Pas de réponse.');

        const lines = reponse.trim().split('\n').filter(l => l.trim());
        const formatted = lines.map((l, i) => `${i + 1}️⃣ ${l.trim()}`).join('\n\n');
        return reply(`AINORIA — ${count} réponses\n\n${formatted}`);
    } catch (e) {
        return reply('Erreur: ' + e.message);
    }
});

module.exports = {};
