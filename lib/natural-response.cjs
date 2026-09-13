'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   natural-response.cjs — Couche de réponse naturelle DJOUSSE TECH
   
   Principe : les plugins produisent des données brutes,
   cette couche les transforme en langage humain.
   
   Utilisation dans un plugin :
     const { natural, replyError, replySuccess } = require('../lib/natural-response.cjs');
     await reply(natural('weather', { city: 'Yaoundé', temp: 24, humidity: 78 }));
     await reply(replyError('Impossible de charger la météo'));
     await reply(replySuccess('Audio téléchargé'));
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Templates de réponses naturelles ──────────────────────────────────────

const templates = {
    // Météo
    weather: (d) => {
        const parts = [];
        if (d.city) parts.push(`Il fait ${d.temp}°C à ${d.city}`);
        else parts.push(`Il fait ${d.temp}°C`);
        if (d.humidity) parts.push(`${d.humidity}% d'humidité`);
        if (d.description) parts.push(d.description);
        return parts.join(', ') + '.';
    },

    // Téléchargement
    download: (d) => {
        if (d.title) return `Voilà : ${d.title}`;
        if (d.filename) return `${d.filename} est prêt.`;
        return 'C\'est prêt.';
    },

    // Erreur
    error: (d) => {
        const msg = typeof d === 'string' ? d : d.message || d.text || 'Une erreur est survenue';
        return `Oups, ${msg.charAt(0).toLowerCase() + msg.slice(1)}`;
    },

    // Succès
    success: (d) => {
        const msg = typeof d === 'string' ? d : d.message || d.text || 'C\'est fait';
        return msg.charAt(0).toUpperCase() + msg.slice(1);
    },

    // Recherche
    search: (d) => {
        if (!d.results || !d.results.length) return 'Je n\'ai rien trouvé.';
        if (d.results.length === 1) return `J'ai trouvé : ${d.results[0].title || d.results[0].name || d.results[0]}`;
        return `J'ai trouvé ${d.results.length} résultats. Le premier est "${d.results[0].title || d.results[0].name || d.results[0]}".`;
    },

    // Info simple
    info: (d) => {
        if (typeof d === 'string') return d;
        if (d.text) return d.text;
        const parts = [];
        for (const [k, v] of Object.entries(d)) {
            if (v !== null && v !== undefined && v !== '') parts.push(`${k} : ${v}`);
        }
        return parts.join('\n');
    },

    // Jeu
    game: (d) => {
        if (d.winner) return `${d.winner} gagne !`;
        if (d.question) return d.question;
        if (d.message) return d.message;
        return 'Bonne partie !';
    },

    // Traduction
    translate: (d) => {
        if (d.from && d.to) return `${d.from} → ${d.to}`;
        return d.text || d.translation || '';
    },

    // Musique
    music: (d) => {
        if (d.title) return `🎵 ${d.title}${d.artist ? ' — ' + d.artist : ''}`;
        return 'Voilà la musique.';
    },

    // Sticker
    sticker: () => 'Sticker créé !',
};

// ─── Fonction principale ───────────────────────────────────────────────────

/**
 * Transforme des données brutes en réponse naturelle.
 * @param {string} type - Type de réponse (weather, download, error, etc.)
 * @param {object|string} data - Données à formater
 * @returns {string} Réponse naturelle
 */
function natural(type, data) {
    const template = templates[type];
    if (template) return template(data);
    // Fallback : retourne tel quel
    if (typeof data === 'string') return data;
    if (data.text) return data.text;
    return JSON.stringify(data);
}

// ─── Helpers pour plugins ──────────────────────────────────────────────────

/**
 * Réponse d'erreur naturelle.
 */
function replyError(message) {
    const msg = typeof message === 'string' ? message : String(message);
    // Pas de ❌, pas de "ERREUR", juste un langage humain
    if (msg.startsWith('Oups') || msg.startsWith('Je ne') || msg.startsWith('Impossible')) return msg;
    return `Oups, ${msg.charAt(0).toLowerCase() + msg.slice(1)}`;
}

/**
 * Réponse de succès naturelle.
 */
function replySuccess(message) {
    return message.charAt(0).toUpperCase() + message.slice(1);
}

/**
 * Réponse "pas trouvé".
 */
function replyNotFound(what) {
    return `Je n'ai rien trouvé pour "${what}".`;
}

/**
 * Réponse "usage".
 */
function replyUsage(command, example) {
    return `Utilisation : .${command} ${example}`;
}

/**
 * Réponse "en attente".
 */
function replyLoading(action) {
    return action ? `${action}...` : 'J\'y vais...';
}

/**
 * Réponse "déjà fait".
 */
function replyAlready(action) {
    return `${action} est déjà fait.`;
}

/**
 * Réponse "interdit".
 */
function replyForbidden(reason) {
    return reason || 'Tu n\'as pas le droit de faire ça.';
}

// ─── Strippe le formatage bot d'un texte existant ─────────────────────────

/**
 * Enlève les cadres ASCII et formatage bot d'un texte.
 * Utile pour nettoyer les anciennes réponses.
 */
function stripBotFormat(text) {
    if (!text || typeof text !== 'string') return text;
    return text
        // Cadres ASCII
        .replace(/╭───『.*?』───●●►/g, '')
        .replace(/╰─────────────❖●►/g, '')
        .replace(/╭━⍟「.*?」⍟━┓/g, '')
        .replace(/┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⍟/g, '')
        .replace(/┏━⍟「.*?」⍟━┓/g, '')
        .replace(/╔═+╗/g, '')
        .replace(/╠═+╣/g, '')
        .replace(/╚═+╝/g, '')
        .replace(/┃/g, '')
        .replace(/━{3,}/g, '')
        // Headers bot
        .replace(/^\s*🤖\s*DJOUSSE\s*TECH\s*/gm, '')
        .replace(/^\s*☣\s*DJOUSSE\s*TECH\s*/gm, '')
        // Lignes vides multiples
        .replace(/\n{3,}/g, '\n\n')
        // Footer
        .replace(/>\s*ᴘᴏᴡᴇʀᴇᴅ\s*ʙʏ\s*ᴀɪɴᴏʀɪᴀ\s*$/gm, '')
        .replace(/©\s*DJOUSSE\s*TECH\s*EVOLUTION\s*$/gm, '')
        .trim();
}

module.exports = {
    natural,
    replyError,
    replySuccess,
    replyNotFound,
    replyUsage,
    replyLoading,
    replyAlready,
    replyForbidden,
    stripBotFormat,
    templates,
};
