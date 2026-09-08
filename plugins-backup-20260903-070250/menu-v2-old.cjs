/**
 * ══════════════════════════════════════════════════════════════
 *  DJOUSSE TECH — Menu Interactif v2.0
 *  
 *  Menu à boutons/liste comme WhatsApp Business.
 *  6 catégories principales → sous-menus avec commandes.
 *  
 *  Flux:
 *    .menu → message avec 6 boutons (liste WhatsApp)
 *    Clic sur un bouton → sous-menu avec les commandes
 *    Clic sur une commande → exécution directe
 * ══════════════════════════════════════════════════════════════
 */

const { cmd, commands } = require('../command.cjs');
const config = require('../config-djousse.cjs');
const { uptime } = require('../lib/djousse-ui.cjs');

// ══════════════════════════════════════════════════════════════
//  CATÉGORIES PRINCIPALES (6 boutons)
// ══════════════════════════════════════════════════════════════

const MAIN_CATEGORIES = {
    ia: {
        emoji: '🤖', nom: 'IA / Intelligence',
        desc: 'Brain AINORIA, Gemini, GPT, DeepSeek...',
        commands: [
            { cmd: 'ai', label: 'Brain AINORIA', desc: 'IA principal — pose une question' },
            { cmd: 'ask', label: 'Question directe', desc: 'Question rapide à l\'IA' },
            { cmd: 'gemini', label: 'Google Gemini', desc: 'Modèle Gemini de Google' },
            { cmd: 'deepseek', label: 'DeepSeek Coder', desc: 'Coder avec DeepSeek' },
            { cmd: 'openai', label: 'OpenAI GPT', desc: 'GPT-4 de OpenAI' },
            { cmd: 'qwen', label: 'Qwen Turbo', desc: 'Modèle Qwen' },
            { cmd: 'nova', label: 'Nova AI', desc: 'Assistant Nova' },
            { cmd: 'reason', label: 'Reasoning', desc: 'Moteur de raisonnement' },
            { cmd: 'vision', label: 'Vision', desc: 'Analyser une image' },
            { cmd: 'transcribe', label: 'Transcrire', desc: 'Audio → Texte' },
            { cmd: 'aiimg', label: 'Générer image', desc: 'Créer une image par IA' },
            { cmd: 'draw', label: 'Dessin IA', desc: 'Dessiner par IA' },
            { cmd: 'summarize', label: 'Résumer', desc: 'Résumé intelligent' },
            { cmd: 'chatbot', label: 'Chatbot', desc: 'Mode conversationnel' },
        ]
    },
    dl: {
        emoji: '📥', nom: 'Téléchargement',
        desc: 'YouTube, TikTok, Instagram, Spotify...',
        commands: [
            { cmd: 'song', label: '🎵 Musique', desc: 'Télécharger audio YouTube' },
            { cmd: 'video', label: '📹 Vidéo', desc: 'Télécharger vidéo YouTube' },
            { cmd: 'tiktok', label: '🎵 TikTok', desc: 'Vidéo TikTok sans filigrane' },
            { cmd: 'ig', label: '📸 Instagram', desc: 'Photo/vidéo Instagram' },
            { cmd: 'fb', label: '📘 Facebook', desc: 'Vidéo Facebook' },
            { cmd: 'pinterest', label: '📌 Pinterest', desc: 'Image Pinterest' },
            { cmd: 'spotify', label: '🎶 Spotify', desc: 'Musique Spotify' },
            { cmd: 'apk', label: '📱 APK', desc: 'Application Android' },
        ]
    },
    create: {
        emoji: '🎨', nom: 'Création',
        desc: 'Stickers, logos, images, conversions...',
        commands: [
            { cmd: 'sticker', label: '🎨 Sticker', desc: 'Image → Sticker' },
            { cmd: 'toimg', label: '🖼️ → Image', desc: 'Sticker → Image' },
            { cmd: 'tomp3', label: '🔊 → Audio', desc: 'Vidéo → MP3' },
            { cmd: 'tovideo', label: '📹 → Vidéo', desc: 'Sticker → Vidéo' },
            { cmd: 'togif', label: '🎞️ → GIF', desc: 'Vidéo → GIF' },
            { cmd: 'logolist', label: '🪄 Logos', desc: 'Créer un logo' },
            { cmd: 'neon', label: '💡 Néon', desc: 'Style néon' },
            { cmd: 'gold', label: '✨ Doré', desc: 'Style doré' },
            { cmd: 'translate', label: '🌍 Traduire', desc: 'Traduire un texte' },
            { cmd: 'tts', label: '🎤 Voix', desc: 'Texte → Voix' },
        ]
    },
    group: {
        emoji: '👥', nom: 'Groupe',
        desc: 'Gérer les membres, sondages, config...',
        commands: [
            { cmd: 'kick', label: '🚫 Expulser', desc: 'Retirer un membre' },
            { cmd: 'add', label: '➕ Ajouter', desc: 'Ajouter un membre' },
            { cmd: 'promote', label: '⬆️ Promouvoir', desc: 'Promouvoir admin' },
            { cmd: 'demote', label: '⬇️ Rétrograder', desc: 'Retirer admin' },
            { cmd: 'warn', label: '⚠️ Avertir', desc: 'Avertir un membre' },
            { cmd: 'poll', label: '📊 Sondage', desc: 'Créer un sondage' },
            { cmd: 'link', label: '🔗 Lien', desc: 'Lien du groupe' },
            { cmd: 'setname', label: '✏️ Nom', desc: 'Changer nom groupe' },
            { cmd: 'setpp', label: '🖼️ Photo', desc: 'Photo du groupe' },
            { cmd: 'setwelcome', label: '👋 Bienvenue', desc: 'Message d\'accueil' },
            { cmd: 'setgoodbye', label: '👋 Au revoir', desc: 'Message de départ' },
            { cmd: 'groupinfo', label: 'ℹ️ Infos', desc: 'Infos du groupe' },
        ]
    },
    tools: {
        emoji: '🛠️', nom: 'Outils',
        desc: 'QR code, calcul, encode, capture...',
        commands: [
            { cmd: 'qrcode', label: '📱 QR Code', desc: 'Générer un QR code' },
            { cmd: 'qr', label: '📷 Lire QR', desc: 'Lire un QR code' },
            { cmd: 'calc', label: '🧮 Calculer', desc: 'Calculatrice' },
            { cmd: 'ss', label: '📸 Capture', desc: 'Capture d\'écran web' },
            { cmd: 'shorturl', label: '🔗 Raccourcir', desc: 'Raccourcir un lien' },
            { cmd: 'base64', label: '🔐 Base64', desc: 'Encoder/Decoder' },
            { cmd: 'morse', label: '📡 Morse', desc: 'Code Morse' },
            { cmd: 'passgen', label: '🔑 Mot de passe', desc: 'Générer un mot de passe' },
            { cmd: 'jsonfmt', label: '{ } JSON', desc: 'Formater du JSON' },
            { cmd: 'tourl', label: '🌐 Upload', desc: 'Upload image/fichier' },
            { cmd: 'color', label: '🎨 Couleur', desc: 'Couleur aléatoire' },
            { cmd: 'define', label: '📖 Définition', desc: 'Définition d\'un mot' },
        ]
    },
    admin: {
        emoji: '⚙️', nom: 'Admin & Stats',
        desc: 'Système, sécurité, owner, broadcast...',
        commands: [
            { cmd: 'alive', label: '✅ Alive', desc: 'Statut du bot' },
            { cmd: 'ping', label: '🏓 Ping', desc: 'Test de latence' },
            { cmd: 'diagnostic', label: '🔍 Diagnostic', desc: 'Diagnostic complet' },
            { cmd: 'mode', label: '🔄 Mode', desc: 'Public / Privé' },
            { cmd: 'restart', label: '♻️ Restart', desc: 'Redémarrer le bot' },
            { cmd: 'broadcast', label: '📢 Broadcast', desc: 'Diffuser un message' },
            { cmd: 'system', label: '💻 Système', desc: 'Infos système' },
            { cmd: 'security', label: '🛡️ Sécurité', desc: 'Paramètres sécurité' },
            { cmd: 'personality', label: '🧠 Personnalité', desc: 'Personnalité IA' },
            { cmd: 'config', label: '⚡ Config', desc: 'Configuration bot' },
        ]
    }
};

// ══════════════════════════════════════════════════════════════
//  COMMANDE PRINCIPALE .menu → Envoie la liste à 6 sections
// ══════════════════════════════════════════════════════════════

cmd({
    pattern: 'menu',
    alias: ['commands', 'cmd', 'aide', 'help', 'h', 'menu3'],
    desc: 'Menu interactif avec boutons',
    category: 'main',
    filename: __filename,
}, async (conn, m) => {
    const user = m.sender.split('@')[0];
    const totalCmds = commands.filter(c => !c.dontAddCommandList && typeof c.pattern === 'string').length;

    // ── Texte du message principal ──
    const header = [
        `╭━━━━━━━━━━━━━━━━━━━━━━━━━╮`,
        `┃  🤖 *DJOUSSE TECH*`,
        `┃  ⚡ ${totalCmds}+ commandes`,
        `┃  ⏱️ ${uptime(process.uptime())}`,
        `╰━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
        ``,
        `👋 Salut *${user}* !`,
        `Choisis une catégorie :`,
    ].join('\n');

    // ── Sections pour le listMessage ──
    const sections = [];

    for (const [key, cat] of Object.entries(MAIN_CATEGORIES)) {
        const rows = cat.commands.map(c => ({
            title: `${cat.emoji} .${c.cmd}`,
            description: c.desc,
            rowId: `.${c.cmd}`,
        }));

        sections.push({
            title: `${cat.emoji} ${cat.nom}`,
            rows,
        });
    }

    // ── Envoi du menu liste ──
    try {
        await conn.sendMessage(m.chat, {
            text: header,
            title: '🤖 DJOUSSE TECH',
            buttonText: '📋 Voir les catégories',
            footer: `© DJOUSSE TECH · ${totalCmds}+ commandes`,
            sections,
        });
    } catch (e) {
        // Fallback : menu texte simple si listMessage échoue
        console.log('[MENU] listMessage échec, fallback texte:', e.message);
        await m.reply(generateTextMenu(totalCmds, user));
    }
});

// ══════════════════════════════════════════════════════════════
//  SOUS-MENUS → Commande par catégorie
// ══════════════════════════════════════════════════════════════

for (const [key, cat] of Object.entries(MAIN_CATEGORIES)) {
    cmd({
        pattern: `menu ${key}`,
        alias: [`menu${key}`, `cat ${key}`],
        desc: `Sous-menu ${cat.nom}`,
        category: 'main',
        filename: __filename,
        dontAddCommandList: true,
    }, async (conn, m) => {
        const totalCmds = cat.commands.length;

        const header = [
            `${cat.emoji} *${cat.nom}*`,
            `${cat.desc}`,
            ``,
            `📦 ${totalCmds} commandes disponibles`,
            `Tapez le nom d'une commande :`,
        ].join('\n');

        const rows = cat.commands.map(c => ({
            title: `.${c.cmd}`,
            description: c.desc,
            rowId: `.${c.cmd}`,
        }));

        try {
            await conn.sendMessage(m.chat, {
                text: header,
                title: `${cat.emoji} ${cat.nom}`,
                buttonText: `📋 Voir les ${cat.nom}`,
                footer: `© DJOUSSE TECH`,
                sections: [{
                    title: `${cat.emoji} ${cat.nom}`,
                    rows,
                }],
            });
        } catch (e) {
            // Fallback texte
            let text = header + '\n\n';
            cat.commands.forEach((c, i) => {
                text += `${String(i + 1).padStart(2, '0')}. *${c.label}* — ${c.desc}\n`;
                text += `    ${config.PREFIX || '.'}${c.cmd}\n\n`;
            });
            await m.reply(text);
        }
    });
}

// ══════════════════════════════════════════════════════════════
//  MENU TEXTE FALLBACK
// ══════════════════════════════════════════════════════════════

function generateTextMenu(totalCmds, user) {
    const p = config.PREFIX || '.';
    let text = '';

    text += `╭━━━━━━━━━━━━━━━━━━━━━━━━━╮\n`;
    text += `┃  🤖 *DJOUSSE TECH EVOLUTION*\n`;
    text += `┃  ⚡ ${totalCmds}+ commandes\n`;
    text += `╰━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n`;

    text += `👋 Salut *${user}* !\n\n`;

    for (const [key, cat] of Object.entries(MAIN_CATEGORIES)) {
        text += `${cat.emoji} *${cat.nom}*\n`;
        text += `${cat.desc}\n`;
        cat.commands.forEach(c => {
            text += `  • \`${p}${c.cmd}\` — ${c.desc}\n`;
        });
        text += `\n`;
    }

    text += `╭━━━━━━━━━━━━━━━━━━━━━━━━━╮\n`;
    text += `┃  📊 Total: *${totalCmds}+ commandes*\n`;
    text += `╰━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n`;
    text += `> © DJOUSSE TECH`;

    return text;
}

module.exports = { MAIN_CATEGORIES };
