import { createLogger } from '../../infrastructure/logger.js';
import { executor, ACTION_TYPES } from '../../ainoria-intelligence/actions/action-executor.js';

const log = createLogger('INTERACTIVE_MENU');

const MENU_DEFINITIONS = {
  main: {
    title: '🤖 *DJOUSSE TECH — Menu Principal*',
    description: 'Choisis une option ci-dessous :',
    buttonText: '📋 Voir les options',
    sections: [
      {
        title: '🏠 GROUPES & COMMUNAUTÉ',
        rows: [
          { rowId: 'menu:groups:list', title: '📋 Mes groupes', description: 'Voir et gérer mes groupes' },
          { rowId: 'menu:groups:create', title: '➕ Créer un groupe', description: 'Nouveau groupe géré par le bot' },
          { rowId: 'menu:groups:settings', title: '⚙️ Paramètres groupe', description: 'Configurer le groupe actuel' },
          { rowId: 'menu:groups:stats', title: '📊 Statistiques', description: 'Activité, membres, engagement' },
        ],
      },
      {
        title: '🎭 MISSIONS & PRODUCTIVITÉ',
        rows: [
          { rowId: 'menu:missions:list', title: '📋 Mes missions', description: 'Voir mes missions actives' },
          { rowId: 'menu:missions:create', title: '➕ Nouvelle mission', description: 'Créer une mission guidée' },
          { rowId: 'menu:missions:templates', title: '📚 Modèles', description: 'Modèles de missions prêts' },
          { rowId: 'menu:rdv', title: '📅 Rendez-vous', description: 'Gérer mon calendrier' },
        ],
      },
      {
        title: '🎨 CRÉATION & MÉDIAS',
        rows: [
          { rowId: 'menu:sticker', title: '🎨 Créer sticker', description: 'Image → Sticker (réponds à une image)' },
          { rowId: 'menu:image', title: '🖼️ Générer image', description: 'DALL-E : décrit ce que tu veux' },
          { rowId: 'menu:voice', title: '🎙️ Message vocal', description: 'Texte → Vocal (plusieurs voix)' },
          { rowId: 'menu:translate', title: '🌍 Traduire', description: 'Message → Autre langue' },
        ],
      },
      {
        title: '💰 ÉCONOMIE & PAIEMENTS',
        rows: [
          { rowId: 'menu:balance', title: '💰 Mon solde', description: 'Voir mes coins/banque' },
          { rowId: 'menu:shop', title: '🛒 Boutique', description: 'Acheter des fonctionnalités' },
          { rowId: 'menu:pay', title: '💳 Paiement CinetPay', description: 'Mobile Money (Orange/MTN/Moov)' },
          { rowId: 'menu:transfer', title: '🔄 Transférer', description: 'Envoyer des coins' },
        ],
      },
      {
        title: '🔍 RECHERCHE & OUTILS',
        rows: [
          { rowId: 'menu:search', title: '🔍 Recherche globale', description: 'Mémoire, messages, contacts' },
          { rowId: 'menu:weather', title: '🌤️ Météo', description: 'Météo de ta ville' },
          { rowId: 'menu:poll', title: '📊 Créer sondage', description: 'Question + options' },
          { rowId: 'menu:web', title: '🌐 Recherche web', description: 'Infos temps réel' },
        ],
      },
      {
        title: '📢 CHAÎNES & DIFFUSION',
        rows: [
          { rowId: 'menu:channels:list', title: '📢 Chaînes publiques', description: 'Voir et rejoindre des chaînes' },
          { rowId: 'menu:channels:mine', title: '📋 Mes chaînes', description: 'Mes chaînes et abonnements' },
          { rowId: 'menu:channels:create', title: '➕ Créer une chaîne', description: 'Nouvelle chaîne de diffusion' },
          { rowId: 'menu:disappear', title: '⏳ Messages temporaires', description: 'Messages qui disparaissent' },
        ],
      },
      {
        title: '💼 ENTREPRISE & ANNUAIRE',
        rows: [
          { rowId: 'menu:biz:profile', title: '💼 Mon profil pro', description: 'Voir/modifier mon profil' },
          { rowId: 'menu:biz:directory', title: '📇 Annuaire', description: 'Chercher des entreprises' },
          { rowId: 'menu:biz:register', title: '📝 S\'inscrire', description: 'Ajouter mon entreprise' },
          { rowId: 'menu:catalogue', title: '📦 Catalogue', description: 'Voir les produits' },
        ],
      },
      {
        title: '📞 APPELS & COMMUNICATION',
        rows: [
          { rowId: 'menu:call:voice', title: '📞 Appel vocal', description: 'Lancer un appel vocal' },
          { rowId: 'menu:call:video', title: '📹 Appel vidéo', description: 'Lancer un appel vidéo' },
          { rowId: 'menu:call:me', title: '📞 M\'appeler', description: 'Recevoir un appel' },
        ],
      },
      {
        title: '🔐 SÉCURITÉ & CONFIDENTIALITÉ',
        rows: [
          { rowId: 'menu:security:guide', title: '🔐 Guide sécurité', description: 'Tous les réglages de sécurité' },
          { rowId: 'menu:security:2fa', title: '🔐 Double vérif.', description: 'Activer le 2FA' },
          { rowId: 'menu:security:code', title: '🔑 Code sécurité', description: 'Vérifier le chiffrement' },
          { rowId: 'menu:security:privacy', title: '👁️ Confidentialité', description: 'Voir les réglages privés' },
        ],
      },
      {
        title: '🏷️ ÉTIQUETTES & RÉPONSES',
        rows: [
          { rowId: 'menu:labels:list', title: '🏷️ Mes étiquettes', description: 'Gérer les étiquettes' },
          { rowId: 'menu:autoreply:list', title: '🤖 Réponses auto', description: 'Voir les réponses automatiques' },
          { rowId: 'menu:autoreply:add', title: '➕ Ajouter réponse', description: 'Nouvelle réponse automatique' },
          { rowId: 'menu:welcome', title: '👋 Message accueil', description: 'Configurer l\'accueil privé' },
        ],
      },
      {
        title: '⚙️ CONFIGURATION',
        rows: [
          { rowId: 'menu:prefs:voice', title: '🎙️ Voix ON/OFF', description: 'Activer réponses vocales' },
          { rowId: 'menu:prefs:lang', title: '🌍 Langue', description: 'Changer la langue' },
          { rowId: 'menu:prefs:notify', title: '🔔 Notifications', description: 'Gérer les alertes' },
          { rowId: 'menu:help', title: '❓ Aide complète', description: 'Toutes les commandes' },
        ],
      },
    ],
  },

  admin: {
    title: '👑 *PANEL ADMINISTRATION*',
    description: 'Outils de gestion avancés :',
    buttonText: '🛠️ Outils admin',
    sections: [
      {
        title: '👥 GESTION MEMBRES',
        rows: [
          { rowId: 'admin:ban', title: '🚫 Bannir', description: 'Bannir un membre du groupe' },
          { rowId: 'admin:mute', title: '🔇 Muet', description: 'Mettre en sourdine temporaire' },
          { rowId: 'admin:promote', title: '⬆️ Promouvoir', description: 'Donner droits admin' },
          { rowId: 'admin:warn', title: '⚠️ Avertir', description: 'Donner un avertissement' },
        ],
      },
      {
        title: '🛡️ SÉCURITÉ GROUPE',
        rows: [
          { rowId: 'admin:antilink', title: '🔗 Anti-liens', description: 'Activer/désactiver' },
          { rowId: 'admin:antibot', title: '🤖 Anti-bots', description: 'Détecter les bots' },
          { rowId: 'admin:cleanup', title: '🧹 Nettoyer', description: 'Supprimer messages indésirables' },
          { rowId: 'admin:lock', title: '🔒 Verrouiller', description: 'Seuls admins parlent' },
        ],
      },
      {
        title: '📊 RAPPORTS',
        rows: [
          { rowId: 'admin:report:group', title: '📋 Rapport groupe', description: 'Activité complète' },
          { rowId: 'admin:report:user', title: '👤 Rapport membre', description: 'Historique d\'un membre' },
          { rowId: 'admin:audit', title: '📋 Audit', description: 'Logs de modération' },
        ],
      },
    ],
  },

  owner: {
    title: '👑 *PANEL PROPRIÉTAIRE*',
    description: 'Contrôle total du système :',
    buttonText: '🎛️ Contrôles',
    sections: [
      {
        title: '🤖 CONTRÔLE BOT',
        rows: [
          { rowId: 'owner:restart', title: '🔄 Redémarrer', description: 'Redémarrer le bot' },
          { rowId: 'owner:status', title: '📊 Statut complet', description: 'Santé, uptime, modules' },
          { rowId: 'owner:logs', title: '📋 Logs récents', description: 'Voir les derniers logs' },
          { rowId: 'owner:backup', title: '💾 Backup session', description: 'Sauvegarder la session' },
        ],
      },
      {
        title: '🌐 DASHBOARD & API',
        rows: [
          { rowId: 'owner:dashboard', title: '🌐 Ouvrir dashboard', description: 'Lien vers l\'interface web' },
          { rowId: 'owner:api:keys', title: '🔑 Clés API', description: 'Gérer les clés' },
          { rowId: 'owner:webhook', title: '🔗 Webhooks', description: 'Configurer les webhooks' },
        ],
      },
      {
        title: '💰 MONÉTISATION',
        rows: [
          { rowId: 'owner:payments', title: '💳 Paiements', description: 'Voir transactions CinetPay' },
          { rowId: 'owner:pricing', title: '💰 Tarifs', description: 'Configurer les prix' },
          { rowId: 'owner:subs', title: '👥 Abonnements', description: 'Gérer les abonnés' },
        ],
      },
      {
        title: '🔧 SYSTÈME',
        rows: [
          { rowId: 'owner:update', title: '⬆️ Mise à jour', description: 'Tirer dernière version GitHub' },
          { rowId: 'owner:cleanup', title: '🧹 Nettoyage', description: 'Nettoyer DB, logs, temp' },
          { rowId: 'owner:debug', title: '🐛 Mode debug', description: 'Activer logs verbeux' },
        ],
      },
    ],
  },

  group: {
    title: '🏠 *GESTION DU GROUPE*',
    description: 'Actions rapides pour ce groupe :',
    buttonText: '📋 Actions groupe',
    sections: [
      {
        title: '⚙️ CONFIGURATION',
        rows: [
          { rowId: 'group:welcome', title: '👋 Message bienvenue', description: 'Définir le message d\'accueil' },
          { rowId: 'group:rules', title: '📜 Règles', description: 'Définir/afficher les règles' },
          { rowId: 'group:auto', title: '🤖 Auto-modération', description: 'Activer les protections' },
          { rowId: 'group:type', title: '🏷️ Type de groupe', description: 'Famille, travail, gaming...' },
        ],
      },
      {
        title: '📢 ANNONCES',
        rows: [
          { rowId: 'group:announce', title: '📢 Faire annonce', description: 'Envoyer à tous les membres' },
          { rowId: 'group:poll', title: '📊 Sondage rapide', description: 'Créer un vote' },
          { rowId: 'group:event', title: '📅 Créer événement', description: 'Date, heure, lieu, invitations' },
        ],
      },
      {
        title: '👥 MEMBRES',
        rows: [
          { rowId: 'group:list', title: '📋 Liste membres', description: 'Voir tous les membres' },
          { rowId: 'group:admins', title: '👑 Admins', description: 'Gérer les administrateurs' },
          { rowId: 'group:inactive', title: '😴 Inactifs', description: 'Détecter les membres silencieux' },
        ],
      },
    ],
  },
};

export async function sendInteractiveMenu(sock, jid, menuKey = 'main', customTitle = null) {
  const menu = MENU_DEFINITIONS[menuKey];
  if (!menu) {
    log.warn(`Menu inconnu: ${menuKey}`);
    return false;
  }

  try {
    const message = {
      text: customTitle || menu.title,
      footer: menu.description,
      interactiveMessage: {
        type: 'list',
        header: { type: 'text', text: 'DJOUSSE TECH' },
        body: { text: menu.description },
        footer: { text: 'Sélectionne une option' },
        action: {
          button: menu.buttonText,
          sections: menu.sections,
        },
      },
    };

    await sock.sendMessage(jid, message);
    return true;
  } catch (e) {
    log.error(`Erreur envoi menu ${menuKey}: ${e.message}`);
    return false;
  }
}

export async function sendButtonMenu(sock, jid, buttons, title = 'Choisis une action', footer = 'DJOUSSE TECH') {
  try {
    const message = {
      text: title,
      footer,
      interactiveMessage: {
        type: 'buttons',
        header: { type: 'text', text: 'DJOUSSE TECH' },
        body: { text: title },
        footer: { text: footer },
        action: { buttons },
      },
    };
    await sock.sendMessage(jid, message);
    return true;
  } catch (e) {
    log.error(`Erreur boutons: ${e.message}`);
    return false;
  }
}

// ============================================================
// HANDLER IMPLEMENTATIONS
// ============================================================

async function getSender(m) {
  return m.key?.participant || m.key?.remoteJid;
}

async function sendReply(sock, jid, text, quoted = null) {
  await sock.sendMessage(jid, { text }, { quoted });
}

async function getGroupsInfo(sock) {
  try {
    if (!sock.groupMetadata) return [];
    const jids = Object.keys(sock.groupMetadata);
    const groups = [];
    for (const jid of jids) {
      try {
        const meta = await sock.groupMetadata(jid);
        groups.push({ jid: meta.id, name: meta.subject, participants: meta.participants?.length || 0 });
      } catch {}
    }
    return groups;
  } catch { return []; }
}

// ---- Main Menu Handlers ----
async function sendGroupsList(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  if (!sock) return;
  const groups = await getGroupsInfo(sock);
  const jid = m.key.remoteJid;
  if (!groups.length) {
    await sendReply(sock, jid, '📭 Aucun groupe géré par le bot');
    return;
  }
  let text = `📋 *Groupes gérés (${groups.length})*\n\n`;
  groups.forEach((g, i) => {
    text += `${i + 1}. ${g.name}\n   👥 ${g.participants} membres\n   ID: ${g.jid}\n\n`;
  });
  await sendReply(sock, jid, text, m.rawMsg);
}

async function createGroup(m) {
  const jid = m.key.remoteJid;
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  await sendReply(sock, jid, '➕ Pour créer un groupe, utilise la commande :\n`.gcreate <nom> @user1 @user2`\n\nOu utilise le menu web pour plus d\'options.', m.rawMsg);
}

async function sendGroupStats(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  if (!jid?.endsWith('@g.us')) {
    await sendReply(sock, jid, '❌ Commande utilisable seulement en groupe', m.rawMsg);
    return;
  }
  try {
    const meta = await getSocket().groupMetadata(jid);
    const { getGroupProfile } = await import('../../core/community-manager.js');
    const profile = await getGroupProfile(jid);
    let text = `📊 *Stats du groupe : ${meta.subject}*\n\n`;
    text += `👥 Membres : ${meta.participants.length}\n`;
    text += `👑 Admins : ${meta.participants.filter(p => p.admin).length}\n`;
    text += `📝 Description : ${meta.desc || 'Aucune'}\n`;
    if (profile) {
      text += `📊 Messages (7j) : ${profile.messageCount || 0}\n`;
      text += `👥 Actifs (7j) : ${profile.activeMembers || 0}\n`;
      text += `😊 Sentiment : ${profile.sentiment || 'neutre'}\n`;
    }
    await sendReply(sock, jid, text, m.rawMsg);
  } catch (e) {
    await sendReply(getSocket(), jid, '❌ Erreur récupération stats', m.rawMsg);
  }
}

// Missions
async function sendMissionsList(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  try {
    const { planner } = await import('../../conscious/planning-engine.js');
    const missions = planner.getAllMissions().filter(m => m.owner === m.sender || m.participants?.includes(m.sender));
    if (!missions.length) {
      await sendReply(sock, jid, '📭 Aucune mission. Crée-en une avec `.menu missions:create`', m.rawMsg);
      return;
    }
    let text = `📋 *Tes missions (${missions.length})*\n\n`;
    missions.forEach((m, i) => {
      text += `${i + 1}. ${m.title} — ${m.status} (${m.progress || 0}%)\n`;
    });
    await sendReply(sock, jid, text, m.rawMsg);
  } catch (e) {
    await sendReply(sock, jid, '❌ Erreur', m.rawMsg);
  }
}

async function createMission(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  await sendReply(sock, jid, '🎯 Pour créer une mission, dis simplement :\n\n`"Crée une mission pour organiser mon anniversaire"`\n\nLe bot te guidera étape par étape.', m.rawMsg);
}

async function sendMissionTemplates(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  const text = `📚 *Modèles de missions disponibles*\n\n` +
    `1. 🎂 **Anniversaire** — Organisation complète\n` +
    `2. 🚀 **Lancement projet** — Étapes, risques, planning\n` +
    `3. 📦 **Événement** — Logistique, invitations, budget\n` +
    `4. 🏠 **Déménagement** — Checklist complète\n` +
    `5. 💼 **Recherche emploi** — CV, candidatures, entretiens\n` +
    `6. 📚 **Apprentissage** — Cours, exercices, révisions\n\n` +
    `Dis : *"Crée une mission [nom] pour [objectif]"*`;
  await sendReply(getSocket(), m.key.remoteJid, text, m.rawMsg);
}

async function sendCalendarMenu(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  const text = `📅 *Google Calendar*\n\n` +
    `Commandes :\n` +
    `• \`.rdv\` — Voir prochains RDV\n` +
    `• \`.rdv add <titre> <date> <heure>\` — Créer\n` +
    `• \`.rdv free <date>\` — Creneaux libres\n\n` +
    `🔗 Connecter : \`.gcal connect\``;
  await sendReply(sock, jid, text, m.rawMsg);
}

// Creation & Media
async function sendStickerHelp(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  await sendReply(sock, jid, '🎨 *Créer un sticker*\n\nRéponds à une image/vidéo avec :\n`.sticker` ou `.s`\n\nOptions :\n`--crop` — Recadrer en carré\n`--pack <nom>` — Nom du pack\n`--author <nom>` — Auteur', m.rawMsg);
}

async function sendImageGenHelp(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  const text = `🖼️ *Génération d'images (DALL-E)*\n\n` +
    `Dis simplement :\n` +
    `"Génère une image d'un chat astronaute sur Mars"\n` +
    `"Crée une image : logo moderne pour ma startup"\n\n` +
    `Le bot génère et t'envoie l'image.`;
  await sendReply(getSocket(), m.key.remoteJid, text, m.rawMsg);
}

async function sendVoiceHelp(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  const text = `🎙️ *Messages vocaux*\n\n` +
    `• Envoie un vocal → Transcription auto\n` +
    `• Réponse vocale si préférence activée\n` +
    `• Commande : \`.voice <texte>\`\n` +
    `• Voix : homme, femme, jeune, mature, dynamique, douce\n` +
    `• Activer : \`.voice on\` / Désactiver : \`.voice off\``;
  await sendReply(getSocket(), m.key.remoteJid, text, m.rawMsg);
}

async function sendTranslateHelp(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  await sendReply(sock, jid, '🌍 *Traduction*\n\nRéponds à un message avec :\n`.translate` (vers français)\n`.tr en` (vers anglais)\n`.tr es` (vers espagnol)\n\nDétection auto de la langue source.', m.rawMsg);
}

// Economy
async function sendBalance(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  try {
    const { getBalance } = await import('../../infrastructure/database/database.js');
    const bal = await getBalance(m.sender);
    await sendReply(sock, jid, `💰 *Ton solde*\n💵 Cash : ${bal.money}\n🏦 Banque : ${bal.bank}\n💎 Total : ${bal.money + bal.bank}`, m.rawMsg);
  } catch { await sendReply(sock, jid, '❌ Erreur', m.rawMsg); }
}

async function sendShopMenu(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  const text = `🛒 *Boutique DJOUSSE TECH*\n\n` +
    `🎙️ Voix premium — 500 coins\n` +
    `🎨 Génération d'images — 100 coins/image\n` +
    `📊 Analyses avancées — 200 coins\n` +
    `🎨 Pack stickers — 300 coins\n` +
    `🤖 Bot personnel — 5000 coins\n\n` +
    `Acheter : \`.buy <article>\``;
  await sendReply(getSocket(), m.key.remoteJid, text, m.rawMsg);
}

async function sendPaymentMenu(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  const text = `💳 *Paiement CinetPay (Mobile Money)*\n\n` +
    `• Orange Money\n` +
    `• MTN Money\n` +
    `• Moov Money\n\n` +
    `Pour payer : \`.pay <montant> <article>\`\n` +
    `Exemple : \`.pay 1000 voix_premium\``;
  await sendReply(getSocket(), jid, text, m.rawMsg);
}

async function sendTransferHelp(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  await sendReply(sock, jid, '🔄 *Transfert de coins*\n\n`.pay @user <montant>`\nExemple : `.pay @Paul 500`', m.rawMsg);
}

// Search & Tools
async function sendSearchHelp(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  const text = `🔍 *Recherche intelligente*\n\n` +
    `• \`.search <terme>\` — Mémoire, messages, contacts\n` +
    `• \`.search @user\` — Infos sur un membre\n` +
    `• \`.search #tag\` — Messages avec ce tag\n` +
    `• \`.search "phrase exacte"\` — Recherche exacte`;
  await sendReply(sock, jid, text, m.rawMsg);
}

async function sendWeatherHelp(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  await sendReply(sock, jid, '🌤️ *Météo*\n\n`.weather <ville>`\nExemple : `.weather Douala`\n\nDonne : température, humidité, vent, prévisions 3j.', m.rawMsg);
}

async function sendPollHelp(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  await sendReply(sock, jid, '📊 *Sondage*\n\n`.poll "Question" | Option1, Option2, Option3`\nExemple : `.poll "Quel resto ?" | Pizza, Burger, Tacos`', m.rawMsg);
}

async function sendWebSearchHelp(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  const text = `🌐 *Recherche Web*\n\n` +
    `• \`.web <question>\` — Recherche temps réel\n` +
    `• \`.web "actualité tech"\` — News tech\n` +
    `• \`.web météo Paris\` — Météo via web\n\n` +
    `Utilise SerpAPI + Groq pour résumer.`;
  await sendReply(sock, jid, text, m.rawMsg);
}

// Preferences
async function toggleVoicePref(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  try {
    const { getPreferenceVocal, activerVocal } = await import('../../core/voice-persona.js');
    const current = await getPreferenceVocal(m.sender);
    await activerVocal(m.sender, !current);
    await sendReply(sock, jid, current ? '🔇 Réponses vocales désactivées' : '🔊 Réponses vocales activées', m.rawMsg);
  } catch { await sendReply(sock, jid, '❌ Erreur', m.rawMsg); }
}

async function sendLanguageMenu(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  const text = `🌍 *Langue*\n\n` +
    `Dis : \`.lang fr\` \`.lang en\` \`.lang es\`\n` +
    `Le bot détecte aussi ta langue automatiquement.`;
  await sendReply(sock, jid, text, m.rawMsg);
}

async function sendNotificationMenu(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  const text = `🔔 *Notifications*\n\n` +
    `• \`.notify on/off\` — Activer/désactiver\n` +
    `• \`.notify rdv\` — Rappels RDV\n` +
    `• \`.notify mentions\` — Quand on te mentionne\n` +
    `• \`.notify daily\` — Résumé quotidien`;
  await sendReply(sock, jid, text, m.rawMsg);
}

async function sendFullHelp(m) {
  const mod = await import('../../commands/help.js');
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const mockM = { ...m, sender: m.sender, key: m.key, isGroup: m.key.remoteJid?.endsWith('@g.us'), rawMsg: m };
  await mod.handler(getSocket(), mockM, { text: '', prefix: '.', reply: (t) => sendReply(sock, m.key.remoteJid, t, m.rawMsg), isOwner: false, isAdmin: false, isGroup: m.key.remoteJid?.endsWith('@g.us') });
}

// Admin
async function sendBanHelp(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  await sendReply(sock, jid, '🚫 *Ban*\n\n`.ban @user [raison]`\nExemple : `.ban @Paul Spam`', m.rawMsg);
}

async function sendMuteHelp(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  await sendReply(sock, jid, '🔇 *Mute*\n\n`.mute @user <durée>`\nExemple : `.mute @Paul 1h`\nDurées : 10m, 1h, 1d, 7d', m.rawMsg);
}

async function sendPromoteHelp(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  await sendReply(sock, jid, '⬆️ *Promouvoir admin*\n\n`.promote @user`', m.rawMsg);
}

async function sendWarnHelp(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  await sendReply(sock, jid, '⚠️ *Avertir*\n\n`.warn @user <raison>`\nExemple : `.warn @Paul Insultes`', m.rawMsg);
}

async function toggleAntiLink(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  try {
    const { Groups } = await import('../../infrastructure/database/database.js');
    const group = await Groups.get(jid);
    const newVal = group?.antilink ? 0 : 1;
    await Groups.upsert(jid, group?.name || '');
    await Groups.run(`UPDATE groups SET antilink = ? WHERE jid = ?`, [newVal, jid]);
    await sendReply(sock, jid, newVal ? '🔗 Anti-liens ACTIVÉ' : '🔗 Anti-liens DÉSACTIVÉ', m.rawMsg);
  } catch { await sendReply(sock, jid, '❌ Erreur', m.rawMsg); }
}

async function toggleAntiBot(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  try {
    const { Groups } = await import('../../infrastructure/database/database.js');
    const group = await Groups.get(jid);
    const newVal = group?.antibot ? 0 : 1;
    await Groups.run(`UPDATE groups SET antibot = ? WHERE jid = ?`, [newVal, jid]);
    await sendReply(sock, jid, newVal ? '🤖 Anti-bots ACTIVÉ' : '🤖 Anti-bots DÉSACTIVÉ', m.rawMsg);
  } catch { await sendReply(sock, jid, '❌ Erreur', m.rawMsg); }
}

async function runCleanup(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  await sendReply(sock, jid, '🧹 Nettoyage en cours... (suppression messages vieux, logs, temp)', m.rawMsg);
  // Implémenter nettoyage réel ici
}

async function toggleLock(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  try {
    const { Groups } = await import('../../infrastructure/database/database.js');
    const group = await Groups.get(jid);
    const newVal = group?.only_admin ? 0 : 1;
    await Groups.run(`UPDATE groups SET only_admin = ? WHERE jid = ?`, [newVal, jid]);
    await sendReply(sock, jid, newVal ? '🔒 Groupe VERROUILLÉ (admins only)' : '🔓 Groupe DÉVERROUILLÉ', m.rawMsg);
  } catch { await sendReply(sock, jid, '❌ Erreur', m.rawMsg); }
}

async function sendGroupReport(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  const { getGroupProfile } = await import('../../core/community-manager.js');
  const profile = await getGroupProfile(jid);
  if (!profile) { await sendReply(sock, jid, '❌ Pas de données', m.rawMsg); return; }
  const text = `📋 *Rapport Groupe*\n\n` +
    `📝 Messages (7j) : ${profile.messageCount || 0}\n` +
    `👥 Actifs (7j) : ${profile.activeMembers || 0}\n` +
    `😊 Sentiment : ${profile.sentiment || 'neutre'}\n` +
    `📊 Top contributeurs : ${(profile.topContributors || []).slice(0,3).map(c => `${c.name} (${c.count})`).join(', ')}\n` +
    `⚠️ Alertes : ${profile.alerts?.length || 0}`;
  await sendReply(sock, jid, text, m.rawMsg);
}

async function sendUserReport(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  await sendReply(sock, jid, '👤 *Rapport membre* — Réponds au message du membre avec `.menu admin:report:user`', m.rawMsg);
}

async function sendAuditLog(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  const { audit } = await import('../../conscious/governance/index.js');
  const entries = audit.getRecent(10);
  let text = `📋 *Audit récent (10)*\n\n`;
  entries.forEach(e => {
    text += `• ${new Date(e.timestamp).toLocaleString()} — ${e.action} par ${e.agent}\n`;
  });
  await sendReply(sock, jid, text, m.rawMsg);
}

// Owner
async function restartBot(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  await sendReply(sock, jid, '🔄 Redémarrage dans 3 secondes...', m.rawMsg);
  setTimeout(() => process.exit(0), 3000);
}

async function sendFullStatus(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  const uptime = process.uptime();
  const mem = process.memoryUsage();
  const text = `📊 *Statut Complet*\n\n` +
    `⏱️ Uptime : ${(uptime/3600).toFixed(1)}h\n` +
    `💾 RAM : ${(mem.heapUsed/1024/1024).toFixed(1)}MB / ${(mem.heapTotal/1024/1024).toFixed(1)}MB\n` +
    `🟢 Bot : ${global.sock?.user ? 'Connecté' : 'Déconnecté'}\n` +
    `📦 Node : ${process.version}\n` +
    `📦 Mémoire RSS : ${(mem.rss/1024/1024).toFixed(1)}MB`;
  await sendReply(sock, jid, text, m.rawMsg);
}

async function sendRecentLogs(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  const fs = await import('fs/promises');
  try {
    const logFile = './data/bot.log';
    const logs = (await fs.readFile(logFile, 'utf8')).split('\n').slice(-20).join('\n');
    await sendReply(sock, jid, `📋 *Logs récents (20 dernières lignes)*\n\n\`\`\`\n${logs}\n\`\`\``, m.rawMsg);
  } catch { await sendReply(sock, jid, '❌ Pas de logs', m.rawMsg); }
}

async function backupSession(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  try {
    const { getSessionManager } = await import('../../lib/session-manager.js');
    const sm = getSessionManager();
    await sm.createBackup(`manual_${Date.now()}`);
    await sendReply(sock, jid, '💾 Backup créé avec succès', m.rawMsg);
  } catch (e) { await sendReply(sock, jid, `❌ Erreur: ${e.message}`, m.rawMsg); }
}

async function sendDashboardLink(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3000}`;
  await sendReply(sock, jid, `🌐 *Dashboard*\n\n${url}/dashboard\n\nConnecte-toi avec ton token.`, m.rawMsg);
}

async function sendApiKeys(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  await sendReply(sock, jid, '🔑 *Clés API*\n\nGère tes clés via le dashboard web.\n\nVariables dispo :\n• GROQ_API_KEY\n• OPENAI_API_KEY\n• ELEVENLABS_API_KEY\n• CINETPAY_API_KEY\n• GOOGLE_CLIENT_ID/SECRET', m.rawMsg);
}

async function sendWebhookConfig(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  await sendReply(sock, jid, '🔗 *Webhooks*\n\nConfigure via dashboard ou variables d\'env :\n• WEBHOOK_URL\n• WEBHOOK_SECRET', m.rawMsg);
}

async function sendPaymentsReport(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  await sendReply(sock, jid, '💳 *Paiements CinetPay*\n\nÀ implémenter : liste des transactions récentes.', m.rawMsg);
}

async function sendPricingConfig(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  await sendReply(sock, jid, '💰 *Tarifs*\n\nÀ implémenter : config prix via menu.', m.rawMsg);
}

async function sendSubscriptions(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  await sendReply(sock, jid, '👥 *Abonnements*\n\nÀ implémenter : liste abonnés actifs.', m.rawMsg);
}

async function updateBot(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  await sendReply(sock, jid, '⬆️ *Mise à jour*\n\n`.git pull && npm install && pm2 restart all`\n\nÀ faire manuellement pour l\'instant.', m.rawMsg);
}

async function runSystemCleanup(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  await sendReply(sock, jid, '🧹 *Nettoyage système*\n\n• Logs > 30j\n• Fichiers temp\n• DB vacuum\n• Sessions expirées\n\nLancement...', m.rawMsg);
  // Implémenter nettoyage réel
}

async function toggleDebug(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  // Toggle debug level
  await sendReply(sock, jid, '🐛 Mode debug basculé (voir logs console)', m.rawMsg);
}

// Group
async function sendWelcomeConfig(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  await sendReply(sock, jid, '👋 *Message de bienvenue*\n\nDis : *"Le message de bienvenue est : Bienvenue @user !"*', m.rawMsg);
}

async function sendRulesConfig(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  await sendReply(sock, jid, '📜 *Règles du groupe*\n\nDis : *"Les règles sont : 1. Respect 2. Pas de spam 3. Français uniquement"*', m.rawMsg);
}

async function toggleAutoMod(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  try {
    const { Groups } = await import('../../infrastructure/database/database.js');
    const group = await Groups.get(jid);
    const newVal = group?.antilink ? 0 : 1;
    await Groups.run(`UPDATE groups SET antilink = ?, antibot = ?, antidelete = ? WHERE jid = ?`, [newVal, newVal, newVal, jid]);
    await sendReply(sock, jid, newVal ? '🤖 Auto-mod ACTIVÉE' : '🤖 Auto-mod DÉSACTIVÉE', m.rawMsg);
  } catch { await sendReply(sock, jid, '❌ Erreur', m.rawMsg); }
}

async function sendGroupTypeMenu(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  await sendReply(sock, jid, '🏷️ *Type de groupe*\n\nDis : *"Ce groupe est de type famille/travail/gaming/études"*', m.rawMsg);
}

async function sendAnnounceHelp(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  await sendReply(sock, jid, '📢 *Annonce*\n\nDis : *"Annonce à tous : Réunion demain 14h"*\n\nLe bot enverra à tous les membres.', m.rawMsg);
}

async function sendPollCreateHelp(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  await sendReply(sock, jid, '📊 *Sondage rapide*\n\n`.poll "Question" | Opt1, Opt2, Opt3`', m.rawMsg);
}

async function sendEventHelp(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  await sendReply(sock, jid, '📅 *Événement*\n\nDis : *"Crée un événement : Réunion équipe, demain 14h, bureau, 1h"*', m.rawMsg);
}

async function sendMembersList(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  try {
    const meta = await sock.groupMetadata(jid);
    let text = `👥 *Membres (${meta.participants.length})*\n\n`;
    meta.participants.forEach((p, i) => {
      const role = p.admin ? (p.admin === 'superadmin' ? '👑' : '👮') : '👤';
      text += `${i+1}. ${role} @${p.id.split('@')[0]}\n`;
    });
    await sendReply(sock, jid, text, m.rawMsg);
  } catch { await sendReply(sock, jid, '❌ Erreur', m.rawMsg); }
}

async function sendAdminsList(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  try {
    const meta = await sock.groupMetadata(jid);
    const admins = meta.participants.filter(p => p.admin);
    let text = `👑 *Admins (${admins.length})*\n\n`;
    admins.forEach((p, i) => {
      text += `${i+1}. @${p.id.split('@')[0]} (${p.admin})\n`;
    });
    await sendReply(sock, jid, text, m.rawMsg);
  } catch { await sendReply(sock, jid, '❌ Erreur', m.rawMsg); }
}

async function sendInactiveMembers(m) {
  const { getSocket } = await import('../../core/bot.js');
  const sock = getSocket();
  const jid = m.key.remoteJid;
  await sendReply(sock, jid, '😴 *Membres inactifs (30j+)*\n\nÀ implémenter : analyse activité.', m.rawMsg);
}

// Export handler map
const HANDLERS = {
  // Main
  'menu:groups:list': sendGroupsList,
  'menu:groups:create': createGroup,
  'menu:groups:settings': async (m) => { const { sendInteractiveMenu } = await import('./interactive-menu.js'); await sendInteractiveMenu(getSocket(), m.key.remoteJid, 'group'); },
  'menu:groups:stats': sendGroupStats,
  'menu:missions:list': sendMissionsList,
  'menu:missions:create': createMission,
  'menu:missions:templates': sendMissionTemplates,
  'menu:rdv': sendCalendarMenu,
  'menu:sticker': sendStickerHelp,
  'menu:image': sendImageGenHelp,
  'menu:voice': sendVoiceHelp,
  'menu:translate': sendTranslateHelp,
  'menu:balance': sendBalance,
  'menu:shop': sendShopMenu,
  'menu:pay': sendPaymentMenu,
  'menu:transfer': sendTransferHelp,
  'menu:search': sendSearchHelp,
  'menu:weather': sendWeatherHelp,
  'menu:poll': sendPollHelp,
  'menu:web': sendWebSearchHelp,
  'menu:prefs:voice': toggleVoicePref,
  'menu:prefs:lang': sendLanguageMenu,
  'menu:prefs:notify': sendNotificationMenu,
  'menu:help': sendFullHelp,
  // Channels
  'menu:channels:list': async (m) => { const { getSocket } = await import('../../core/bot.js'); const sock = getSocket(); const { getChannelManager } = await import('./channel-features.js'); const mgr = getChannelManager(sock); const channels = mgr.listChannels(true); if (!channels.length) return sendReply(sock, m.key.remoteJid, '📭 Aucune chaîne publique.'); let msg = '📢 *Chaînes publiques*\n\n'; channels.forEach((c, i) => { msg += `${i+1}. *${c.name}* 👥 ${c.members_count}\n🆔 \\\`${c.id}\\\`\n\n`; }); sendReply(sock, m.key.remoteJid, msg); },
  'menu:channels:mine': async (m) => { const { getSocket } = await import('../../core/bot.js'); const sock = getSocket(); const { getChannelManager } = await import('./channel-features.js'); const mgr = getChannelManager(sock); const channels = mgr.listUserChannels(m.sender); if (!channels.length) return sendReply(sock, m.key.remoteJid, '📭 Aucun abonnement.'); let msg = '📋 *Mes chaînes*\n\n'; channels.forEach((c, i) => { msg += `${i+1}. *${c.name}* 🆔 \\\`${c.id}\\\`\n`; }); sendReply(sock, m.key.remoteJid, msg); },
  'menu:channels:create': async (m) => { sendReply(getSocket(), m.key.remoteJid, 'Utilise `.channel create <nom>` pour créer une chaîne.'); },
  'menu:disappear': async (m) => { const { getDisappearing } = await import('./disappearing-messages.js'); const current = getDisappearing(m.key.remoteJid); sendReply(getSocket(), m.key.remoteJid, current === 'off' ? '⏳ Messages qui disparaissent: *Désactivé*\n\nUtilise `.disappear 24h` pour activer.' : `⏳ Messages qui disparaissent: *${current}*`); },
  // Business
  'menu:biz:profile': async (m) => { const { getBusinessProfile } = await import('./business-profile.js'); const p = getBusinessProfile(m.sender); if (!p) return sendReply(getSocket(), m.key.remoteJid, '💼 Aucun profil. Créez-en un avec `.biz set nom | description | catégorie`'); sendReply(getSocket(), m.key.remoteJid, `💼 *${p.name}*\n📝 ${p.description || 'N/A'}\n📂 ${p.category || 'N/A'}`); },
  'menu:biz:directory': async (m) => { sendReply(getSocket(), m.key.remoteJid, '📇 Utilise `.dir search <mot>` ou `.dir categories` pour explorer l\'annuaire.'); },
  'menu:biz:register': async (m) => { sendReply(getSocket(), m.key.remoteJid, '📝 Inscris ton entreprise : `.dir register nom | catégorie | description`'); },
  'menu:catalogue': async (m) => { sendReply(getSocket(), m.key.remoteJid, '📦 Utilise `.catalogue` pour voir les produits ou `.catalogue <mot>` pour chercher.'); },
  // Labels & Auto-reply
  'menu:labels:list': async (m) => { const { getLabels } = await import('./labels.js'); const labels = getLabels(m.key.remoteJid); if (!labels.length) return sendReply(getSocket(), m.key.remoteJid, '🏷️ Aucune étiquette. Ajoutez-en avec `.label add <nom>`'); sendReply(getSocket(), m.key.remoteJid, `🏷️ *Étiquettes*\n${labels.map(l => `• ${l.label}`).join('\n')}`); },
  'menu:autoreply:list': async (m) => { const { listKeywords } = await import('./auto-reply.js'); const list = listKeywords(m.key.remoteJid?.endsWith('@g.us') ? m.key.remoteJid : null); if (!list.length) return sendReply(getSocket(), m.key.remoteJid, '📭 Aucune réponse auto.'); sendReply(getSocket(), m.key.remoteJid, `🤖 *Réponses auto*\n${list.slice(0,10).map((item, i) => `${i+1}. "${item.keyword}"`).join('\n')}`); },
  'menu:autoreply:add': async (m) => { sendReply(getSocket(), m.key.remoteJid, '➕ Ajoute une réponse : `.autoreply add mot-clé | réponse`'); },
  'menu:welcome': async (m) => { const { getWelcomeTemplate } = await import('./private-welcome.js'); const t = getWelcomeTemplate(); sendReply(getSocket(), m.key.remoteJid, `👋 *Message d\\'accueil*\n\n${t.template}\n\nModifie-le avec \`.welcome set <message>\``); },
  // Call
  'menu:call:voice': async (m) => { const { generateCallLink } = await import('./call-links.js'); const r = generateCallLink(m.sender, 'voice'); sendReply(getSocket(), m.key.remoteJid, r.message); },
  'menu:call:video': async (m) => { const { generateCallLink } = await import('./call-links.js'); const r = generateCallLink(m.sender, 'video'); sendReply(getSocket(), m.key.remoteJid, r.message); },
  'menu:call:me': async (m) => { const { generateCallLink } = await import('./call-links.js'); const r = generateCallLink(m.sender, 'voice'); sendReply(getSocket(), m.key.remoteJid, r.message); },
  // Security
  'menu:security:guide': async (m) => { const { getSecurityMenu } = await import('./security-guide.js'); sendReply(getSocket(), m.key.remoteJid, getSecurityMenu()); },
  'menu:security:2fa': async (m) => { sendReply(getSocket(), m.key.remoteJid, `🔐 *Double vérification (2FA)*\n\n👉 \`whatsapp://settings/security/two-step-verification\`\n\nCopie le lien et colle-le dans WhatsApp.`); },
  'menu:security:code': async (m) => { sendReply(getSocket(), m.key.remoteJid, `🔑 *Code de sécurité*\n\n👉 \`whatsapp://settings/security\`\n\nCopie le lien et colle-le dans WhatsApp.`); },
  'menu:security:privacy': async (m) => { sendReply(getSocket(), m.key.remoteJid, `👁️ *Confidentialité*\n\n👉 \`whatsapp://settings/privacy\`\n\nCopie le lien et colle-le dans WhatsApp.`); },
  // Admin
  'admin:ban': sendBanHelp,
  'admin:mute': sendMuteHelp,
  'admin:promote': sendPromoteHelp,
  'admin:warn': sendWarnHelp,
  'admin:antilink': toggleAntiLink,
  'admin:antibot': toggleAntiBot,
  'admin:cleanup': runCleanup,
  'admin:lock': toggleLock,
  'admin:report:group': sendGroupReport,
  'admin:report:user': sendUserReport,
  'admin:audit': sendAuditLog,
  // Owner
  'owner:restart': restartBot,
  'owner:status': sendFullStatus,
  'owner:logs': sendRecentLogs,
  'owner:backup': backupSession,
  'owner:dashboard': sendDashboardLink,
  'owner:api:keys': sendApiKeys,
  'owner:webhook': sendWebhookConfig,
  'owner:payments': sendPaymentsReport,
  'owner:pricing': sendPricingConfig,
  'owner:subs': sendSubscriptions,
  'owner:update': updateBot,
  'owner:cleanup': runSystemCleanup,
  'owner:debug': toggleDebug,
  // Group
  'group:welcome': sendWelcomeConfig,
  'group:rules': sendRulesConfig,
  'group:auto': toggleAutoMod,
  'group:type': sendGroupTypeMenu,
  'group:announce': sendAnnounceHelp,
  'group:poll': sendPollCreateHelp,
  'group:event': sendEventHelp,
  'group:list': sendMembersList,
  'group:admins': sendAdminsList,
  'group:inactive': sendInactiveMembers,
};

export async function handleListResponse(sock, m, rowId) {
  const handler = HANDLERS[rowId];
  if (handler) {
    try {
      await handler(m);
      return true;
    } catch (e) {
      log.error(`Handler ${rowId}: ${e.message}`);
    }
  }
  return false;
}

export async function handleButtonsResponse(sock, m, buttonId) {
  log.info(`Réponse bouton: ${buttonId}`);
  return false;
}

export function getMenuDefinition(menuKey) {
  return MENU_DEFINITIONS[menuKey];
}

export function isOwnerMenu(menuKey) {
  return menuKey === 'owner';
}

export function isAdminMenu(menuKey) {
  return menuKey === 'admin';
}

export function isGroupMenu(menuKey) {
  return menuKey === 'group';
}