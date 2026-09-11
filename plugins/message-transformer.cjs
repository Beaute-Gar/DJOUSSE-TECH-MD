'use strict';

const { cmd } = require('../command.cjs');
const axios = require('axios');

const GEMINI_MODEL = 'gemini-3.6-flash';

const TRANSFORMS = {
    formal: { label: 'Professionnel', prompt: 'Transforme ce message en version professionnelle et formelle.' },
    resume: { label: 'Résumé', prompt: 'Résume ce message en 1-2 phrases claires.' },
    corrige: { label: 'Corrigé', prompt: 'Corrige les fautes d\'orthographe et de grammaire de ce message.' },
    amical: { label: 'Amical', prompt: 'Reformule ce message de manière amicale et chaleureuse.' },
    court: { label: 'Court', prompt: 'Raccourcis ce message au maximum, garde juste l\'essentiel.' },
    pro: { label: 'Pro', prompt: 'Transforme ce message en version professionnelle concise.' },
};

// ─── Transform command ───────────────────────────────────────────
for (const [cmdName, transform] of Object.entries(TRANSFORMS)) {
    cmd({
        pattern: cmdName,
        desc: `Transformer en ${transform.label}`,
        category: 'ainoria',
        filename: __filename
    }, async (conn, m, commands, { reply }) => {
        const quotedText = m.quoted?.message?.conversation
            || m.quoted?.message?.extendedTextMessage?.text
            || m.quoted?.message?.imageMessage?.caption
            || m.quoted?.message?.videoMessage?.caption;

        if (!quotedText) {
            return reply(`❌ Réponds à un message avec .${cmdName}`);
        }

        const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
        if (!GEMINI_API_KEY) return reply('❌ Clé API Gemini manquante.');

        try {
            await m.react('✏️');

            const prompt = `${transform.prompt}\n\nMessage original: "${quotedText}"\n\nNe garde QUE le message transformé, sans commentaire.`;

            const response = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
                { contents: [{ parts: [{ text: prompt }] }] },
                { timeout: 20000 }
            );

            const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) return reply('❌ Transformation échouée.');

            return reply(`✏️ *${transform.label}*\n\n${text.trim()}`);
        } catch (e) {
            return reply('❌ Erreur: ' + (e.response?.data?.error?.message || e.message));
        }
    });
}

// ─── .traduire <langue> ──────────────────────────────────────────
cmd({
    pattern: 'traduire',
    alias: ['trad', 'tr'],
    desc: 'Traduire un message',
    category: 'ainoria',
    filename: __filename
}, async (conn, m, commands, { q, reply }) => {
    const quotedText = m.quoted?.message?.conversation
        || m.quoted?.message?.extendedTextMessage?.text;

    const targetLang = q?.replace(/traduire|trad|tr/i, '').trim() || 'français';

    if (!quotedText) return reply('❌ Réponds à un message avec .traduire <langue>');

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
    if (!GEMINI_API_KEY) return reply('❌ Clé API Gemini manquante.');

    try {
        await m.react('🌐');

        const prompt = `Traduis ce message en ${targetLang}. Garde le sens exact.\n\n"${quotedText}"\n\nTraduction:`;

        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
            { contents: [{ parts: [{ text: prompt }] }] },
            { timeout: 20000 }
        );

        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return reply('❌ Traduction échouée.');

        return reply(`🌐 *Traduction en ${targetLang}*\n\n${text.trim()}`);
    } catch (e) {
        return reply('❌ Erreur: ' + (e.response?.data?.error?.message || e.message));
    }
});

// ─── .explain — expliquer simplement ─────────────────────────────
cmd({
    pattern: 'explain',
    alias: ['explique', 'simple'],
    desc: 'Expliquer un message simplement',
    category: 'ainoria',
    filename: __filename
}, async (conn, m, commands, { reply }) => {
    const quotedText = m.quoted?.message?.conversation
        || m.quoted?.message?.extendedTextMessage?.text;

    if (!quotedText) return reply('❌ Réponds à un message avec .explain');

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
    if (!GEMINI_API_KEY) return reply('❌ Clé API Gemini manquante.');

    try {
        await m.react('💡');

        const prompt = `Explique ce message comme si tu parlais à un enfant de 10 ans. Sois simple et clair.\n\n"${quotedText}"`;

        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
            { contents: [{ parts: [{ text: prompt }] }] },
            { timeout: 20000 }
        );

        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return reply('❌ Explication échouée.');

        return reply(`💡 *Explication simple*\n\n${text.trim()}`);
    } catch (e) {
        return reply('❌ Erreur: ' + (e.response?.data?.error?.message || e.message));
    }
});

module.exports = {};
