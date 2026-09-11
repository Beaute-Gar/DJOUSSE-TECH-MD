'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   .verify / .authcode — Signature d'authenticité DJOUSSE TECH
   Génère un code HMAC-SHA256 basé sur une clé privée (DJOUSSE_AUTH_SECRET)
   + le numéro de l'instance + l'identifiant de build.

   ⚠️ IMPORTANT : définis DJOUSSE_AUTH_SECRET dans ton fichier .env
   (jamais dans le code, jamais commité sur GitHub). Exemple :
       DJOUSSE_AUTH_SECRET=une-chaine-longue-aleatoire-et-privee
   ═══════════════════════════════════════════════════════════════════════════ */

const crypto = require('crypto');
const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');
const config = require('../config-djousse.cjs');

function getBotNumber(conn) {
    const raw = conn?.user?.id || conn?.user?.jid || '';
    return String(raw).split(':')[0].split('@')[0] || 'UNKNOWN';
}

function maskNumber(num) {
    if (!num || num === 'UNKNOWN') return 'INCONNU';
    return '••••' + num.slice(-4);
}

function buildAuthCode(conn) {
    const secret = process.env.DJOUSSE_AUTH_SECRET || config.AUTH_SECRET || '';
    if (!secret) return null;

    const botNumber = getBotNumber(conn);
    const buildId = config.BUILD_ID || config.BOT_NAME || 'DJOUSSE-TECH-MD';
    const payload = `${botNumber}:${buildId}`;

    const hash = crypto.createHmac('sha256', secret).update(payload).digest('hex').toUpperCase();
    const grouped = hash.slice(0, 16).match(/.{1,4}/g).join('-');

    return { botNumber, buildId, grouped };
}

cmd({
    pattern: 'verify',
    alias: ['authcode', 'auth', 'authentic'],
    desc: "Affiche la signature d'authenticité officielle DJOUSSE TECH",
    category: 'main',
    react: '🔏',
    use: '.verify',
    filename: __filename,
}, async (conn, m, commands, { reply }) => {
    const result = buildAuthCode(conn);
    const botName = (config.BOT_NAME || 'DJOUSSE-TECH-MD').toUpperCase();

    if (!result) {
        return reply(box(`🔏 *${botName} — AUTHENTICITÉ*`, [
            { raw: '⚠️ Aucune clé de signature configurée sur cette instance.' },
            { raw: "Ceci n'est probablement PAS un build officiel DJOUSSE TECH." },
            { blank: true },
            { raw: 'Contact officiel : DJOUSSE TECH EVOLUTION' },
        ]));
    }

    await m.react('🔏').catch(() => {});
    return reply(box(`🔏 *${botName} — SIGNATURE D'AUTHENTICITÉ*`, [
        { label: 'Build', value: result.buildId },
        { label: 'Instance', value: maskNumber(result.botNumber) },
        { blank: true },
        { label: 'Code de vérification', value: result.grouped },
        { blank: true },
        { raw: '🔐 Généré par HMAC-SHA256 à partir d\'une clé privée.' },
        { raw: '❌ Ce code ne peut PAS être reproduit sans cette clé,' },
        { raw: '   même en copiant tous les plugins de ce bot.' },
        { blank: true },
        { raw: '© DJOUSSE TECH EVOLUTION — build vérifié ✅' },
    ]));
});
