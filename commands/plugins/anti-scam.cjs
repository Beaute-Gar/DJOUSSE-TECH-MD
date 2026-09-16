'use strict';

const { cmd } = require('../command.cjs');

// ─── Patterns de scam ────────────────────────────────────────────
const SCAM_PATTERNS = [
    /félicitations?\s*[!.]*\s*(vous? )?(gagn|recevr|obtien)/i,
    /cliquez?\s+(ici|sur|pour)\s+.*\d+\s*(fcfa|€|\$|dollars?)/i,
    /offre?\s+(spéciale|limitée|exclusive)/i,
    /gagn(é|ez|er)?\s+\d+[\s.]*(fcfa|€|\$)/i,
    /investis(sez|sment)?\s+\d+.*\d+%/i,
    /urgence\s*[:!]\s*(compte|bloqu|suspend)/i,
    /vérifiez?\s+(votre|ton)\s+(compte|identité|profil)/i,
    /whatsapp\s+(gratuit|premium|pro)\s+(version|offre)/i,
    /link.*\.(xyz|top|buzz|click|money)/i,
    /money\s*maker|revenu\s+passif|finance\s+facile/i,
    /faites?\s+de\s+l'argent\s+(facilement|rapidement)/i,
    /terminal\s+(de\s+)?paiement|western\s+union/i,
    /loterie|lotto|tirage\s+au\s+sort/i,
    /succès\s+garanti|résultat\s+garanti/i,
    /cliquez\s+rapidement|agissez\s+vite|offre\s+de\s+temps/i,
    /\d+%\s+de\s+réduction\s+immédiate/i,
    /recrute\s+(agent|membre|collaborateur)/i,
    /roi\s+d'argent|prince\s+nigérian|héritage/i,
];

const SPAM_PATTERNS = [
    /join\s+now|rejoindre\s+maintenant/i,
    /free\s+followers|abonnés\s+gratuits/i,
    /hack\s+whatsapp|pirater/i,
    /tarot|voyant|medium|destin/i,
];

// ─── Analyser un message ─────────────────────────────────────────
function analyzeMessage(text) {
    if (!text || text.length < 10) return null;

    let score = 0;
    const signals = [];

    // Scam patterns
    for (const pattern of SCAM_PATTERNS) {
        if (pattern.test(text)) {
            score += 25;
            signals.push(pattern.source.slice(0, 40));
        }
    }

    // Spam patterns
    for (const pattern of SPAM_PATTERNS) {
        if (pattern.test(text)) {
            score += 15;
            signals.push('spam pattern');
        }
    }

    // Indicateurs supplémentaires
    if (/\d{6,}/.test(text)) { score += 10; signals.push('nombre suspect'); }
    if ((text.match(/!/g) || []).length > 3) { score += 10; signals.push('excess punctuation'); }
    if (text.toUpperCase() === text && text.length > 20) { score += 5; signals.push('tout en majuscules'); }
    if ((text.match(/https?:\/\//g) || []).length > 2) { score += 10; signals.push('multiples liens'); }

    if (score === 0) return null;

    return {
        score: Math.min(score, 100),
        signals: [...new Set(signals)].slice(0, 5),
        level: score >= 70 ? '🔴 Élevé' : score >= 40 ? '🟡 Moyen' : '🟢 Faible'
    };
}

// ─── Export pour intégration automatique ──────────────────────────
function checkAndWarn(conn, jid, msg, text) {
    const result = analyzeMessage(text);
    if (!result || result.score < 40) return false;

    const sender = msg.key?.participant || msg.key?.remoteJid;
    conn.sendMessage(jid, {
        text: `🚨 *MESSAGE SUSPECT*\n\n` +
              `@${sender?.replace(/[^0-9]/g, '')}\n\n` +
              `📊 Risque : ${result.score}% — ${result.level}\n` +
              `📡 Signaux : ${result.signals.join(', ')}`,
        mentions: sender ? [sender] : []
    }).catch(() => {});

    return true;
}

// ─── .analyze <message> ──────────────────────────────────────────
cmd({
    pattern: 'analyze',
    alias: ['analyser', 'scan'],
    desc: 'Analyser un message suspect',
    category: 'security',
    filename: __filename
}, async (conn, m, commands, { q, reply }) => {
    const text = q || m.quoted?.message?.conversation
        || m.quoted?.message?.extendedTextMessage?.text;

    if (!text) return reply('❌ Réponds à un message avec .analyze');

    const result = analyzeMessage(text);

    if (!result) {
        return reply(
            `┏━⍟「 ☣ ANALYSE ☣ 」⍟━┓\n` +
            `┃\n` +
            `┃ ✅ Message analysé\n` +
            `┃ 📊 Risque : 0% — Aucun signal\n` +
            `┃\n` +
            `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⍟`
        );
    }

    return reply(
        `┏━⍟「 ☣ ANALYSE ☣ 」⍟━┓\n` +
        `┃\n` +
        `┃ 🚨 Risque : ${result.score}% — ${result.level}\n` +
        `┃\n` +
        `┃ 📡 Signaux détectés :\n` +
        result.signals.map(s => `┃   • ${s}`).join('\n') + '\n' +
        `┃\n` +
        `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⍟`
    );
});

module.exports = { analyzeMessage, checkAndWarn };
