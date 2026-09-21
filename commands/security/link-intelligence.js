'use strict';

const { cmd } = require('../command.cjs');
const axios = require('axios');
const { box } = require('../lib/djousse-ui.cjs');

// ─── Analyser un lien ────────────────────────────────────────────
async function analyzeLink(url) {
    const result = {
        url,
        domain: '',
        https: false,
        redirects: 0,
        risk: 'faible',
        signals: []
    };

    try {
        const parsed = new URL(url);
        result.domain = parsed.hostname;
        result.https = parsed.protocol === 'https:';

        // Vérifier le domaine suspect
        const suspiciousTlds = ['.xyz', '.top', '.buzz', '.click', '.money', '.loan', '.gq', '.ml', '.cf'];
        if (suspiciousTlds.some(tld => result.domain.endsWith(tld))) {
            result.signals.push('domaine suspect (TLD)');
            result.risk = 'élevé';
        }

        // Vérifier les redirects
        try {
            const resp = await axios.head(url, { maxRedirects: 0, timeout: 5000, validateStatus: () => true });
            if (resp.status >= 300 && resp.status < 400) {
                result.redirects = 1;
                result.signals.push('redirection');
            }
        } catch {}

        // Vérifier l'HTTPS
        if (!result.https) {
            result.signals.push('pas de HTTPS');
            if (result.risk === 'faible') result.risk = 'moyen';
        }

        // Patterns suspects dans l'URL
        if (/login|signin|verify|account|password/i.test(url)) {
            result.signals.push('page de connexion');
            result.risk = 'élevé';
        }
        if (/free|gift|prize|winner|claim/i.test(url)) {
            result.signals.push('offre/free');
            result.risk = 'élevé';
        }

        if (result.signals.length === 0) {
            result.signals.push('aucun signal');
        }

    } catch (e) {
        result.signals.push('URL invalide');
        result.risk = 'inconnu';
    }

    return result;
}

// ─── .linkinfo <url> ─────────────────────────────────────────────
cmd({
    pattern: 'linkinfo',
    desc: 'Analyser un lien',
    category: 'security',
    filename: __filename
}, async (conn, m, commands, { q, reply }) => {
    let url = q;

    // Récupérer le lien du message cité
    if (!url && m.quoted) {
        const text = m.quoted.message?.conversation || m.quoted.message?.extendedTextMessage?.text || '';
        const match = text.match(/https?:\/\/[^\s]+/);
        if (match) url = match[0];
    }

    if (!url) return reply(box('ERROR', [{ raw: 'Envoie ou cite un lien avec .linkinfo <url>' }]));

    // Extraire le lien du texte
    const urlMatch = url.match(/https?:\/\/[^\s]+/);
    if (urlMatch) url = urlMatch[0];

    await m.react('🔎');

    const result = await analyzeLink(url);

    const riskEmoji = result.risk === 'élevé' ? '🔴' : result.risk === 'moyen' ? '🟡' : '🟢';

    const lines = [
        { label: '🔗 URL', value: result.url },
        { label: '🌐 Domaine', value: result.domain },
        { label: '🔒 HTTPS', value: result.https ? '✅' : '❌' },
        { label: '🔄 Redirects', value: result.redirects },
        { label: '📊 Risque', value: `${riskEmoji} ${result.risk}` },
        { blank: true },
        { raw: '📡 Signaux :' },
        ...result.signals.map(s => ({ raw: `  • ${s}` })),
    ];

    return reply(box('☣ LINK INTELLIGENCE ☣', lines));
});

module.exports = { analyzeLink };
