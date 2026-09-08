/**
 * Smart Router — DJOUSSE-TECH-MD v3.0
 * 
 * Détection d'intention en langage naturel SANS préfixe.
 * L'utilisateur tape "télécharge cette vidéo TikTok" → le bot comprend et exécute .tiktok
 * 
 * Compatible CJS (require), fonctionne avec le système de commandes existant.
 * 
 * Usage dans index.cjs :
 *   const { smartRouter } = require('./src/smart-router.cjs');
 *   // AVANT if (!isCmd) continue;
 *   const routed = await smartRouter(sock, msg, m, config);
 *   if (routed) continue;
 */

const COMMANDES = require('../command.cjs');
const { all: getSettings } = require('../lib/settings.cjs');

/* ═══════════════════════════════════════════════════════════════════
   PATTERNS D'INTENTION — chaque entrée = { intent, patterns, cmd, priority }
   priority: 1 = fort (match exact), 2 = moyen (mots-clés), 3 = faible (ambigu)
   ═══════════════════════════════════════════════════════════════════ */
const INTENT_PATTERNS = [
    // ── TÉLÉCHARGEMENT ──
    {
        intent: 'download_tiktok',
        patterns: [
            /tiktok\s*(downlo?ad|télécharge|dl|va|sauvegarde|enregistre)/i,
            /(télécharge|download|dl|va|sauvegarde|enregistre).*tiktok/i,
            /tiktok\.com/i,
            /vm\.tiktok\.com/i,
            /vt\.tiktok\.com/i,
        ],
        cmd: 'tiktok',
        priority: 1,
    },
    {
        intent: 'download_youtube',
        patterns: [
            /youtube\s*(downlo?ad|télécharge|dl|va|sauvegarde|musique|audio|video)/i,
            /(télécharge|download|dl|va|sauvegarde).*youtube/i,
            /youtube\.com\/watch/i,
            /youtu\.be\//i,
            /play\s*(musique|music|audio|video|vidéo)/i,
            /(écoute|joue|play)\s+(de\s+)?la\s+musique/i,
        ],
        cmd: 'play',
        priority: 1,
    },
    {
        intent: 'download_instagram',
        patterns: [
            /instagram\s*(downlo?ad|télécharge|dl|va|sauvegarde)/i,
            /(télécharge|download|dl|va|sauvegarde).*instagram/i,
            /instagram\.com\/(p|reel|story)/i,
            /instagr\.am/i,
        ],
        cmd: 'igdl',
        priority: 1,
    },
    {
        intent: 'download_facebook',
        patterns: [
            /facebook\s*(downlo?ad|télécharge|dl|va|sauvegarde)/i,
            /(télécharge|download|dl|va|sauvegarde).*facebook/i,
            /facebook\.com\/.*\/videos?/i,
            /fb\.watch/i,
        ],
        cmd: 'fbdl',
        priority: 1,
    },
    {
        intent: 'download_twitter',
        patterns: [
            /twitter\s*(downlo?ad|télécharge|dl|va|sauvegarde)/i,
            /(télécharge|download|dl|va|sauvegarde).*twitter/i,
            /x\.com\/.*\/status/i,
            /twitter\.com\/.*\/status/i,
        ],
        cmd: 'twtdl',
        priority: 1,
    },
    {
        intent: 'download_soundcloud',
        patterns: [
            /soundcloud\s*(downlo?ad|télécharge|dl|va)/i,
            /(télécharge|download|dl).*soundcloud/i,
            /soundcloud\.com/i,
        ],
        cmd: 'scdl',
        priority: 1,
    },
    {
        intent: 'download_media',
        patterns: [
            /(télécharge|download|dl|va|sauvegarde|enregistre)\s+(ce|cette|le|la|l')?\s*(vidéo|video|musique|audio|photo|image|média)/i,
            /sauvegarde\s+(ce|cette|le|la)\s*(message|média)/i,
        ],
        cmd: 'save',
        priority: 2,
    },

    // ── RECHERCHE ──
    {
        intent: 'search_google',
        patterns: [
            /cherche\s+(sur\s+)?google\s+(pour\s+)?(.+)/i,
            /google\s+(search|recherche|cherche)\s+(pour\s+)?(.+)/i,
            /qu'est[- ]?ce\s+que\s+(c'est|sont?|fait|veut\s+dire)\s+(.+)/i,
            /c'est\s+quoi\s+(.+)/i,
            /define\s+(.+)/i,
            /défini(r|tion)\s+(.+)/i,
        ],
        cmd: 'google',
        priority: 2,
    },
    {
        intent: 'search_image',
        patterns: [
            /recherche\s+(d['']?)?images?\s+(pour|de|du|des)\s+(.+)/i,
            /image\s+(de|du|des|pour)\s+(.+)/i,
            /photo\s+(de|du|des|pour)\s+(.+)/i,
        ],
        cmd: 'image',
        priority: 2,
    },
    {
        intent: 'search_lyrics',
        patterns: [
            /paroles?\s+(de\s+)?(.+)/i,
            /lyrics?\s+(for\s+)?(.+)/i,
            /cherche\s+les?\s+paroles?\s+(de\s+)?(.+)/i,
        ],
        cmd: 'lyrics',
        priority: 2,
    },

    // ── CONVERSION ──
    {
        intent: 'convert_sticker',
        patterns: [
            /(convert|transforme|fais)\s+(en\s+)?sticker/i,
            /sticker\s+(de|à|en|from)/i,
            /passe?\s+(ce|cette|le|la)\s+(en\s+)?sticker/i,
        ],
        cmd: 's',
        priority: 1,
    },
    {
        intent: 'convert_toimg',
        patterns: [
            /(convert|transforme)\s+(le\s+)?sticker\s+(en\s+)?(image|photo|img)/i,
            /sticker\s+vers?\s+(image|photo)/i,
            /passe?\s+le\s+sticker\s+(en\s+)?(image|photo)/i,
            /toimg/i,
        ],
        cmd: 'toimg',
        priority: 1,
    },
    {
        intent: 'convert_tomp3',
        patterns: [
            /(convert|transforme)\s+(la\s+)?(vidéo|video)\s+(en\s+)?(audio|mp3|musique)/i,
            /(vidéo|video)\s+vers?\s+(audio|mp3)/i,
            /passe?\s+(la\s+)?vidéo\s+(en\s+)?mp3/i,
            /tomp3/i,
        ],
        cmd: 'tomp3',
        priority: 1,
    },
    {
        intent: 'convert_tovideo',
        patterns: [
            /(convert|transforme)\s+(le\s+)?sticker\s+(en\s+)?(vidéo|video)/i,
            /sticker\s+vers?\s+vidéo/i,
        ],
        cmd: 'tovideo',
        priority: 1,
    },
    {
        intent: 'convert_translate',
        patterns: [
            /(traduit|traduire|translate)\s+(ce|cette|le|la|ça|cela)\s+(en\s+)?(.+)/i,
            /en\s+(français|anglais|espagnol|arabe|allemand|italien|portugais)\s*(s'il\s+te\s+plaît|stp|pls)?$/i,
            /comment\s+dit[- ]?on\s+(.+?)\s+en\s+(.+)/i,
        ],
        cmd: 'translate',
        priority: 1,
    },

    // ── IA / BRAIN ──
    {
        intent: 'ai_chat',
        patterns: [
            /^(bonjour|salut|hey|hello|hi|yo|bonsoir|coucou|slt|bjr)\s*(.+)/i,
            /^(comment\s+tu\s+v|ça\s+va|how\s+are\s+you|ça\s+va\s+?)$/i,
            /(aide[- ]?moi|help|help\s+me|assist|assiste[- ]?moi)\s+(à|a|de)?\s*(.+)/i,
            /(explique|dis[- ]?moi|raconte|comprends?)\s+(moi\s+)?(.+)/i,
            /(quel|quelle|quels|quelles)\s+(est|sont)\s+(le|la|les|l')\s*(.+)/i,
            /(compute|calcul|calcule|résout)\s+(.+)/i,
        ],
        cmd: 'ai',
        priority: 3,
    },
    {
        intent: 'ai_brain',
        patterns: [
            /brain\s*(.+)/i,
            /pense\s+(à|a)\s+(.+)/i,
            /réfléchis\s+(à|a|sur)\s+(.+)/i,
        ],
        cmd: 'brain',
        priority: 2,
    },

    // ── STICKER / MEDIA ──
    {
        intent: 'sticker_make',
        patterns: [
            /(?:faire?|crée?|génère?|makes?)\s+(?:un\s+)?stick(?:er|s)/i,
            /stick(?:er|s)\s+(?:de|à|avec|from)/i,
            /(ce|cette|le|la)\s+(image|photo|vidéo|gif)\s+en\s+sticker/i,
        ],
        cmd: 's',
        priority: 2,
    },

    // ── OUTILS ──
    {
        intent: 'tool_qrcode',
        patterns: [
            /(génère?|crée?|faire?|make)\s+(un\s+)?qr\s*code/i,
            /qr\s*code\s+(de|pour|avec)\s+(.+)/i,
            /code\s+qr/i,
        ],
        cmd: 'qrcode',
        priority: 2,
    },
    {
        intent: 'tool_calc',
        patterns: [
            /(?:calcule?|compute|résout?|calcul)\s+(.+)/i,
            /(?:combien\s+fait|how\s+much)\s+(.+)/i,
            /(\d+[\s]*[\+\-\*\/\^][\s]*\d+.*)/i,
        ],
        cmd: 'calc',
        priority: 2,
    },
    {
        intent: 'tool_ocr',
        patterns: [
            /(?:lis|read|ocr|texte)\s+(ce|cette|le|la)\s+(image|photo|capture|screenshot)/i,
            /(?:extrais?|extract)\s+(le\s+)?texte\s+(de|dans|from)\s+(.+)/i,
            /image\s+vers?\s+texte/i,
        ],
        cmd: 'ocr',
        priority: 2,
    },
    {
        intent: 'tool_weather',
        patterns: [
            /(?:meteo|météo|weather|temps)\s+(à|a|de|in|at|pour)\s+(.+)/i,
            /(?:quel\s+temps|what\s+weather)\s+(fait|il\s+fait)\s+(à|a|in|at)\s+(.+)/i,
            /il\s+fait\s+(quel\s+)?temps\s+(à|a|in|at)\s+(.+)/i,
        ],
        cmd: 'weather',
        priority: 2,
    },
    {
        intent: 'toolShorturl',
        patterns: [
            /(?:raccourcis?|short(?:en)?|court)\s+(le\s+)?lien\s+(.+)/i,
            /lien\s+(raccourci|court|court|short)/i,
        ],
        cmd: 'shorturl',
        priority: 2,
    },

    // ── VOIX ──
    {
        intent: 'voice_tts',
        patterns: [
            /(?:dis|dit|parle|speak|say)\s+(.+)/i,
            /(?:enregistre|record|envoie)\s+(un\s+)?message\s+(vocal|audio|voice)/i,
            /tts\s+(.+)/i,
            /voice\s+(.+)/i,
        ],
        cmd: 'tts',
        priority: 2,
    },

    // ── GROUPE ──
    {
        intent: 'group_link',
        patterns: [
            /(?:donne|give|montre|show)\s+(le\s+)?lien\s+(du\s+)?groupe/i,
            /lien\s+d['']?invitation/i,
            /group\s+link/i,
        ],
        cmd: 'link',
        priority: 2,
    },
    {
        intent: 'group_info',
        patterns: [
            /(?:info|information|détails?)\s+(du\s+groupe|groupe|group)/i,
            /(?:quel\s+est\s+le\s+nom|comment\s+s'appelle)\s+(le\s+)?groupe/i,
        ],
        cmd: 'groupinfo',
        priority: 2,
    },

    // ── PROFIL ──
    {
        intent: 'profile',
        patterns: [
            /(?:mon\s+profil|profile|ma\s+fiche|mes\s+infos)/i,
            /(?:qui\s+suis[- ]?je|who\s+am\s+i)/i,
            /(?:niveau|level|xp|points?)\s+(de\s+)?moi/i,
        ],
        cmd: 'profil',
        priority: 2,
    },

    // ── OWNER ──
    {
        intent: 'owner_info',
        patterns: [
            /(?:qui\s+(a|est)\s+(créé|fait|build|développé))\s+(le\s+)?bot/i,
            /(?:ton\s+)?créateur|developer|dev|owner|propriétaire/i,
            /(?:contacte?\s+(le\s+)?owner|parle\s+au\s+propriétaire)/i,
        ],
        cmd: 'owner',
        priority: 2,
    },
];

/* ═══════════════════════════════════════════════════════════════════
   CONTEXTE SUPPLÉMENTAIRE — extraction d'URL / argument
   ═══════════════════════════════════════════════════════════════════ */

function extraireURL(texte) {
    const urlRegex = /https?:\/\/[^\s]+/gi;
    const match = texte.match(urlRegex);
    return match ? match[0] : null;
}

function extraireArgument(texte, intent) {
    // Nettoyer le texte de détection
    let arg = texte;
    
    // Supprimer les salutations
    arg = arg.replace(/^(salut|bonjour|hey|hello|hi|yo|bonsoir|coucou|slt|bjr)[\s,!.]*/i, '');
    
    // Supprimer les mots de détection courants
    const detecs = [
        /télécharge?|downlo?ad|dl|va|sauvegarde?|enregistre?/gi,
        /cherch?e?|recherche?|google/gi,
        /converti?r?|transforme?|passe?/gi,
        /faire?|crée?|génère?|makes?/gi,
        /aide[- ]?moi|help|assist|assiste[- ]?moi/gi,
        /explique?|dis[- ]?moi|raconte?|comprends?/gi,
        /calcule?|compute|résout?|calcul/gi,
        /lis|read|ocr|texte/gi,
        /enregistre?|record/gi,
        /donne|give|montre|show/gi,
        /qui\s+(a|est)\s+(créé|fait|build|développé)/gi,
    ];
    
    for (const d of detecs) {
        arg = arg.replace(d, '');
    }
    
    // Supprimer les articles et prépositions en début
    arg = arg.replace(/^(le|la|les|l'|ce|cette|ces|un|une|des|du|de|d'|en|à|a|sur|pour|depuis)\s+/i, '');
    
    return arg.trim();
}

/* ═══════════════════════════════════════════════════════════════════
   MOTEUR DE ROUTAGE
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Analyse le texte et retourne l'intent détectée (ou null)
 */
function detecterIntent(texte) {
    if (!texte || texte.length < 3) return null;
    
    // Ignorer les messages très courts ou les commandes existantes
    if (texte.startsWith('.')) return null;
    
    const texteNormalise = texte.trim();
    
    // Trier par priorité (1 = fort d'abord)
    const sorted = [...INTENT_PATTERNS].sort((a, b) => a.priority - b.priority);
    
    for (const pattern of sorted) {
        for (const regex of pattern.patterns) {
            if (regex.test(texteNormalise)) {
                return {
                    intent: pattern.intent,
                    cmd: pattern.cmd,
                    priority: pattern.priority,
                    match: texteNormalise.match(regex),
                };
            }
        }
    }
    
    return null;
}

/**
 * Vérifie si la commande existe dans le registre
 */
function commandeExistante(cmdName) {
    try {
        const commands = COMMANDES?.commands || [];
        return commands.some(c => {
            if (!c.pattern) return false;
            const p = typeof c.pattern === 'string' ? c.pattern.toLowerCase() : '';
            const aliases = Array.isArray(c.alias) ? c.alias.map(a => String(a).toLowerCase()) : [];
            return p === cmdName.toLowerCase() || aliases.includes(cmdName.toLowerCase());
        });
    } catch {
        return false;
    }
}

/**
 * Smart Router principal — appelé dans messages.upsert
 * 
 * @param {object} sock - Socket Baileys
 * @param {object} msg - Message brut Baileys
 * @param {object} m - Message formaté (via sms())
 * @param {object} config - Configuration bot
 * @returns {boolean} true si une intention a été détectée et routée
 */
async function smartRouter(sock, msg, m, config) {
    // Ne router QUE les messages texte non-commande
    if (!m.body || m.body.startsWith('.')) return false;
    
    // Ne pas router les messages du bot
    if (msg.key?.fromMe) return false;
    
    // Détecter l'intention
    const detection = detecterIntent(m.body);
    if (!detection) return false;
    
    const { intent, cmd: cmdName, priority, match } = detection;
    
    // Vérifier que la commande existe
    if (!commandeExistante(cmdName)) {
        console.log(`[SMART-ROUTER] Intent "${intent}" → commande "${cmdName}" introuvable, ignoré`);
        return false;
    }
    
    // Extraire l'argument (URL ou texte après la commande)
    let arg = '';
    const url = extraireURL(m.body);
    if (url) {
        arg = url;
    } else if (match && match[0]) {
        arg = extraireArgument(m.body, intent);
    }
    
    // Construire la commande complète
    const prefix = getSettings()?.prefix || config?.prefix || '.';
    const fullCmd = arg ? `${prefix}${cmdName} ${arg}` : `${prefix}${cmdName}`;
    
    console.log(`[SMART-ROUTER] ✅ Intent "${intent}" (priorité ${priority}) → "${fullCmd}" (par ${m.sender})`);
    
    // Exécuter via le registre de commandes existant
    try {
        const allCmds = COMMANDES?.commands || [];
        const found = allCmds.find(c => {
            const p = String(c.pattern || '').toLowerCase();
            const aliases = Array.isArray(c.alias) ? c.alias.map(a => String(a).toLowerCase()) : [];
            return p === cmdName.toLowerCase() || aliases.includes(cmdName.toLowerCase());
        });
        
        if (found && typeof found.function === 'function') {
            /* IMPORTANT (règle #17 — ne pas perdre le contexte) :
               `m` a DÉJÀ traversé sms() → m.chat/m.sender sont résolus
               (LID inclus) et m.reply cible le bon chat. Reconstruire un
               objet à partir de `msg.key.remoteJid` comme avant revenait à
               jeter ce travail : pour un GROUPE, `sender` se retrouvait égal
               au JID du groupe au lieu du participant, et toute résolution
               LID déjà faite sur `m` était perdue. On clone `m` et on ne
               change QUE le texte de la commande. */
            const fakeMsg = { ...m, body: fullCmd };
            await found.function(sock, fakeMsg, allCmds, config);
            console.log(`[SMART-ROUTER] ✅ Commande exécutée: ${fullCmd}`);
            return true;
        }
        
        console.log(`[SMART-ROUTER] Commande "${cmdName}" non trouvée dans le registre`);
        return false;
        
    } catch (err) {
        console.error(`[SMART-ROUTER] Erreur exécution "${fullCmd}":`, err.message);
        return false;
    }
}

/**
 * Retourne la liste des intents disponibles (pour debug / help)
 */
function listerIntents() {
    return INTENT_PATTERNS.map(p => ({
        intent: p.intent,
        cmd: p.cmd,
        priority: p.priority,
        patterns: p.patterns.length,
    }));
}

module.exports = {
    smartRouter,
    detecterIntent,
    commandeExistante,
    listerIntents,
    INTENT_PATTERNS,
};
