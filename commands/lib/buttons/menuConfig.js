/**
 * Configuration du menu interactif HYBRIDE
 * Types : A = direct, B = saisie texte, C = envoi fichier
 * DJOUSSE-TECH-MD
 */

module.exports = {
  categories: [
    // ══════════════════════════════════════
    // GÉNÉRAL
    // ══════════════════════════════════════
    {
      id: 'cat_general',
      label: '🌐 Général',
      emoji: '🌐',
      commands: [
        { id: 'cmd_menu', label: '📋 Menu', type: 'A', alias: ['menu', 'start', 'aide', 'm', 'h', 'help', 'cmd', 'commands', 'menuhacker', 'hackermenu'] },
        { id: 'cmd_list', label: '📜 Liste', type: 'A', alias: ['list'] },
      ]
    },
    // ══════════════════════════════════════
    // ADMIN
    // ══════════════════════════════════════
    {
      id: 'cat_admin',
      label: '⚡ Admin',
      emoji: '⚡',
      commands: [
        { id: 'cmd_antibad', label: '🚫 Anti-Mot', type: 'A', alias: ['antibad', 'badwords', 'addbad', 'addbadword', 'delbad', 'delbadword'] },
        { id: 'cmd_antivv', label: '👁️ Anti-VV', type: 'A', alias: ['anticiponce', 'antiVV'] },
        { id: 'cmd_antidelete', label: '🗑️ Anti-Delete', type: 'A', alias: ['antidelete', 'adel'] },
        { id: 'cmd_antiviewonce', label: '👁️‍🗨️ Auto-VV', type: 'A', alias: ['antiviewonce', 'avv', 'autoviewonce'] },
        { id: 'cmd_goodbye', label: '👋 Au Revoir', type: 'A', alias: ['goodbye', 'bye'] },
        { id: 'cmd_welcome', label: '🎉 Bienvenue', type: 'A', alias: ['welcome'] },
        { id: 'cmd_hidetag', label: '🏷️ HideTag', type: 'B', prompt: '🏷️ Tapez le *message* à cacher dans le tag :', alias: ['hidetag'] },
        { id: 'cmd_tagall', label: '📢 TagAll', type: 'B', prompt: '📢 Tapez le *message* pour taguer tout le monde :', alias: ['tagall'] },
        { id: 'cmd_pending', label: '⏳ Pending', type: 'A', alias: ['pending'] },
        { id: 'cmd_grouplink', label: '🔗 Groupe Lien', type: 'A', alias: ['grouplink'] },
        { id: 'cmd_join', label: '🚪 Join', type: 'B', prompt: '🚪 Envoyez le *lien du groupe* à rejoindre :', alias: ['join'] },
      ]
    },
    // ══════════════════════════════════════
    // IA
    // ══════════════════════════════════════
    {
      id: 'cat_ai',
      label: '🤖 IA',
      emoji: '🤖',
      commands: [
        { id: 'cmd_ai', label: '💬 ChatGPT', type: 'B', prompt: '💬 Posez votre *question* à ChatGPT.\n\n_Ex: Explique-moi la photosynthèse_', alias: ['ai'] },
        { id: 'cmd_ainoria', label: '🧠 Ainoria', type: 'B', prompt: '🧠 Posez votre *question* à Ainoria :', alias: ['ainoria'] },
        { id: 'cmd_aianalyze', label: '🔍 Analyser Image', type: 'C', prompt: '🖼️ Envoyez une *image* à analyser :', alias: ['aianalyze', 'analyze', 'aiimg', 'aiimage'] },
        { id: 'cmd_gptimage', label: '🎨 Image IA', type: 'B', prompt: '🎨 Décrivez l\'*image* à générer.\n\n_Ex: un lion dans la savane au coucher du soleil_', alias: ['gptimage', 'magic', 'magicstudio'] },
        { id: 'cmd_clonevoice', label: '🎤 Clone Voix', type: 'C', prompt: '🎤 Envoyez un *audio* pour cloner la voix :', alias: ['clonevoice'] },
        { id: 'cmd_tts', label: '🔊 Texte → Voix', type: 'B', prompt: '🔊 Tapez le *texte* à convertir en voix :', alias: ['text_to_speech_', 'tts'] },
        { id: 'cmd_voicechanger', label: '🎵 Voice Changer', type: 'C', prompt: '🎵 Envoyez un *audio* à transformer :', alias: ['voicechanger-extra'] },
        { id: 'cmd_personality', label: '🎭 Personnalité', type: 'A', alias: ['personality'] },
        { id: 'cmd_autoreply', label: '🤖 Auto-Reply', type: 'A', alias: ['autoreply', 'auto-reply'] },
        { id: 'cmd_mentionreply', label: '📣 Mention-Reply', type: 'A', alias: ['mention-reply', 'statusreply'] },
        { id: 'cmd_memory', label: '💾 Mémoire', type: 'A', alias: ['ainoria-memory'] },
      ]
    },
    // ══════════════════════════════════════
    // TÉLÉCHARGEMENT
    // ══════════════════════════════════════
    {
      id: 'cat_download',
      label: '⬇️ Téléchargement',
      emoji: '⬇️',
      commands: [
        { id: 'cmd_youtube', label: '🎵 YouTube', type: 'B', prompt: '🎵 Envoyez le *lien YouTube* ou un *mot-clé*.\n\n_Ex: https://youtu.be/xxx_\n_ou: musique lome_', alias: ['song', 'video'] },
        { id: 'cmd_tiktok', label: '📱 TikTok', type: 'B', prompt: '📱 Envoyez le *lien TikTok* :', alias: ['tiktok'] },
        { id: 'cmd_instagram', label: '📸 Instagram', type: 'B', prompt: '📸 Envoyez le *lien Instagram* :', alias: ['instagram'] },
        { id: 'cmd_facebook', label: '📘 Facebook', type: 'B', prompt: '📘 Envoyez le *lien Facebook* :', alias: ['facebook'] },
        { id: 'cmd_twitter', label: '🐦 Twitter/X', type: 'B', prompt: '🐦 Envoyez le *lien Twitter/X* :', alias: ['twitter'] },
        { id: 'cmd_pinterest', label: '📌 Pinterest', type: 'B', prompt: '📌 Envoyez le *lien Pinterest* ou un *mot-clé* :', alias: ['pinterest'] },
        { id: 'cmd_ringtone', label: '🔔 Ringtone', type: 'B', prompt: '🔔 Tapez le *nom du ringtone* à chercher :', alias: ['ringtone'] },
        { id: 'cmd_lyrics', label: '📝 Paroles', type: 'B', prompt: '📝 Tapez le *titre de la chanson* :', alias: ['lyrics'] },
      ]
    },
    // ══════════════════════════════════════
    // FUN
    // ══════════════════════════════════════
    {
      id: 'cat_fun',
      label: '🎮 Fun',
      emoji: '🎮',
      commands: [
        { id: 'cmd_8ball', label: '🎱 Boule Magique', type: 'B', prompt: '🎱 Posez votre *question* (oui/non) :', alias: ['8ball'] },
        { id: 'cmd_slots', label: '🎰 Slots', type: 'A', alias: ['slots'] },
        { id: 'cmd_roulette', label: '🎡 Roulette', type: 'A', alias: ['roulette'] },
        { id: 'cmd_rps', label: '✊ Pierre/Feuille', type: 'B', prompt: '✊ Tapez *pierre*, *feuille* ou *ciseaux* :', alias: ['rps'] },
        { id: 'cmd_coinflip', label: '🪙 Pile ou Face', type: 'A', alias: ['coinflip'] },
        { id: 'cmd_guess', label: '🔢 Deviner', type: 'A', alias: ['guessnumber'] },
        { id: 'cmd_hangman', label: '🏗️ Pendu', type: 'A', alias: ['hangman'] },
        { id: 'cmd_waifu', label: '🎎 Waifu', type: 'A', alias: ['waifu_'] },
        { id: 'cmd_soulmate', label: '💕 Soulmate', type: 'A', alias: ['soulmate'] },
        { id: 'cmd_marry', label: '💒 Marier', type: 'B', prompt: '💒 Tapez le *nom* de la personne :', alias: ['marry'] },
        { id: 'cmd_divorce', label: '💔 Divorcer', type: 'A', alias: ['divorce'] },
        { id: 'cmd_kiss', label: '💋 Baiser', type: 'B', prompt: '💋 Tapez le *nom* de la personne :', alias: ['kiss'] },
        { id: 'cmd_hug', label: '🤗 Câlin', type: 'B', prompt: '🤗 Tapez le *nom* de la personne :', alias: ['hug'] },
        { id: 'cmd_slap', label: '👋 Gifle', type: 'B', prompt: '👋 Tapez le *nom* de la personne :', alias: ['slap'] },
        { id: 'cmd_poke', label: '👉 Poké', type: 'B', prompt: '👉 Tapez le *nom* de la personne :', alias: ['poke'] },
        { id: 'cmd_fortune', label: '🔮 Fortune', type: 'A', alias: ['fortune'] },
        { id: 'cmd_horoscope', label: '♈ Horoscope', type: 'B', prompt: '♈ Tapez votre *signe zodiacal* :', alias: ['horoscope'] },
        { id: 'cmd_babyname', label: '👶 Prénom Bébé', type: 'A', alias: ['babyname'] },
        { id: 'cmd_bestie', label: '👯 Bestie', type: 'A', alias: ['bestie'] },
        { id: 'cmd_enemy', label: '😤 Ennemi', type: 'A', alias: ['enemy'] },
        { id: 'cmd_mood', label: '😊 Humeur', type: 'A', alias: ['mood'] },
        { id: 'cmd_quotes', label: '💬 Citations', type: 'A', alias: ['quotes'] },
        { id: 'cmd_fact', label: '📚 Fait', type: 'A', alias: ['fact'] },
        { id: 'cmd_story', label: '📖 Histoire', type: 'A', alias: ['story'] },
        { id: 'cmd_debate', label: '🗣️ Débat', type: 'B', prompt: '🗣️ Tapez le *sujet* du débat :', alias: ['debate'] },
        { id: 'cmd_nhie', label: '🤐 Jamais', type: 'A', alias: ['nhie'] },
        { id: 'cmd_wyr', label: '🤔 Tu préfères', type: 'A', alias: ['wyr'] },
        { id: 'cmd_polls', label: '📊 Sondages', type: 'B', prompt: '📊 Tapez les *options* séparées par une virgule :', alias: ['polls'] },
        { id: 'cmd_profession', label: '💼 Profession', type: 'A', alias: ['profession'] },
        { id: 'cmd_character', label: '🎭 Personnage', type: 'A', alias: ['character'] },
        { id: 'cmd_couple', label: '💑 Couple', type: 'A', alias: ['couple'] },
        { id: 'cmd_caption', label: '💬 Caption', type: 'B', prompt: '💬 Tapez votre *caption* :', alias: ['caption'] },
        { id: 'cmd_meme', label: '😂 Meme', type: 'A', alias: ['memes'] },
        { id: 'cmd_movie', label: '🎬 Film', type: 'B', prompt: '🎬 Tapez le *nom du film* :', alias: ['movie'] },
        { id: 'cmd_vs', label: '⚔️ VS', type: 'A', alias: ['vs'] },
        { id: 'cmd_wanted', label: '🚨 Wanted', type: 'A', alias: ['wanted'] },
      ]
    },
    // ══════════════════════════════════════
    // MÉDIA / STICKERS
    // ══════════════════════════════════════
    {
      id: 'cat_media',
      label: '🎨 Stickers',
      emoji: '🎨',
      commands: [
        { id: 'cmd_sticker', label: '📸 Créer Sticker', type: 'C', prompt: '📸 Envoyez une *image* ou une *courte vidéo* pour créer un sticker.', alias: ['sticker'] },
        { id: 'cmd_sticker2img', label: '🖼️ Sticker → Image', type: 'C', prompt: '🖼️ Envoyez un *sticker* à convertir en image.', alias: ['sticker-to-image'] },
        { id: 'cmd_verify', label: '✅ Vérifier', type: 'A', alias: ['verify'] },
      ]
    },
    // ══════════════════════════════════════
    // CONVERSION
    // ══════════════════════════════════════
    {
      id: 'cat_convert',
      label: '🔄 Conversion',
      emoji: '🔄',
      commands: [
        { id: 'cmd_convert', label: '🔄 Convertir', type: 'C', prompt: '🔄 Envoyez un *fichier* à convertir :', alias: ['convert'] },
        { id: 'cmd_base64', label: '🔐 Base64', type: 'B', prompt: '🔐 Tapez le *texte* à encoder/décoder :', alias: ['base64'] },
        { id: 'cmd_pdf', label: '📄 PDF', type: 'C', prompt: '📄 Envoyez une *image* à convertir en PDF :', alias: ['pdf'] },
        { id: 'cmd_imgedit', label: '🖼️ Éditer Image', type: 'C', prompt: '🖼️ Envoyez une *image* à éditer :', alias: ['img-edit'] },
      ]
    },
    // ══════════════════════════════════════
    // RECHERCHE
    // ══════════════════════════════════════
    {
      id: 'cat_search',
      label: '🔍 Recherche',
      emoji: '🔍',
      commands: [
        { id: 'cmd_google', label: '🌐 Google Image', type: 'B', prompt: '🔍 Tapez votre *requête* Google Image :', alias: ['google-img'] },
      ]
    },
    // ══════════════════════════════════════
    // OUTILS
    // ══════════════════════════════════════
    {
      id: 'cat_tools',
      label: '🛠️ Outils',
      emoji: '🛠️',
      commands: [
        { id: 'cmd_ping', label: '📊 Ping', type: 'A', alias: ['ping-btn', 'pingbtn', 'pb'] },
        { id: 'cmd_calc', label: '🧮 Calculatrice', type: 'B', prompt: '🧮 Tapez votre *expression* mathématique.\n\n_Ex: 2 + 2 * 3_', alias: ['calc'] },
        { id: 'cmd_translate', label: '🌍 Traduire', type: 'B', prompt: '🌍 Tapez le *texte* à traduire.\n\n_Format: en bonjour_', alias: ['translate'] },
        { id: 'cmd_weather', label: '🌤️ Météo', type: 'B', prompt: '🌤️ Tapez le *nom de la ville* :', alias: ['weather'] },
        { id: 'cmd_fancytext', label: '✨ Texte Fancy', type: 'B', prompt: '✨ Tapez le *texte* à styliser :', alias: ['fancy-text'] },
        { id: 'cmd_toolsextras', label: '🔧 Extras', type: 'A', alias: ['tools-extras'] },
        { id: 'cmd_confirm', label: '✅ Confirmer', type: 'A', alias: ['confirm'] },
        { id: 'cmd_vv', label: '👁️ View Once', type: 'A', alias: ['vv'] },
      ]
    },
    // ══════════════════════════════════════
    // INFO
    // ══════════════════════════════════════
    {
      id: 'cat_info',
      label: 'ℹ️ Info',
      emoji: 'ℹ️',
      commands: [
        { id: 'cmd_info', label: 'ℹ️ Infos Bot', type: 'A', alias: ['info-btn', 'infobtn', 'ib'] },
        { id: 'cmd_stats', label: '📊 Statistiques', type: 'A', alias: ['stats'] },
        { id: 'cmd_system', label: '💻 Système', type: 'A', alias: ['system'] },
        { id: 'cmd_uptime', label: '⏱️ Uptime', type: 'A', alias: ['uptime-extra'] },
        { id: 'cmd_myaccount', label: '👤 Mon Compte', type: 'A', alias: ['myaccount'] },
        { id: 'cmd_repo', label: '📦 Repo', type: 'A', alias: ['repo-v2'] },
        { id: 'cmd_religion', label: '🙏 Religion', type: 'A', alias: ['religion'] },
        { id: 'cmd_basic', label: '📖 CMD Basiques', type: 'A', alias: ['basic-commands'] },
        { id: 'cmd_directory', label: '📂 Répertoire', type: 'A', alias: ['directory'] },
      ]
    },
    // ══════════════════════════════════════
    // ÉCONOMIE
    // ══════════════════════════════════════
    {
      id: 'cat_economy',
      label: '💰 Économie',
      emoji: '💰',
      commands: [
        { id: 'cmd_balance', label: '💵 Solde', type: 'A', alias: ['balance'] },
        { id: 'cmd_daily', label: '📅 Quotidien', type: 'A', alias: ['daily'] },
        { id: 'cmd_weekly', label: '📆 Hebdomadaire', type: 'A', alias: ['weekly'] },
        { id: 'cmd_work', label: '💼 Travailler', type: 'A', alias: ['work'] },
        { id: 'cmd_mine', label: '⛏️ Miner', type: 'A', alias: ['mine'] },
        { id: 'cmd_crime', label: '🔫 Crime', type: 'A', alias: ['crime'] },
        { id: 'cmd_buy', label: '🛒 Acheter', type: 'A', alias: ['buy'] },
        { id: 'cmd_shop', label: '🏪 Boutique', type: 'A', alias: ['shop'] },
        { id: 'cmd_deposit', label: '🏦 Déposer', type: 'B', prompt: '🏦 Tapez le *montant* à déposer :', alias: ['dep'] },
        { id: 'cmd_withdraw', label: '💸 Retirer', type: 'B', prompt: '💸 Tapez le *montant* à retirer :', alias: ['wd'] },
        { id: 'cmd_transfer', label: '💸 Transférer', type: 'B', prompt: '💸 Tapez le *montant* puis le *nom*.\n\n_Format: 500 nom_', alias: ['pay', 'send'] },
        { id: 'cmd_topcoins', label: '🏆 Classement', type: 'A', alias: ['topcoins'] },
        { id: 'cmd_role', label: '🎭 Rôle', type: 'A', alias: ['role'] },
        { id: 'cmd_levelup', label: '⬆️ Level Up', type: 'A', alias: ['levelup'] },
        { id: 'cmd_reset', label: '🔄 Reset', type: 'A', alias: ['resetbalance', 'resetcoin'] },
      ]
    },
    // ══════════════════════════════════════
    // GROUPE
    // ══════════════════════════════════════
    {
      id: 'cat_group',
      label: '👥 Groupe',
      emoji: '👥',
      commands: [
        { id: 'cmd_create', label: '➕ Créer Groupe', type: 'B', prompt: '➕ Tapez le *nom* du groupe à créer :', alias: ['create', 'creategroup'] },
        { id: 'cmd_delete', label: '🗑️ Supprimer', type: 'A', alias: ['del', 'delete', 'deldup'] },
        { id: 'cmd_invite', label: '📩 Inviter', type: 'B', prompt: '📩 Envoyez le *numéro* à inviter :', alias: ['invite'] },
        { id: 'cmd_label', label: '🏷️ Label', type: 'A', alias: ['label'] },
        { id: 'cmd_analytics', label: '📊 Analytics', type: 'A', alias: ['group-analytics'] },
        { id: 'cmd_groupguard', label: '🛡️ Guard', type: 'A', alias: ['groupguard'] },
        { id: 'cmd_antiflood', label: '🌊 Anti-Flood', type: 'A', alias: ['antiflood'] },
      ]
    },
    // ══════════════════════════════════════
    // OWNER
    // ══════════════════════════════════════
    {
      id: 'cat_owner',
      label: '👑 Owner',
      emoji: '👑',
      commands: [
        { id: 'cmd_broadcast', label: '📢 Broadcast', type: 'B', prompt: '📢 Tapez le *message* à broadcaster :', alias: ['broadcast'] },
        { id: 'cmd_block', label: '🚫 Bloquer', type: 'B', prompt: '🚫 Envoyez le *numéro* à bloquer :', alias: ['block'] },
        { id: 'cmd_unblock', label: '✅ Débloquer', type: 'B', prompt: '✅ Envoyez le *numéro* à débloquer :', alias: ['unblock'] },
        { id: 'cmd_restart', label: '🔄 Restart', type: 'A', alias: ['restart_bot'] },
        { id: 'cmd_prefix', label: '🔤 Prefix', type: 'B', prompt: '🔤 Tapez le nouveau *prefix* :', alias: ['prefix'] },
        { id: 'cmd_setname', label: '📝 Nom', type: 'B', prompt: '📝 Tapez le nouveau *nom* du bot :', alias: ['setname'] },
        { id: 'cmd_setpp', label: '🖼️ Photo', type: 'C', prompt: '🖼️ Envoyez la *photo* de profil :', alias: ['setpp'] },
        { id: 'cmd_host', label: '🖥️ Host', type: 'A', alias: ['host'] },
        { id: 'cmd_pair', label: '🔗 Pair', type: 'B', prompt: '🔗 Tapez le *numéro* pour le pairing :', alias: ['pair-owner'] },
        { id: 'cmd_settings', label: '⚙️ Settings', type: 'A', alias: ['settings-extra'] },
        { id: 'cmd_afk', label: '💤 AFK', type: 'B', prompt: '💤 Tapez la *raison* de votre AFK (ou laissez vide) :', alias: ['afk'] },
        { id: 'cmd_statusquote', label: '📢 Status Quote', type: 'B', prompt: '📢 Tapez le *texte* du status à publier :', alias: ['statusquote', 'sq', 'pubstatus'] },
      ]
    },
    // ══════════════════════════════════════
    // SÉCURITÉ
    // ══════════════════════════════════════
    {
      id: 'cat_security',
      label: '🔒 Sécurité',
      emoji: '🔒',
      commands: [
        { id: 'cmd_security', label: '🔒 Sécurité', type: 'A', alias: ['security'] },
        { id: 'cmd_securitystats', label: '📊 Stats Sécurité', type: 'A', alias: ['security-stats'] },
        { id: 'cmd_linkintel', label: '🔗 Link Intel', type: 'A', alias: ['link-intelligence'] },
      ]
    },
    // ══════════════════════════════════════
    // LOGO
    // ══════════════════════════════════════
    {
      id: 'cat_logo',
      label: '🎨 Logo',
      emoji: '🎨',
      commands: [
        { id: 'cmd_logomaker', label: '🎨 Créer Logo', type: 'B', prompt: '🎨 Décrivez le *logo* à créer.\n\n_Ex: logo gaming neon bleu_', alias: ['logo-maker'] },
      ]
    },
  ]
};
