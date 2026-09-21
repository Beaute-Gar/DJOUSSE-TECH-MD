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
        { id: 'cmd_menu', label: '📋 Menu', type: 'A' },
        { id: 'cmd_list', label: '📜 Liste', type: 'A' },
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
        { id: 'cmd_antibad', label: '🚫 Anti-Mot', type: 'A' },
        { id: 'cmd_antivv', label: '👁️ Anti-VV', type: 'A' },
        { id: 'cmd_antidelete', label: '🗑️ Anti-Delete', type: 'A' },
        { id: 'cmd_antiviewonce', label: '👁️‍🗨️ Auto-VV', type: 'A' },
        { id: 'cmd_goodbye', label: '👋 Au Revoir', type: 'A' },
        { id: 'cmd_welcome', label: '🎉 Bienvenue', type: 'A' },
        { id: 'cmd_hidetag', label: '🏷️ HideTag', type: 'B', prompt: '🏷️ Tapez le *message* à cacher dans le tag :' },
        { id: 'cmd_tagall', label: '📢 TagAll', type: 'B', prompt: '📢 Tapez le *message* pour taguer tout le monde :' },
        { id: 'cmd_pending', label: '⏳ Pending', type: 'A' },
        { id: 'cmd_grouplink', label: '🔗 Groupe Lien', type: 'A' },
        { id: 'cmd_join', label: '🚪 Join', type: 'B', prompt: '🚪 Envoyez le *lien du groupe* à rejoindre :' },
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
        { id: 'cmd_ai', label: '💬 ChatGPT', type: 'B', prompt: '💬 Posez votre *question* à ChatGPT.\n\n_Ex: Explique-moi la photosynthèse_' },
        { id: 'cmd_ainoria', label: '🧠 Ainoria', type: 'B', prompt: '🧠 Posez votre *question* à Ainoria :' },
        { id: 'cmd_aianalyze', label: '🔍 Analyser Image', type: 'C', prompt: '🖼️ Envoyez une *image* à analyser :' },
        { id: 'cmd_gptimage', label: '🎨 Image IA', type: 'B', prompt: '🎨 Décrivez l\'*image* à générer.\n\n_Ex: un lion dans la savane au coucher du soleil_' },
        { id: 'cmd_clonevoice', label: '🎤 Clone Voix', type: 'C', prompt: '🎤 Envoyez un *audio* pour cloner la voix :' },
        { id: 'cmd_tts', label: '🔊 Texte → Voix', type: 'B', prompt: '🔊 Tapez le *texte* à convertir en voix :' },
        { id: 'cmd_voicechanger', label: '🎵 Voice Changer', type: 'C', prompt: '🎵 Envoyez un *audio* à transformer :' },
        { id: 'cmd_personality', label: '🎭 Personnalité', type: 'A' },
        { id: 'cmd_autoreply', label: '🤖 Auto-Reply', type: 'A' },
        { id: 'cmd_mentionreply', label: '📣 Mention-Reply', type: 'A' },
        { id: 'cmd_memory', label: '💾 Mémoire', type: 'A' },
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
        { id: 'cmd_youtube', label: '🎵 YouTube', type: 'B', prompt: '🎵 Envoyez le *lien YouTube* ou un *mot-clé*.\n\n_Ex: https://youtu.be/xxx_\n_ou: musique lome_' },
        { id: 'cmd_tiktok', label: '📱 TikTok', type: 'B', prompt: '📱 Envoyez le *lien TikTok* :' },
        { id: 'cmd_instagram', label: '📸 Instagram', type: 'B', prompt: '📸 Envoyez le *lien Instagram* :' },
        { id: 'cmd_facebook', label: '📘 Facebook', type: 'B', prompt: '📘 Envoyez le *lien Facebook* :' },
        { id: 'cmd_twitter', label: '🐦 Twitter/X', type: 'B', prompt: '🐦 Envoyez le *lien Twitter/X* :' },
        { id: 'cmd_pinterest', label: '📌 Pinterest', type: 'B', prompt: '📌 Envoyez le *lien Pinterest* ou un *mot-clé* :' },
        { id: 'cmd_ringtone', label: '🔔 Ringtone', type: 'B', prompt: '🔔 Tapez le *nom du ringtone* à chercher :' },
        { id: 'cmd_lyrics', label: '📝 Paroles', type: 'B', prompt: '📝 Tapez le *titre de la chanson* :' },
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
        { id: 'cmd_8ball', label: '🎱 Boule Magique', type: 'B', prompt: '🎱 Posez votre *question* (oui/non) :' },
        { id: 'cmd_slots', label: '🎰 Slots', type: 'A' },
        { id: 'cmd_roulette', label: '🎡 Roulette', type: 'A' },
        { id: 'cmd_rps', label: '✊ Pierre/Feuille', type: 'B', prompt: '✊ Tapez *pierre*, *feuille* ou *ciseaux* :' },
        { id: 'cmd_coinflip', label: '🪙 Pile ou Face', type: 'A' },
        { id: 'cmd_guess', label: '🔢 Deviner', type: 'A' },
        { id: 'cmd_hangman', label: '🏗️ Pendu', type: 'A' },
        { id: 'cmd_waifu', label: '🎎 Waifu', type: 'A' },
        { id: 'cmd_soulmate', label: '💕 Soulmate', type: 'A' },
        { id: 'cmd_marry', label: '💒 Marier', type: 'B', prompt: '💒 Tapez le *nom* de la personne :' },
        { id: 'cmd_divorce', label: '💔 Divorcer', type: 'A' },
        { id: 'cmd_kiss', label: '💋 Baiser', type: 'B', prompt: '💋 Tapez le *nom* de la personne :' },
        { id: 'cmd_hug', label: '🤗 Câlin', type: 'B', prompt: '🤗 Tapez le *nom* de la personne :' },
        { id: 'cmd_slap', label: '👋 Gifle', type: 'B', prompt: '👋 Tapez le *nom* de la personne :' },
        { id: 'cmd_poke', label: '👉 Poké', type: 'B', prompt: '👉 Tapez le *nom* de la personne :' },
        { id: 'cmd_fortune', label: '🔮 Fortune', type: 'A' },
        { id: 'cmd_horoscope', label: '♈ Horoscope', type: 'B', prompt: '♈ Tapez votre *signe zodiacal* :' },
        { id: 'cmd_babyname', label: '👶 Prénom Bébé', type: 'A' },
        { id: 'cmd_bestie', label: '👯 Bestie', type: 'A' },
        { id: 'cmd_enemy', label: '😤 Ennemi', type: 'A' },
        { id: 'cmd_mood', label: '😊 Humeur', type: 'A' },
        { id: 'cmd_quotes', label: '💬 Citations', type: 'A' },
        { id: 'cmd_fact', label: '📚 Fait', type: 'A' },
        { id: 'cmd_story', label: '📖 Histoire', type: 'A' },
        { id: 'cmd_debate', label: '🗣️ Débat', type: 'B', prompt: '🗣️ Tapez le *sujet* du débat :' },
        { id: 'cmd_nhie', label: '🤐 Jamais', type: 'A' },
        { id: 'cmd_wyr', label: '🤔 Tu préfères', type: 'A' },
        { id: 'cmd_polls', label: '📊 Sondages', type: 'B', prompt: '📊 Tapez les *options* séparées par une virgule :' },
        { id: 'cmd_profession', label: '💼 Profession', type: 'A' },
        { id: 'cmd_character', label: '🎭 Personnage', type: 'A' },
        { id: 'cmd_couple', label: '💑 Couple', type: 'A' },
        { id: 'cmd_caption', label: '💬 Caption', type: 'B', prompt: '💬 Tapez votre *caption* :' },
        { id: 'cmd_meme', label: '😂 Meme', type: 'A' },
        { id: 'cmd_movie', label: '🎬 Film', type: 'B', prompt: '🎬 Tapez le *nom du film* :' },
        { id: 'cmd_vs', label: '⚔️ VS', type: 'A' },
        { id: 'cmd_wanted', label: '🚨 Wanted', type: 'A' },
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
        { id: 'cmd_sticker', label: '📸 Créer Sticker', type: 'C', prompt: '📸 Envoyez une *image* ou une *courte vidéo* pour créer un sticker.' },
        { id: 'cmd_sticker2img', label: '🖼️ Sticker → Image', type: 'C', prompt: '🖼️ Envoyez un *sticker* à convertir en image.' },
        { id: 'cmd_verify', label: '✅ Vérifier', type: 'A' },
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
        { id: 'cmd_convert', label: '🔄 Convertir', type: 'C', prompt: '🔄 Envoyez un *fichier* à convertir :' },
        { id: 'cmd_base64', label: '🔐 Base64', type: 'B', prompt: '🔐 Tapez le *texte* à encoder/décoder :' },
        { id: 'cmd_pdf', label: '📄 PDF', type: 'C', prompt: '📄 Envoyez une *image* à convertir en PDF :' },
        { id: 'cmd_imgedit', label: '🖼️ Éditer Image', type: 'C', prompt: '🖼️ Envoyez une *image* à éditer :' },
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
        { id: 'cmd_google', label: '🌐 Google Image', type: 'B', prompt: '🔍 Tapez votre *requête* Google Image :' },
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
        { id: 'cmd_ping', label: '📊 Ping', type: 'A' },
        { id: 'cmd_calc', label: '🧮 Calculatrice', type: 'B', prompt: '🧮 Tapez votre *expression* mathématique.\n\n_Ex: 2 + 2 * 3_' },
        { id: 'cmd_translate', label: '🌍 Traduire', type: 'B', prompt: '🌍 Tapez le *texte* à traduire.\n\n_Format: en bonjour_' },
        { id: 'cmd_weather', label: '🌤️ Météo', type: 'B', prompt: '🌤️ Tapez le *nom de la ville* :' },
        { id: 'cmd_fancytext', label: '✨ Texte Fancy', type: 'B', prompt: '✨ Tapez le *texte* à styliser :' },
        { id: 'cmd_toolsextras', label: '🔧 Extras', type: 'A' },
        { id: 'cmd_confirm', label: '✅ Confirmer', type: 'A' },
        { id: 'cmd_vv', label: '👁️ View Once', type: 'A' },
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
        { id: 'cmd_info', label: 'ℹ️ Infos Bot', type: 'A' },
        { id: 'cmd_stats', label: '📊 Statistiques', type: 'A' },
        { id: 'cmd_system', label: '💻 Système', type: 'A' },
        { id: 'cmd_uptime', label: '⏱️ Uptime', type: 'A' },
        { id: 'cmd_myaccount', label: '👤 Mon Compte', type: 'A' },
        { id: 'cmd_repo', label: '📦 Repo', type: 'A' },
        { id: 'cmd_religion', label: '🙏 Religion', type: 'A' },
        { id: 'cmd_basic', label: '📖 CMD Basiques', type: 'A' },
        { id: 'cmd_directory', label: '📂 Répertoire', type: 'A' },
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
        { id: 'cmd_balance', label: '💵 Solde', type: 'A' },
        { id: 'cmd_daily', label: '📅 Quotidien', type: 'A' },
        { id: 'cmd_weekly', label: '📆 Hebdomadaire', type: 'A' },
        { id: 'cmd_work', label: '💼 Travailler', type: 'A' },
        { id: 'cmd_mine', label: '⛏️ Miner', type: 'A' },
        { id: 'cmd_crime', label: '🔫 Crime', type: 'A' },
        { id: 'cmd_buy', label: '🛒 Acheter', type: 'A' },
        { id: 'cmd_shop', label: '🏪 Boutique', type: 'A' },
        { id: 'cmd_deposit', label: '🏦 Déposer', type: 'B', prompt: '🏦 Tapez le *montant* à déposer :' },
        { id: 'cmd_withdraw', label: '💸 Retirer', type: 'B', prompt: '💸 Tapez le *montant* à retirer :' },
        { id: 'cmd_transfer', label: '💸 Transférer', type: 'B', prompt: '💸 Tapez le *montant* puis le *nom*.\n\n_Format: 500 nom_' },
        { id: 'cmd_topcoins', label: '🏆 Classement', type: 'A' },
        { id: 'cmd_role', label: '🎭 Rôle', type: 'A' },
        { id: 'cmd_levelup', label: '⬆️ Level Up', type: 'A' },
        { id: 'cmd_reset', label: '🔄 Reset', type: 'A' },
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
        { id: 'cmd_create', label: '➕ Créer Groupe', type: 'B', prompt: '➕ Tapez le *nom* du groupe à créer :' },
        { id: 'cmd_delete', label: '🗑️ Supprimer', type: 'A' },
        { id: 'cmd_invite', label: '📩 Inviter', type: 'B', prompt: '📩 Envoyez le *numéro* à inviter :' },
        { id: 'cmd_label', label: '🏷️ Label', type: 'A' },
        { id: 'cmd_analytics', label: '📊 Analytics', type: 'A' },
        { id: 'cmd_groupguard', label: '🛡️ Guard', type: 'A' },
        { id: 'cmd_antiflood', label: '🌊 Anti-Flood', type: 'A' },
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
        { id: 'cmd_broadcast', label: '📢 Broadcast', type: 'B', prompt: '📢 Tapez le *message* à broadcaster :' },
        { id: 'cmd_block', label: '🚫 Bloquer', type: 'B', prompt: '🚫 Envoyez le *numéro* à bloquer :' },
        { id: 'cmd_unblock', label: '✅ Débloquer', type: 'B', prompt: '✅ Envoyez le *numéro* à débloquer :' },
        { id: 'cmd_restart', label: '🔄 Restart', type: 'A' },
        { id: 'cmd_prefix', label: '🔤 Prefix', type: 'B', prompt: '🔤 Tapez le nouveau *prefix* :' },
        { id: 'cmd_setname', label: '📝 Nom', type: 'B', prompt: '📝 Tapez le nouveau *nom* du bot :' },
        { id: 'cmd_setpp', label: '🖼️ Photo', type: 'C', prompt: '🖼️ Envoyez la *photo* de profil :' },
        { id: 'cmd_host', label: '🖥️ Host', type: 'A' },
        { id: 'cmd_pair', label: '🔗 Pair', type: 'B', prompt: '🔗 Tapez le *numéro* pour le pairing :' },
        { id: 'cmd_settings', label: '⚙️ Settings', type: 'A' },
        { id: 'cmd_afk', label: '💤 AFK', type: 'B', prompt: '💤 Tapez la *raison* de votre AFK (ou laissez vide) :' },
        { id: 'cmd_statusquote', label: '📢 Status Quote', type: 'B', prompt: '📢 Tapez le *texte* du status à publier :' },
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
        { id: 'cmd_security', label: '🔒 Sécurité', type: 'A' },
        { id: 'cmd_securitystats', label: '📊 Stats Sécurité', type: 'A' },
        { id: 'cmd_linkintel', label: '🔗 Link Intel', type: 'A' },
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
        { id: 'cmd_logomaker', label: '🎨 Créer Logo', type: 'B', prompt: '🎨 Décrivez le *logo* à créer.\n\n_Ex: logo gaming neon bleu_' },
      ]
    },
  ]
};
