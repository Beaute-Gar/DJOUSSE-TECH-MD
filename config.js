/**
 * Configuration globale - DJOUSSE TECH MD
 * Basé sur KnightBot-Mini, adapté par Beaute Gar
 */

require('dotenv').config();

module.exports = {
    // Propriétaire du bot
    ownerNumber: [process.env.OWNER_NUMBER || '237693978044'],
    ownerName: [process.env.OWNER_NAME || 'Beaute Gar'],

    // Configuration du bot
    botName: process.env.BOT_NAME || 'DJOUSSE TECH',
    prefix: process.env.PREFIX || '.',
    sessionName: 'session',
    sessionID: process.env.SESSION_ID || '',
    newsletterJid: process.env.NEWSLETTER_JID || '',
    updateZipUrl: 'https://github.com/Beaute-Gar/DJOUSSE-TECH-MD/archive/refs/heads/main.zip',

    // Sticker
    packname: process.env.PACK_NAME || 'DJOUSSE TECH',

    // Comportement du bot
    selfMode: false,
    autoRead: false,
    autoTyping: false,
    autoBio: false,
    autoSticker: false,
    autoReact: true,
    autoReactMode: 'bot',
    autoDownload: false,

    // Paramètres par défaut des groupes
    defaultGroupSettings: {
        antilink: false,
        antilinkAction: 'delete',
        antitag: false,
        antitagAction: 'delete',
        antiall: false,
        antiviewonce: false,
        antibot: false,
        antibotAction: 'warn',
        anticall: false,
        antigroupmention: false,
        antigroupmentionAction: 'delete',
        antigroupstatus: false,
        antigroupstatusAction: 'delete',
        antisticker: false,
        antistickerAction: 'delete',
        antibadword: false,
        antibadwordAction: 'delete',
        welcome: false,
        welcomeMessage: 'Hey @user, bienvenue dans @group ! Fais comme chez toi.\nMembres: #memberCount',
        goodbye: false,
        goodbyeMessage: '@user a quitté le groupe. Salut !',
        antiSpam: false,
        antidelete: false,
        nsfw: false,
        detect: false,
        chatbot: false,
        autosticker: false
    },

    // Clés API
    apiKeys: {
        openai: process.env.OPENAI_API_KEY || '',
        deepai: process.env.DEEPAI_API_KEY || '',
        remove_bg: process.env.REMOVEBG_API_KEY || '',
        groq: process.env.GROQ_API_KEY || '',
        gemini: process.env.GEMINI_API_KEY || ''
    },

    // Messages (style humain)
    messages: {
        wait: 'Attendez un peu...',
        success: 'C est fait !',
        error: 'Oups, ça a pas marché. Réessaie.',
        ownerOnly: 'C est une commande réservée au propriétaire.',
        adminOnly: 'Faut être admin pour ça.',
        groupOnly: 'C est une commande de groupe ça.',
        privateOnly: 'Utilise ça en privé.',
        botAdminNeeded: 'Le bot doit être admin pour faire ça.',
        invalidCommand: 'Commande inconnue. Tape .menu pour voir les options.'
    },

    // Fuseau horaire
    timezone: 'Africa/Douala',

    // Limites
    maxWarnings: 3,

    // Liens sociaux
    social: {
        github: 'https://github.com/Beaute-Gar/DJOUSSE-TECH-MD',
        instagram: '',
        youtube: ''
    },

    // Auto Status Quotes
    statusQuotes: {
        enabled: process.env.STATUS_QUOTES_ENABLED === 'true',
        intervalHours: parseInt(process.env.STATUS_QUOTES_INTERVAL_HOURS || '6', 10),
        maxLength: parseInt(process.env.STATUS_QUOTES_MAX_LENGTH || '350', 10),
        cacheRefreshHours: parseInt(process.env.STATUS_QUOTES_CACHE_REFRESH_HOURS || '6', 10),
        noRepeatDays: parseInt(process.env.STATUS_QUOTES_NO_REPEAT_DAYS || '30', 10),
        source: process.env.STATUS_QUOTES_SOURCE || 'zenquotes',
        fallback: process.env.STATUS_QUOTES_FALLBACK || 'quotable',
        timezone: process.env.STATUS_QUOTES_TIMEZONE || 'Africa/Douala',
        schedule: process.env.STATUS_QUOTES_SCHEDULE || '07:00,12:00,18:00,21:00',
    }
};
