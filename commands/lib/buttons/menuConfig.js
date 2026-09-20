/**
 * Configuration du menu interactif
 * Carte complète des catégories et commandes
 * DJOUSSE-TECH-MD
 */

module.exports = {
  categories: [
    {
      id: 'cat_general',
      label: '🌐 Général',
      emoji: '🌐',
      commands: [
        { id: 'cmd_menu', label: '📋 Menu', alias: ['menu', 'start', 'aide', 'm', 'h', 'help', 'cmd', 'commands', 'menuhacker', 'hackermenu'] },
        { id: 'cmd_list', label: '📜 Liste', alias: ['list'] },
      ]
    },
    {
      id: 'cat_admin',
      label: '⚡ Admin',
      emoji: '⚡',
      commands: [
        { id: 'cmd_antibad', label: '🚫 Anti-Mot', alias: ['antibad', 'badwords', 'addbad', 'addbadword', 'delbad', 'delbadword'] },
        { id: 'cmd_antivv', label: '👁️ Anti-VV', alias: ['anticiponce', 'antiVV'] },
        { id: 'cmd_antidelete', label: '🗑️ Anti-Delete', alias: ['antidelete', 'adel'] },
        { id: 'cmd_antiviewonce', label: '👁️‍🗨️ Auto-VV', alias: ['antiviewonce', 'avv', 'autoviewonce'] },
        { id: 'cmd_goodbye', label: '👋 Au Revoir', alias: ['goodbye', 'bye'] },
        { id: 'cmd_welcome', label: '🎉 Bienvenue', alias: ['welcome'] },
        { id: 'cmd_hidetag', label: '🏷️ HideTag', alias: ['hidetag'] },
        { id: 'cmd_tagall', label: '📢 TagAll', alias: ['tagall'] },
        { id: 'cmd_pending', label: '⏳ Pending', alias: ['pending'] },
        { id: 'cmd_grouplink', label: '🔗 Groupe Lien', alias: ['grouplink'] },
        { id: 'cmd_join', label: '🚪 Join', alias: ['join'] },
      ]
    },
    {
      id: 'cat_ai',
      label: '🤖 IA',
      emoji: '🤖',
      commands: [
        { id: 'cmd_ai', label: '💬 ChatGPT', alias: ['ai'] },
        { id: 'cmd_ainoria', label: '🧠 Ainoria', alias: ['ainoria'] },
        { id: 'cmd_aianalyze', label: '🔍 Analyser', alias: ['aianalyze', 'analyze', 'aiimg', 'aiimage'] },
        { id: 'cmd_gptimage', label: '🎨 Image IA', alias: ['gptimage', 'magic', 'magicstudio'] },
        { id: 'cmd_clonevoice', label: '🎤 Clone Voix', alias: ['clonevoice'] },
        { id: 'cmd_tts', label: '🔊 Texte → Voix', alias: ['text_to_speech_', 'tts'] },
        { id: 'cmd_voicechanger', label: '🎵 Voice Changer', alias: ['voicechanger-extra'] },
        { id: 'cmd_personality', label: '🎭 Personnalité', alias: ['personality'] },
        { id: 'cmd_autoreply', label: '🤖 Auto-Reply', alias: ['autoreply', 'auto-reply'] },
        { id: 'cmd_mentionreply', label: '📣 Mention-Reply', alias: ['mention-reply', 'statusreply'] },
        { id: 'cmd_memory', label: '💾 Mémoire', alias: ['ainoria-memory'] },
      ]
    },
    {
      id: 'cat_download',
      label: '⬇️ Téléchargement',
      emoji: '⬇️',
      commands: [
        { id: 'cmd_youtube', label: '🎵 YouTube', alias: ['song', 'video'] },
        { id: 'cmd_tiktok', label: '📱 TikTok', alias: ['tiktok'] },
        { id: 'cmd_instagram', label: '📸 Instagram', alias: ['instagram'] },
        { id: 'cmd_facebook', label: '📘 Facebook', alias: ['facebook'] },
        { id: 'cmd_twitter', label: '🐦 Twitter/X', alias: ['twitter'] },
        { id: 'cmd_pinterest', label: '📌 Pinterest', alias: ['pinterest'] },
        { id: 'cmd_ringtone', label: '🔔 Ringtone', alias: ['ringtone'] },
        { id: 'cmd_lyrics', label: '📝 Paroles', alias: ['lyrics'] },
      ]
    },
    {
      id: 'cat_fun',
      label: '🎮 Fun',
      emoji: '🎮',
      commands: [
        { id: 'cmd_8ball', label: '🎱 Boule Magique', alias: ['8ball'] },
        { id: 'cmd_slots', label: '🎰 Slots', alias: ['slots'] },
        { id: 'cmd_roulette', label: '🎡 Roulette', alias: ['roulette'] },
        { id: 'cmd_rps', label: '✊ Pierre/Feuille', alias: ['rps'] },
        { id: 'cmd_coinflip', label: '🪙 Pile ou Face', alias: ['coinflip'] },
        { id: 'cmd_guess', label: '🔢 Deviner', alias: ['guessnumber'] },
        { id: 'cmd_hangman', label: '🏗️ Pendu', alias: ['hangman'] },
        { id: 'cmd_waifu', label: '🎎 Waifu', alias: ['waifu_'] },
        { id: 'cmd_soulmate', label: '💕 Soulmate', alias: ['soulmate'] },
        { id: 'cmd_marry', label: '💒 Marier', alias: ['marry'] },
        { id: 'cmd_divorce', label: '💔 Divorcer', alias: ['divorce'] },
        { id: 'cmd_kiss', label: '💋 Baiser', alias: ['kiss'] },
        { id: 'cmd_hug', label: '🤗 Câlin', alias: ['hug'] },
        { id: 'cmd_slap', label: '👋 Gifle', alias: ['slap'] },
        { id: 'cmd_poke', label: '👉 Poké', alias: ['poke'] },
        { id: 'cmd_fortune', label: '🔮 Fortune', alias: ['fortune'] },
        { id: 'cmd_horoscope', label: '♈ Horoscope', alias: ['horoscope'] },
        { id: 'cmd_babyname', label: '👶 Prénom Bébé', alias: ['babyname'] },
        { id: 'cmd_bestie', label: '👯 Bestie', alias: ['bestie'] },
        { id: 'cmd_enemy', label: '😤 Ennemi', alias: ['enemy'] },
        { id: 'cmd_mood', label: '😊 Humeur', alias: ['mood'] },
        { id: 'cmd_quotes', label: '💬 Citations', alias: ['quotes'] },
        { id: 'cmd_fact', label: '📚 Fait', alias: ['fact'] },
        { id: 'cmd_story', label: '📖 Histoire', alias: ['story'] },
        { id: 'cmd_debate', label: '🗣️ Débat', alias: ['debate'] },
        { id: 'cmd_nhie', label: '🤐 Jamais', alias: ['nhie'] },
        { id: 'cmd_wyr', label: '🤔 Tu préfères', alias: ['wyr'] },
        { id: 'cmd_polls', label: '📊 Sondages', alias: ['polls'] },
        { id: 'cmd_profession', label: '💼 Profession', alias: ['profession'] },
        { id: 'cmd_character', label: '🎭 Personnage', alias: ['character'] },
        { id: 'cmd_couple', label: '💑 Couple', alias: ['couple'] },
        { id: 'cmd_caption', label: '💬 Caption', alias: ['caption'] },
        { id: 'cmd_meme', label: '😂 Meme', alias: ['memes'] },
        { id: 'cmd_movie', label: '🎬 Film', alias: ['movie'] },
        { id: 'cmd_vs', label: '⚔️ VS', alias: ['vs'] },
        { id: 'cmd_wanted', label: '🚨 Wanted', alias: ['wanted'] },
      ]
    },
    {
      id: 'cat_media',
      label: '📸 Média',
      emoji: '📸',
      commands: [
        { id: 'cmd_sticker', label: '🏷️ Sticker', alias: ['sticker'] },
        { id: 'cmd_sticker2img', label: '🖼️ Sticker → Image', alias: ['sticker-to-image'] },
        { id: 'cmd_verify', label: '✅ Vérifier', alias: ['verify'] },
      ]
    },
    {
      id: 'cat_convert',
      label: '🔄 Conversion',
      emoji: '🔄',
      commands: [
        { id: 'cmd_convert', label: '🔄 Convertir', alias: ['convert'] },
        { id: 'cmd_base64', label: '🔐 Base64', alias: ['base64'] },
        { id: 'cmd_pdf', label: '📄 PDF', alias: ['pdf'] },
        { id: 'cmd_imgedit', label: '🖼️ Éditer Image', alias: ['img-edit'] },
      ]
    },
    {
      id: 'cat_search',
      label: '🔍 Recherche',
      emoji: '🔍',
      commands: [
        { id: 'cmd_google', label: '🌐 Google Image', alias: ['google-img'] },
      ]
    },
    {
      id: 'cat_tools',
      label: '🛠️ Outils',
      emoji: '🛠️',
      commands: [
        { id: 'cmd_ping', label: '📊 Ping', alias: ['ping-btn', 'pingbtn', 'pb'] },
        { id: 'cmd_calc', label: '🧮 Calculatrice', alias: ['calc'] },
        { id: 'cmd_translate', label: '🌍 Traduire', alias: ['translate'] },
        { id: 'cmd_weather', label: '🌤️ Météo', alias: ['weather'] },
        { id: 'cmd_fancytext', label: '✨ Texte Fancy', alias: ['fancy-text'] },
        { id: 'cmd_toolsextras', label: '🔧 Extras', alias: ['tools-extras'] },
        { id: 'cmd_confirm', label: '✅ Confirmer', alias: ['confirm'] },
        { id: 'cmd_vv', label: '👁️ View Once', alias: ['vv'] },
      ]
    },
    {
      id: 'cat_info',
      label: 'ℹ️ Info',
      emoji: 'ℹ️',
      commands: [
        { id: 'cmd_info', label: 'ℹ️ Infos Bot', alias: ['info-btn', 'infobtn', 'ib'] },
        { id: 'cmd_stats', label: '📊 Statistiques', alias: ['stats'] },
        { id: 'cmd_system', label: '💻 Système', alias: ['system'] },
        { id: 'cmd_uptime', label: '⏱️ Uptime', alias: ['uptime-extra'] },
        { id: 'cmd_myaccount', label: '👤 Mon Compte', alias: ['myaccount'] },
        { id: 'cmd_repo', label: '📦 Repo', alias: ['repo-v2'] },
        { id: 'cmd_religion', label: '🙏 Religion', alias: ['religion'] },
        { id: 'cmd_basic', label: '📖 CMD Basiques', alias: ['basic-commands'] },
        { id: 'cmd_directory', label: '📂 Répertoire', alias: ['directory'] },
      ]
    },
    {
      id: 'cat_economy',
      label: '💰 Économie',
      emoji: '💰',
      commands: [
        { id: 'cmd_balance', label: '💵 Solde', alias: ['balance'] },
        { id: 'cmd_daily', label: '📅 Quotidien', alias: ['daily'] },
        { id: 'cmd_weekly', label: '📆 Hebdomadaire', alias: ['weekly'] },
        { id: 'cmd_work', label: '💼 Travailler', alias: ['work'] },
        { id: 'cmd_mine', label: '⛏️ Miner', alias: ['mine'] },
        { id: 'cmd_crime', label: '🔫 Crime', alias: ['crime'] },
        { id: 'cmd_buy', label: '🛒 Acheter', alias: ['buy'] },
        { id: 'cmd_shop', label: '🏪 Boutique', alias: ['shop'] },
        { id: 'cmd_deposit', label: '🏦 Déposer', alias: ['dep'] },
        { id: 'cmd_withdraw', label: '💸 Retirer', alias: ['wd'] },
        { id: 'cmd_transfer', label: '💸 Transférer', alias: ['pay', 'send'] },
        { id: 'cmd_topcoins', label: '🏆 Classement', alias: ['topcoins'] },
        { id: 'cmd_role', label: '🎭 Rôle', alias: ['role'] },
        { id: 'cmd_levelup', label: '⬆️ Level Up', alias: ['levelup'] },
        { id: 'cmd_reset', label: '🔄 Reset', alias: ['resetbalance', 'resetcoin'] },
      ]
    },
    {
      id: 'cat_group',
      label: '👥 Groupe',
      emoji: '👥',
      commands: [
        { id: 'cmd_create', label: '➕ Créer Groupe', alias: ['create', 'creategroup'] },
        { id: 'cmd_delete', label: '🗑️ Supprimer', alias: ['del', 'delete', 'deldup'] },
        { id: 'cmd_invite', label: '📩 Inviter', alias: ['invite'] },
        { id: 'cmd_label', label: '🏷️ Label', alias: ['label'] },
        { id: 'cmd_analytics', label: '📊 Analytics', alias: ['group-analytics'] },
        { id: 'cmd_groupguard', label: '🛡️ Guard', alias: ['groupguard'] },
        { id: 'cmd_antiflood', label: '🌊 Anti-Flood', alias: ['antiflood'] },
      ]
    },
    {
      id: 'cat_owner',
      label: '👑 Owner',
      emoji: '👑',
      commands: [
        { id: 'cmd_broadcast', label: '📢 Broadcast', alias: ['broadcast'] },
        { id: 'cmd_block', label: '🚫 Bloquer', alias: ['block'] },
        { id: 'cmd_unblock', label: '✅ Débloquer', alias: ['unblock'] },
        { id: 'cmd_restart', label: '🔄 Restart', alias: ['restart_bot'] },
        { id: 'cmd_prefix', label: '🔤 Prefix', alias: ['prefix'] },
        { id: 'cmd_setname', label: '📝 Nom', alias: ['setname'] },
        { id: 'cmd_setpp', label: '🖼️ Photo', alias: ['setpp'] },
        { id: 'cmd_host', label: '🖥️ Host', alias: ['host'] },
        { id: 'cmd_pair', label: '🔗 Pair', alias: ['pair-owner'] },
        { id: 'cmd_settings', label: '⚙️ Settings', alias: ['settings-extra'] },
        { id: 'cmd_afk', label: '💤 AFK', alias: ['afk'] },
        { id: 'cmd_statusquote', label: '📢 Status Quote', alias: ['statusquote', 'sq', 'pubstatus'] },
      ]
    },
    {
      id: 'cat_security',
      label: '🔒 Sécurité',
      emoji: '🔒',
      commands: [
        { id: 'cmd_security', label: '🔒 Sécurité', alias: ['security'] },
        { id: 'cmd_securitystats', label: '📊 Stats Sécurité', alias: ['security-stats'] },
        { id: 'cmd_linkintel', label: '🔗 Link Intel', alias: ['link-intelligence'] },
      ]
    },
    {
      id: 'cat_logo',
      label: '🎨 Logo',
      emoji: '🎨',
      commands: [
        { id: 'cmd_logomaker', label: '🎨 Créer Logo', alias: ['logo-maker'] },
      ]
    },
  ]
};
