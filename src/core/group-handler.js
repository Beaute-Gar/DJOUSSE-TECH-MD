import { createRequire } from 'module';
import { createLogger } from './logger.js';
import { Groups } from '../lib/database.js';
import { detectGroupProfile } from '../modules/groups/group-profiles.js';
import { executor, ACTION_TYPES } from '../cognitive/action-executor.js';

const require = createRequire(import.meta.url);
const config  = require('../../config.cjs');
const log     = createLogger('GROUP-HANDLER');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function ordinal(n) {
  if (n === 1) return '1er';
  if (n === 2) return '2ème';
  if (n === 3) return '3ème';
  if ([11,12,13].includes(n)) return `${n}ème`;
  if (n % 100 === 21) return `21ème`;
  if (n % 100 === 31) return `31ème`;
  if (n % 100 === 41) return `41ème`;
  if (n % 100 === 51) return `51ème`;
  if (n % 100 === 61) return `61ème`;
  if (n % 100 === 71) return `71ème`;
  if (n % 100 === 81) return `81ème`;
  if (n % 100 === 91) return `91ème`;
  return `${n}ème`;
}

function jidToPhone(jid = '') {
  return '+' + jid.replace('@s.whatsapp.net', '').replace('@g.us', '');
}

function getGroupRules(profileType, groupName) {
  const common = '\n\n📜 *RÈGLES DU GROUPE*\n';
  const rules = {
    scolaire: common +
`1️⃣ Respecter les enseignants et camarades
2️⃣ Pas de contenu hors sujet scolaire
3️⃣ Langue : Français uniquement
4️⃣ Pas de partage de liens externes
5️⃣ Pas de publicité ni spam
6️⃣ Les devoirs se partagent entre amis 📚`,
    classe_scientifique: common +
`1️⃣ Entraide et bienveillance entre camarades
2️⃣ Partage de cours, exercices et corrigés encouragé ✅
3️⃣ Pas de triche lors des évaluations officielles
4️⃣ Langue : Français (anglais scientifique toléré)
5️⃣ Pas de contenu irrespectueux ou hors programme
6️⃣ Signale les problèmes aux admins 🎓`,
    loisirs_vacances: common +
`1️⃣ Bonne humeur obligatoire 😇
2️⃣ Respect de tous les membres
3️⃣ Pas de débats polémiques ou politiques
4️⃣ Contenu fun, activités, jeux uniquement
5️⃣ Pas de spam ni de pub
6️⃣ Profite et fais profiter ! 🏖️`,
    lifestyle_communaute: common +
`1️⃣ Partage, respect et bienveillance
2️⃣ Discussions ouvertes mais civilisées
3️⃣ Pas d'insultes ni d'attaques personnelles
4️⃣ Pas de contenus choquants
5️⃣ Les aventures ça se partage positivement 🔥
6️⃣ Admins = dernier mot en cas de désaccord`,
    gaming_roblox: common +
`1️⃣ Parler Roblox, gaming et jeux vidéo ici
2️⃣ Pas d'arnaque, no scam, no trade forcé
3️⃣ Respecter tous les niveaux (noob ou pro)
4️⃣ Partage de codes promo = toléré ✅
5️⃣ Pas de liens suspects (anti-virus requis)
6️⃣ GG à tout le monde et fair play 🎮`,
    anime_manga_culture: common +
`1️⃣ Otakus, weebs et fans bienvenus 🎌
2️⃣ Marquer *[SPOILER]* avant tout spoiler
3️⃣ Respect des goûts de chacun (pas de haine)
4️⃣ Pas de contenu 18+ / hentai
5️⃣ Liens de streaming légaux uniquement
6️⃣ Débats animés = passion = autorisé 👑`,
    famille_amis: common +
`1️⃣ Respect et bienveillance avant tout
2️⃣ Pas de politique ni de religion
3️⃣ Contenu positif uniquement
4️⃣ Pas de spam ni de pub
5️⃣ Confidentialité : ce qui se dit ici reste ici 🤝`,
  };
  return rules[profileType] || rules.famille_amis;
}

async function sendBotWelcome(sock, groupJid, meta) {
  await sleep(1500);
  const adminCount  = meta.participants?.filter(p => p.admin).length ?? 0;
  const memberCount = meta.participants?.length ?? 0;
  const now         = new Date().toLocaleString('fr-FR', {
    timeZone: 'Africa/Douala', dateStyle: 'full', timeStyle: 'short',
  });
  const botSiteUrl = process.env.BOT_SITE_URL || 'https://djoussetech.com';
  const msg =
`☘️ *WELCOME* ☘️
┌──────────────────────
│ 🏠 *GROUP* : ${meta.subject}
│ 🤖 *BOT* : ${config.BOT_NAME}
│ 👥 *ADMINS* : ${adminCount} admin(s)
│ 👨‍👩‍👧 *MEMBERS* : ${memberCount} membres
│ 📅 *DATE* : ${now}
│ 🏢 *SOCIÉTÉ* : ${config.COMPANY_NAME}
└─ 🔗 *BOT LINK* : ${botSiteUrl}

_Je suis maintenant votre assistant de groupe intelligent. Je m'adapte automatiquement à l'identité de ce groupe pour vous offrir une animation personnalisée et une gestion proactive._

✅ *Capacités activées :*
› Animation automatique adaptée au groupe
› Réponses intelligentes aux messages
› Gestion des membres (bienvenue/au revoir)
› Modération assistée si nécessaire
› Publications de contenu thématique

_Ravi de vous rejoindre !_ 🙌`;
  try {
    await executor.execute({ type: ACTION_TYPES.SEND_MESSAGE, payload: { jid: groupJid, text: msg }, source: 'group-handler:bot-welcome' });
    log.info(`Message de bienvenue bot envoyé dans : ${meta.subject}`);
  } catch (e) {
    log.error(`sendBotWelcome: ${e.message}`);
  }
}

async function sendMemberWelcome(sock, groupJid, memberJid, meta) {
  await sleep(2000);
  const memberCount  = meta.participants?.length ?? 0;
  const adminCount   = meta.participants?.filter(p => p.admin).length ?? 0;
  const memberOrdinal = ordinal(memberCount);
  const phone        = jidToPhone(memberJid);
  const profile      = detectGroupProfile(meta.subject);
  const rules        = getGroupRules(profile?.identity?.type || 'famille_amis', meta.subject);
  const now          = new Date().toLocaleDateString('fr-FR', {
    timeZone: 'Africa/Douala', dateStyle: 'long',
  });

  let ppBuffer = null;
  try {
    const ppUrl = await sock.profilePictureUrl(memberJid, 'image');
    if (ppUrl) {
      const https = await import('https');
      const lib   = ppUrl.startsWith('https') ? https.default : (await import('http')).default;
      ppBuffer = await new Promise((res, rej) => {
        lib.get(ppUrl, r => {
          const chunks = [];
          r.on('data', c => chunks.push(c));
          r.on('end', () => res(Buffer.concat(chunks)));
          r.on('error', rej);
        }).setTimeout(8000, function() { this.destroy(); rej(new Error('TIMEOUT')); });
      });
    }
  } catch { ppBuffer = null; }

  const welcomeMsg =
`🎉 *BIENVENUE DANS ${meta.subject.toUpperCase()}* 🎉
┌──────────────────────
│ 👤 *MEMBRE* : @${memberJid.split('@')[0]}
│ 📱 *NUMÉRO* : ${phone}
│ 🏠 *GROUPE* : ${meta.subject}
│ 🎖️ *RANG* : *${memberOrdinal} membre*
│ 👥 *TOTAL MEMBRES* : ${memberCount}
│ 👑 *ADMINS* : ${adminCount}
│ 📅 *DATE D'ENTRÉE* : ${now}
└──────────────────────

${profile?.identity?.emoji || '🎉'} *Bienvenue parmi nous !*
_Tu rejoins une communauté de ${memberCount} membres. Présente-toi et plonge dans l'ambiance !_
${rules}`;

  try {
    if (ppBuffer && ppBuffer.length > 1000) {
      await executor.execute({ type: ACTION_TYPES.SEND_IMAGE, payload: { jid: groupJid, buffer: ppBuffer, caption: welcomeMsg, options: { mentions: [memberJid] } }, source: 'group-handler:member-welcome-img' });
    } else {
      await executor.execute({ type: ACTION_TYPES.SEND_MESSAGE, payload: { jid: groupJid, text: welcomeMsg, options: { mentions: [memberJid] } }, source: 'group-handler:member-welcome' });
    }
    log.info(`Welcome membre : ${phone} → ${meta.subject} (${memberOrdinal} membre)`);
  } catch (e) {
    log.error(`sendMemberWelcome: ${e.message}`);
  }
}

async function sendMemberGoodbye(sock, groupJid, memberJid, meta) {
  const grpData = Groups.get(groupJid);
  if (!grpData?.welcome) return;
  await sleep(1000);
  const phone = jidToPhone(memberJid);
  const msg =
`👋 *AU REVOIR !*
┌──────────────────────
│ 👤 @${memberJid.split('@')[0]}
│ 📱 ${phone}
└──────────────────────
_a quitté *${meta.subject}*. On te souhaite bonne route ! 🙏_`;
  try {
    await executor.execute({ type: ACTION_TYPES.SEND_MESSAGE, payload: { jid: groupJid, text: msg, options: { mentions: [memberJid] } }, source: 'group-handler:member-goodbye' });
  } catch (e) {
    log.error(`sendMemberGoodbye: ${e.message}`);
  }
}

export async function handleGroupEvent(sock, update) {
  const { id: groupJid, participants, action } = update;
  let meta;
  try {
    meta = await sock.groupMetadata(groupJid);
  } catch (e) {
    log.warn(`groupMetadata impossible pour ${groupJid}: ${e.message}`);
    return;
  }
  try { Groups.upsert(groupJid, meta.subject); } catch {}

  const botJid = sock.user?.id?.replace(/:.*@/, '@') ?? '';

  for (const participantJid of participants) {
    const normalizedParticipant = participantJid.replace(/:.*@/, '@');
    const isBotItself = normalizedParticipant === botJid;

    switch (action) {
      case 'add': {
        if (isBotItself) {
          await sendBotWelcome(sock, groupJid, meta);
        } else {
          await sendMemberWelcome(sock, groupJid, participantJid, meta);
        }
        break;
      }
      case 'remove':
      case 'leave': {
        if (!isBotItself) await sendMemberGoodbye(sock, groupJid, participantJid, meta);
        break;
      }
      case 'promote': {
        if (!isBotItself) {
          await sleep(1000);
          try {
            await executor.execute({ type: ACTION_TYPES.SEND_MESSAGE, payload: { jid: groupJid, text: `🎖️ Félicitations @${participantJid.split('@')[0]} ! Tu viens d'être promu *Admin* de *${meta.subject}*. Utilise ce pouvoir avec sagesse. 👑`, options: { mentions: [participantJid] } }, source: 'group-handler:promote' });
          } catch {}
        }
        break;
      }
      case 'demote': {
        if (!isBotItself) {
          await sleep(1000);
          try {
            await executor.execute({ type: ACTION_TYPES.SEND_MESSAGE, payload: { jid: groupJid, text: `ℹ️ @${participantJid.split('@')[0]} n'est plus admin de *${meta.subject}*.`, options: { mentions: [participantJid] } }, source: 'group-handler:demote' });
          } catch {}
        }
        break;
      }
    }
  }
}
