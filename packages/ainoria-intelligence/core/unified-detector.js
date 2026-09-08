const GROUP_TYPES = {
  gaming: {
    keywords: [
      'game', 'gaming', 'jeu', 'play', 'gamer', 'ps[0-9]', 'xbox', 'mangas?', 'anime',
      'esport', 'roblox', 'minecraft', 'fortnite', 'free\\s?fire', 'frefire', 'pubg',
      'valorant', 'gta\\b', 'nintendo', 'playstation', 'clash', 'ff',
      'jeux', 'console', 'pc', 'twitch', 'stream', 'speedrun',
    ],
    themeSection: '🎮 *5. THÈME & SPOILERS*\n• Discussions autour de jeux vidéo\n• [SPOILER] obligatoire avant de révéler\n• Pas de hors-sujet prolongé\n• Partage tes builds, astuces et highlights',
    publications: {
      8: "☀️ *Bonjour les gamers !*\n\nQuestion du jour : Quel est le jeu qui vous a le plus marqué cette année ? 🤔\n\nPartagez en commentaire ! 🎮",
      12: "🎮 *PAUSE MIDI !*\n\nDevinez le jeu avec ces emojis : 🏝️🔫🏗️\n\nRéponse dans 30 min !",
      20: "🌙 *SOIRÉE GAMING !*\n\nQui est chaud pour une session ce soir ? Dites quel jeu ! 🔥",
    },
    tone: 'Tu parles de jeux vidéo, mangas et e-sport avec un ton détendu et fun. Tu connais les références gaming. 🎮',
    animations: ['quiz', 'defi', 'sondage'],
  },
  roblox: {
    keywords: [
      'roblox', 'blox fruits', 'brookhaven', 'adopt me', 'jailbreak', 'tower of hell',
      'robux', 'roblox studio',
    ],
    themeSection: '🎮 *5. THÈME ROBLOX*\n• Discussions autour de Roblox\n• [SPOILER] avant de révéler les secrets\n• Pas de hors-sujet prolongé\n• Partage tes builds et astuces\n• Pas de vente de Robux illégaux',
    publications: {
      8: "☀️ *Bonjour les Robloxers !*\n\nAujourd'hui on parle de *Blox Fruits* ! Quel est votre fruit préféré ? 🍇\n\n@tous",
      12: "🎮 *DÉFI ROBLOX !*\n\nQui peut finir *Tower of Hell* en moins de 2 min ? ⏱️\n\nPostez vos screenshots ! 📸",
      20: "🌙 *ROBLOX SOIRÉE !*\n\nQui est chaud pour du *Brookhaven RP* ce soir ? 🚗\n\nOn se retrouve à 21h !",
    },
    tone: 'Pote gamer Roblox, passionné et décontracté. Tu connais tous les jeux et les astuces. 🎮',
    animations: ['quiz gaming', 'defi roblox', 'classement'],
  },
  anime: {
    keywords: [
      'anime', 'manga', 'naruto', 'one piece', 'demon slayer', 'jujutsu',
      'attack on titan', 'bleach', 'dragon ball', 'otaku', 'waifu', 'scan',
    ],
    themeSection: '🎌 *5. THÈME ANIME/MANGA*\n• Discussions anime et manga\n• [SPOILER] obligatoire\n• Pas de liens illégaux de lecture\n• Fan arts et créations bienvenus\n• Respecte les goûts de chacun',
    publications: {
      8: "☀️ *Bonjour les otakus !*\n\nPersonnage du jour : *Gojo Satoru* 🤩\n\nPourquoi il déchire ? Son Domaine Expansion est INCROYABLE !\n\n@tous votre perso préféré ?",
      12: "⚔️ *VERSUS DU JOUR !*\n\n*Naruto* VS *Luffy*\n\nQui gagne ? 🤔\nA) Naruto  B) Luffy\n\nJustifiez ! 🔥",
      20: "🌙 *ANIME SOIRÉE !*\n\nQuel anime vous regardez en ce moment ? 📺\n\nPartagez vos discoveries !",
    },
    tone: 'Otaku passionné, tu parles d\'anime et de manga avec enthousiasme. Tu connais les classiques et les nouveautés. 🎌',
    animations: ['quiz anime', 'versus', 'blind test'],
  },
  famille: {
    keywords: [
      'famille', 'family', 'fam', 'parent', 'mama', 'papa', 'maman', 'frère', 'sœur',
      'frere', 'soeur', 'clan', 'enfant', 'bebe', 'mariage', 'tonton', 'tatie',
    ],
    themeSection: '👨‍👩‍👧‍👦 *5. THÈME FAMILLE*\n• Conversations familiales\n• Respect de tous les âges\n• Pas de sujets controversés sans consensus\n• Partage de souvenirs bienvenu',
    publications: {
      8: "☀️ *Bonjour la famille !*\n\nJ'espère que vous allez bien ! Quoi de beau prévu aujourd'hui ? ❤️",
      12: "🌤️ *PAUSE MIDI !*\n\nQui a préparé un bon déjeuner ? Partagez vos recettes ! 🍽️",
      20: "🌙 *BONNE SOIRÉE !*\n\nUn petit mot gentil pour les membres de la famille ? 💕",
    },
    tone: 'Ton chaleureux, bienveillant, respectueux de tous les âges. Tu valorises la cohésion familiale. 👨‍👩‍👧‍👦',
    animations: ['photo', 'souvenir', 'annonce'],
  },
  travail: {
    keywords: [
      'travail', 'work', 'job', 'projet', 'team', 'équipe', 'bureau', 'office',
      'entreprise', 'collègue', 'manager', 'réunion', 'deadline', 'client',
    ],
    themeSection: '💼 *5. THÈME TRAVAIL*\n• Discussions professionnelles\n• Respect de la confidentialité\n• Pas de hors-sujet prolongé\n• Partage d\'opportunités encouragé',
    publications: {
      8: "☀️ *Bonjour l'équipe !*\n\nCitation du jour : 'Le succès c'est d'aller d'échec en échec sans perdre son enthousiasme.'\n\nBelle journée productive ! 💼",
      12: "💼 *PAUSE DÉJEUNER !*\n\nQui a déjà signé un deal autour d'un repas ? Partagez vos astuces networking ! 🤝",
      20: "🌙 *BILAN DU JOUR !*\n\nQuelle a été votre plus grande réussite aujourd'hui ? 💪",
    },
    tone: 'Ton professionnel, concis, orienté solutions. Tu ne perds pas de temps. 💼',
    animations: ['sondage', 'annonce', 'question'],
  },
  commerce: {
    keywords: [
      'commerce', 'vente', 'achat', 'market', 'boutique', 'shop', 'business', 'promo',
      'sell', 'buy', 'affaire', 'entreprise', 'produit', 'prix', 'livraison',
    ],
    themeSection: '🏪 *5. THÈME COMMERCE*\n• Discussions commerce et vente\n• Prix clairs obligatoires\n• Transactions sécurisées uniquement\n• Pas de fausses annonces',
    publications: {
      8: "☀️ *Bonjour les commerçants !*\n\nAstuce du jour : Toujours vérifier les avis avant d'acheter en ligne ! 🛡️",
      12: "🏪 *MARCHÉ DU JOUR !*\n\nQuel est le meilleur plan que vous ayez trouvé cette semaine ? 🛒",
      20: "🌙 *BILAN COMMERCIAL !*\n\nPartagez vos meilleures ventes du jour ! 📈",
    },
    tone: 'Ton professionnel. Tu es très vigilant sur les arnaques et les escroqueries. 🏪',
    animations: ['annonce', 'offre', 'sondage'],
  },
  education: {
    keywords: [
      'école', 'school', 'classe', 'étudiant', 'student', 'cours', 'formation',
      'lycée', 'université', 'devoir', 'examen', 'professeur', 'étude', 'diplôme',
    ],
    themeSection: '📚 *5. THÈME ÉTUDES*\n• Discussions scolaires et universitaires\n• Pas de plagiat\n• Sources à citer\n• Entraide bienvenue\n• Respect des horaires de cours',
    publications: {
      8: "☀️ *Bonjour à tous !*\n\nLe saviez-vous ? Apprendre 30 min le matin est 3x plus efficace que le soir.\n\nBonne journée d'étude ! 📚",
      12: "📚 *QUIZ RAPIDE !*\n\nQuelle est la capitale du Sénégal ?\nA) Abidjan  B) Dakar  C) Bamako\n\nRépondez vite ! 🧠",
      20: "🌙 *RÉVISIONS DU SOIR !*\n\nAstuce : relisez vos cours 10 min avant de dormir.\n\nC'est le meilleur moment pour mémoriser ! 💡",
    },
    tone: 'Ton pédagogique, encourageant, adapté aux étudiants. Tu simplifies les concepts. 📚',
    animations: ['quiz', 'question', 'defi'],
  },
  sport: {
    keywords: [
      'sport', 'foot', 'football', 'basket', 'tennis', 'run', 'gym', 'fitness',
      'match', 'entrainement', 'joueur', 'equipe', 'score', 'championnat',
    ],
    themeSection: '⚽ *5. THÈME SPORT*\n• Discussions sportives\n• Respect des supporters adverses\n• Pas de provocation\n• Analyses constructives\n• Pas de streams illégaux',
    publications: {
      8: "☀️ *Bonjour les sportifs !*\n\nMotivation du jour : 'La victoire appartient au persévérant.'\n\nBonne journée d'entraînement ! 💪",
      12: "⚽ *ANALYSE DU JOUR !*\n\nQuel match vous a le plus marqué cette semaine ? 🏆",
      20: "🌙 *PRONOSTIC !*\n\nQui va gagner le match ce soir ? 🤔\n\nA) Équipe A  B) Équipe B",
    },
    tone: 'Ton dynamique, motivant. Tu parles de matchs et d\'actualités sportives. ⚽',
    animations: ['sondage', 'defi', 'annonce'],
  },
  technologie: {
    keywords: [
      'tech', 'code', 'dev', 'program', 'informatique', 'hack', 'cyber', 'ia\\b',
      'technologie', 'programmation', 'logiciel', 'application', 'web', 'data',
    ],
    themeSection: '💻 *5. THÈME TECH*\n• Discussions techniques\n• Pas de logiciels crackés\n• Sources à vérifier\n• Aide aux débutants encouragée\n• Crédite les sources',
    publications: {
      8: "☀️ *Bonjour les devs !*\n\nAstuce du jour : Utilisez `console.time()` pour mesurer les performances ! ⚡",
      12: "💻 *QUIZ TECH !*\n\nQuel langage a créé Brendan Eich en 10 jours ? 🤔\nA) Python  B) JavaScript  C) Java",
      20: "🌙 *DÉBAT TECH !*\n\nMeilleur framework frontend en 2026 ? 🤔\n\nReact, Vue, Svelte, autre ?",
    },
    tone: 'Ton technique et précis. Tu aimes débattre de tech et de programmation. 💻',
    animations: ['question', 'defi', 'sondage'],
  },
  religion: {
    keywords: [
      'religion', 'prière', 'church', 'mosque', 'bible', 'coran', 'foi', 'dieu',
      'eglise', 'priere', 'musulman', 'chretien', 'culte', 'messe',
    ],
    themeSection: '🕊️ *5. THÈME SPIRITUEL*\n• Respect de toutes les croyances\n• Pas de débats haineux\n• Pas de moqueries\n• Sources fiables pour les citations\n• Bienveillance et ouverture d\'esprit',
    publications: {
      8: "☀️ *Bonjour et que Dieu vous bénisse !*\n\nCitation du jour : 'La foi déplace les montagnes.' 🙏\n\nBonne journée à tous !",
      12: "📖 *PAROLE DU JOUR !*\n\nQuel verset vous touche le plus en ce moment ? 🕊️",
      20: "🌙 *MÉDITATION DU SOIR !*\n\nPrenez un moment pour vous recueillir. 🙏\n\nBonne nuit à tous.",
    },
    tone: 'Ton respectueux, neutre. Tu ne prends jamais position sur les croyances. 🕊️',
    animations: ['citation', 'question', 'annonce'],
  },
  communaute: {
    keywords: [
      'communauté', 'community', 'quartier', 'ville', 'région', 'nation', 'voisin',
    ],
    themeSection: '🌍 *5. THÈME COMMUNAUTÉ*\n• Respect et bienveillance\n• Pas de discriminations\n• Pas de harcèlement\n• Signale tout abus\n• On construit ensemble',
    publications: {
      8: "☀️ *Bonjour la communauté !*\n\nActivité du jour : Partagez une bonne nouvelle de votre quartier ! 🌟",
      12: "🤝 *ENTRAIDE !*\n\nQui a besoin d'un coup de main aujourd'hui ? 💪",
      20: "🌙 *BILAN COMMUNAUTAIRE !*\n\nQu'est-ce qui vous a rendu souriant aujourd'hui ? 😊",
    },
    tone: 'Ton inclusif, rassembleur. Tu valorises la diversité et le dialogue. 🌍',
    animations: ['sondage', 'annonce', 'question'],
  },
  sante: {
    keywords: [
      'santé', 'health', 'medical', 'medecin', 'hopital', 'docteur', 'soin',
      'pharmacie', 'maladie', 'traitement',
    ],
    themeSection: '🏥 *5. THÈME SANTÉ*\n• Informations fiables uniquement\n• Pas de diagnostic en ligne\n• Consultez un professionnel\n• Urgence :Appelez le 15 ou 112\n• Confidentialité des patients',
    publications: {
      8: "☀️ *Bonjour !*\n\nAstuce santé : Buvez un verre d'eau en vous réveillant ! 💧\n\nBonne journée !",
      12: "🏥 *LE SAVIEZ-VOUS ?*\n\nMarcher 30 min par jour réduit les risques cardiovasculaires de 30%. 🚶",
      20: "🌙 *BONNE SOIRÉE !*\n\nPrenez soin de vous, vous n'avez qu'un seul corps ! ❤️",
    },
    tone: 'Ton bienveillant et rassurant. Tu encourages à consulter un professionnel. 🏥',
    animations: ['question', 'annonce', 'sondage'],
  },
  musique: {
    keywords: [
      'musique', 'music', 'rap', 'chant', 'chanteur', 'album', 'concert',
      'instrument', 'guitare', 'piano', 'beat', 'freestyle',
    ],
    themeSection: '🎵 *5. THÈME MUSIQUE*\n• Discussions musicales\n• Respect des artistes\n• Pas de piratage\n• Créations originales encouragées\n• Crédite les sources',
    publications: {
      8: "☀️ *Bonjour les mélomanes !*\n\nDécouverte du jour : Quel artiste local mérite plus de visibilité ? 🎤",
      12: "🎵 *BATTLE MUSICALE !*\n\nRap français vs Rap américain ? 🤔\n\nA) FR  B) US\n\nJustifiez ! 🔥",
      20: "🌙 *PLAYLIST DU SOIR !*\n\nQuel est votre morceau du moment ? 🎧",
    },
    tone: 'Ton passionné et branché. Tu connais la scène musicale. 🎵',
    animations: ['playlist', 'defi', 'sondage'],
  },
  general: {
    keywords: [],
    themeSection: '💬 *5. THÈME & DISCUSSION*\n• Respecter le thème du groupe\n• Éviter les hors-sujets\n• Conversations constructives\n• Partage d\'expériences bienvenu',
    publications: {
      8: "☀️ *Bonjour la team !*\n\nQuoi de prévu aujourd'hui ?\nExcellente journée à tous ! ✨",
      12: "🌤️ *MIDI !*\n\nPetite pause bien méritée. Qui a prévu quoi ?",
      20: "🌙 *BONNE SOIRÉE !*\n\nLa journée se termine. Prenez du temps pour vous ! ✨",
    },
    tone: 'Ton naturel et adaptable selon les sujets de la conversation. 😊',
    animations: ['sondage', 'question', 'annonce'],
  },
};

const COMMON_RULES = {
  respect: '🤝 *2. RESPECT & COMPORTEMENT*\nLangage correct obligatoire.\nInsultes, racisme, sexisme,\nharcèlement = exclusion.',
  forbidden: '🚫 *3. CONTENUS INTERDITS*\n• Pornographie, violence, gore\n• Arnaques, phishing, faux liens\n• Piratage, hacks, cheats\n• Données personnelles sans accord',
  spam: '📢 *4. SPAM & PUBLICITÉ*\n• Pas de spam ni messages répétés\n• Pas de pub sans accord admin\n• Pas de chaînes de messages',
  privacy: '🔒 *6. VIE PRIVÉE*\n• Ne pas diffuser les discussions\n• Ne pas partager photos/infos\n• Signalements confidentiels',
  sanctions: '⚠️ *7. SANCTIONS*\n1er : Avertissement privé\n2e : Mute 12h\n3e : Exclusion 3 jours\nRécidive : Exclusion définitive',
  admin: '👑 *8. ADMINISTRATION*\n• Respecter les décisions admins\n• Contester en privé uniquement\n• @DJOUSSE TECH modère auto',
  signalement: '📩 *9. SIGNALEMENT*\nSignaler tout abus à un admin\nou @DJOUSSE TECH en privé.\n\n✅ En restant, vous acceptez\nl\'intégralité de ce règlement.',
};

function buildFullRules(groupName, type, description) {
  const typeConfig = GROUP_TYPES[type] || GROUP_TYPES.general;
  const desc = description || `Groupe ${type} nommé "${groupName}"`;

  return [
    `📜 *1. OBJET DU GROUPE*\n${desc}`,
    COMMON_RULES.respect,
    COMMON_RULES.forbidden,
    COMMON_RULES.spam,
    typeConfig.themeSection,
    COMMON_RULES.privacy,
    COMMON_RULES.sanctions,
    COMMON_RULES.admin,
    COMMON_RULES.signalement,
  ].join('\n\n');
}

function buildShortRules(type) {
  const typeConfig = GROUP_TYPES[type] || GROUP_TYPES.general;
  return [
    'Respecter tous les membres',
    'Pas de spam ni liens suspects',
    'Pas d\'insultes ni harcèlement',
    'Rester dans le thème du groupe',
    'Signaler les problèmes aux admins',
  ].map((r, i) => `${i + 1}. ${r}`).join('\n');
}

const MIN_CONFIDENCE = 0.02;

function stripAccents(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function matchKeywords(text, keywords) {
  let score = 0;
  const clean = stripAccents(text.toLowerCase());
  for (const kw of keywords) {
    try {
      const regex = new RegExp(kw, 'i');
      if (regex.test(clean) || regex.test(text.toLowerCase())) {
        score += kw.length > 5 ? 2 : 1;
      }
    } catch {
      if (clean.includes(kw)) score += kw.length > 5 ? 2 : 1;
    }
  }
  return score;
}

export function detectGroupType(groupName = '', context = '', messages = []) {
  const nameScore = {};
  const ctxScore = {};
  const msgScore = {};

  const name = (groupName || '').toLowerCase();
  const ctx = (context || '').toLowerCase();
  const allText = Array.isArray(messages) ? messages.join(' ').toLowerCase() : '';

  for (const [type, config] of Object.entries(GROUP_TYPES)) {
    if (config.keywords.length === 0) continue;
    nameScore[type] = matchKeywords(name, config.keywords);
    ctxScore[type] = matchKeywords(`${name} ${ctx}`, config.keywords);
    if (allText) {
      const words = allText.split(/\s+/);
      const rawScore = matchKeywords(allText, config.keywords);
      msgScore[type] = rawScore / Math.max(1, words.length);
    }
  }

  const combined = {};
  for (const type of Object.keys(GROUP_TYPES)) {
    const ns = nameScore[type] || 0;
    const cs = ctxScore[type] || 0;
    const ms = msgScore[type] || 0;
    combined[type] = ns * 3 + cs * 2 + ms * 5;
  }

  const sorted = Object.entries(combined).sort((a, b) => b[1] - a[1]);
  const best = sorted[0];

  if (!best || best[1] < MIN_CONFIDENCE * 10) {
    return {
      type: 'general',
      confidence: 0,
      rules: buildShortRules('general'),
      fullRules: buildFullRules(groupName, 'general', context),
      tone: GROUP_TYPES.general.tone,
      animations: GROUP_TYPES.general.animations,
      publications: GROUP_TYPES.general.publications,
    };
  }

  const typeConfig = GROUP_TYPES[best[0]];
  return {
    type: best[0],
    confidence: Math.min(1, best[1] / 10),
    rules: buildShortRules(best[0]),
    fullRules: buildFullRules(groupName, best[0], context),
    tone: typeConfig.tone,
    animations: typeConfig.animations,
    publications: typeConfig.publications,
  };
}

export function getRulesForType(type) {
  const config = GROUP_TYPES[type] || GROUP_TYPES.general;
  return config.rules || buildShortRules(type);
}

export function getFullRulesForType(type, groupName = '', description = '') {
  return buildFullRules(groupName, type, description);
}

export function getShortRulesForType(type) {
  return buildShortRules(type);
}

export function getToneForType(type) {
  return GROUP_TYPES[type]?.tone || GROUP_TYPES.general.tone;
}

export function getAnimationsForType(type) {
  return GROUP_TYPES[type]?.animations || GROUP_TYPES.general.animations;
}

export function getPublicationsForType(type) {
  return GROUP_TYPES[type]?.publications || GROUP_TYPES.general.publications;
}

export function getAllTypes() {
  return Object.keys(GROUP_TYPES);
}

export { GROUP_TYPES };
