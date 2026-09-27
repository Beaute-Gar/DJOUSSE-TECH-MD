'use strict';

const templates = {
    weather: (d) => {
        const parts = [];
        if (d.city) parts.push(`Il fait ${d.temp}°C à ${d.city}`);
        else parts.push(`Il fait ${d.temp}°C`);
        if (d.humidity) parts.push(`${d.humidity}% d'humidité`);
        if (d.description) parts.push(d.description);
        return parts.join(', ') + '.';
    },
    download: (d) => {
        if (d.title) return `Voilà : ${d.title}`;
        if (d.filename) return `${d.filename} est prêt.`;
        return 'C\'est prêt.';
    },
    error: (d) => {
        const msg = typeof d === 'string' ? d : d.message || d.text || 'Une erreur est survenue';
        return `Oups, ${msg.charAt(0).toLowerCase() + msg.slice(1)}`;
    },
    success: (d) => {
        const msg = typeof d === 'string' ? d : d.message || d.text || 'C\'est fait';
        return msg.charAt(0).toUpperCase() + msg.slice(1);
    },
    search: (d) => {
        if (!d.results || !d.results.length) return 'Je n\'ai rien trouvé.';
        if (d.results.length === 1) return `J'ai trouvé : ${d.results[0].title || d.results[0].name || d.results[0]}`;
        return `J'ai trouvé ${d.results.length} résultats. Le premier est "${d.results[0].title || d.results[0].name || d.results[0]}".`;
    },
    info: (d) => {
        if (typeof d === 'string') return d;
        if (d.text) return d.text;
        const parts = [];
        for (const [k, v] of Object.entries(d)) {
            if (v !== null && v !== undefined && v !== '') parts.push(`${k} : ${v}`);
        }
        return parts.join('\n');
    },
    game: (d) => {
        if (d.winner) return `${d.winner} gagne !`;
        if (d.question) return d.question;
        if (d.message) return d.message;
        return 'Bonne partie !';
    },
    translate: (d) => {
        if (d.from && d.to) return `${d.from} → ${d.to}`;
        return d.text || d.translation || '';
    },
    music: (d) => {
        if (d.title) return `🎵 ${d.title}${d.artist ? ' — ' + d.artist : ''}`;
        return 'Voilà la musique.';
    },
    sticker: () => 'Sticker créé !',
};

function natural(type, data) {
    const template = templates[type];
    if (template) return template(data);
    if (typeof data === 'string') return data;
    if (data.text) return data.text;
    return JSON.stringify(data);
}

function replyError(message) {
    const msg = typeof message === 'string' ? message : String(message);
    if (msg.startsWith('Oups') || msg.startsWith('Je ne') || msg.startsWith('Impossible')) return msg;
    return `Oups, ${msg.charAt(0).toLowerCase() + msg.slice(1)}`;
}

function replySuccess(message) {
    return message.charAt(0).toUpperCase() + message.slice(1);
}

function replyNotFound(what) {
    return `Je n'ai rien trouvé pour "${what}".`;
}

function replyUsage(command, example) {
    return `Utilisation : .${command} ${example}`;
}

function replyLoading(action) {
    return action ? `${action}...` : 'J\'y vais...';
}

function replyAlready(action) {
    return `${action} est déjà fait.`;
}

function replyForbidden(reason) {
    return reason || 'Tu n\'as pas le droit de faire ça.';
}

function stripBotFormat(text) {
    if (!text || typeof text !== 'string') return text;
    return text
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
        .replace(/^\s*🤖\s*DJOUSSE\s*TECH\s*/gm, '')
        .replace(/^\s*☣\s*DJOUSSE\s*TECH\s*/gm, '')
        .replace(/\n{3,}/g, '\n\n')
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
