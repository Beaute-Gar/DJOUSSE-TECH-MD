'use strict';

const { cmd } = require('../command.cjs');
const ainoria = require('../lib/ainoria.cjs');

const TRANSFORMS = {
    formal: { label: 'Professionnel', prompt: 'Transforme ce message en version professionnelle et formelle.' },
    resume: { label: 'Résumé', prompt: 'Résume ce message en 1-2 phrases claires.' },
    corrige: { label: 'Corrigé', prompt: 'Corrige les fautes d\'orthographe et de grammaire de ce message.' },
    amical: { label: 'Amical', prompt: 'Reformule ce message de manière amicale et chaleureuse.' },
    court: { label: 'Court', prompt: 'Raccourcis ce message au maximum, garde juste l\'essentiel.' },
    pro: { label: 'Pro', prompt: 'Transforme ce message en version professionnelle concise.' },
};

// ─── Transform commands ──────────────────────────────────────────
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

        if (!quotedText) return reply(`Réponds à un message avec .${cmdName}`);

        try {
            await m.react('✏️');
            const prompt = `${transform.prompt}\n\nMessage original: "${quotedText}"\n\nNe garde QUE le message transformé, sans commentaire.`;
            const reponse = await ainoria.chat(prompt);
            if (!reponse) return reply('Transformation échouée.');
            return reply(`✏️ *${transform.label}*\n\n${reponse}`);
        } catch (e) {
            return reply('Erreur: ' + e.message);
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
    if (!quotedText) return reply('Réponds à un message avec .traduire <langue>');

    try {
        await m.react('🌐');
        const reponse = await ainoria.translate(quotedText, targetLang);
        if (!reponse) return reply('Traduction échouée.');
        return reply(`🌐 *Traduction en ${targetLang}*\n\n${reponse}`);
    } catch (e) {
        return reply('Erreur: ' + e.message);
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

    if (!quotedText) return reply('Réponds à un message avec .explain');

    try {
        await m.react('💡');
        const prompt = `Explique ce message comme si tu parlais à un enfant de 10 ans. Sois simple et clair.\n\n"${quotedText}"`;
        const reponse = await ainoria.chat(prompt);
        if (!reponse) return reply('Explication échouée.');
        return reply(`💡 *Explication simple*\n\n${reponse}`);
    } catch (e) {
        return reply('Erreur: ' + e.message);
    }
});

module.exports = {};
