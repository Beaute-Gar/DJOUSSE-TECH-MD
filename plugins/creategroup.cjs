const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');
const { isLidUser } = require('@whiskeysockets/baileys');

/*
 * DJOUSSE TECH — CREATEGROUP v2
 *
 * 1. Analyse les groupes, extrait les membres uniques
 * 2. Résout les LID → PN via le cache global.__lidToPn
 * 3. Crée le groupe immédiatement
 * 4. Ajoute les membres résolus en arrière-plan
 *
 * WhatsApp limite un groupe à 1024 membres.
 * Les membres en format @lid sans résolution sont exclus.
 */

const MAX_GROUP_MEMBERS = 1024;
const MAX_MEMBERS_TO_ADD = MAX_GROUP_MEMBERS - 1;
const ADD_DELAY_MS = 3000;
const PROGRESS_EVERY = 25;
const runningJobs = new Map();

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeJid(jid) {
  if (!jid) return '';
  return String(jid).trim().toLowerCase();
}

function toPnJid(num) {
  if (!num) return '';
  const s = String(num);
  return s.includes('@') ? s : s + '@s.whatsapp.net';
}

function cleanPn(v) {
  if (!v) return null;
  return String(v).replace(/@s\.whatsapp\.net$/, '').split(':')[0] || null;
}

function getOwnJids(conn) {
  const result = new Set();
  try {
    if (conn?.user?.id) {
      result.add(normalizeJid(conn.user.id));
      const base = String(conn.user.id).split(':')[0];
      if (base) result.add(normalizeJid(base + '@s.whatsapp.net'));
    }
    if (conn?.user?.lid) result.add(normalizeJid(conn.user.lid));
    if (conn?.user?.jid) result.add(normalizeJid(conn.user.jid));
  } catch (_) {}
  return result;
}

function isOwnParticipant(participantId, ownJids) {
  const jid = normalizeJid(participantId);
  if (!jid) return true;
  if (ownJids.has(jid)) return true;
  if (jid.endsWith('@s.whatsapp.net')) {
    const number = jid.replace('@s.whatsapp.net', '').split(':')[0];
    for (const own of ownJids) {
      if (!own.endsWith('@s.whatsapp.net')) continue;
      const ownNumber = own.replace('@s.whatsapp.net', '').split(':')[0];
      if (number && ownNumber && number === ownNumber) return true;
    }
  }
  return false;
}

/**
 * Résout un JID member en PN JID utilisable pour groupParticipantsUpdate.
 * Utilise le cache global.__lidToPn construit par les messages reçus.
 * Retourne null si le membre ne peut pas être résolu.
 */
function resolveMemberJid(memberJid, ownJids) {
  const normalized = normalizeJid(memberJid);
  if (!normalized) return null;

  // Déjà un @s.whatsapp.net → directement utilisable
  if (normalized.endsWith('@s.whatsapp.net')) {
    // Vérifier que ce n'est pas le bot lui-même
    if (isOwnParticipant(normalized, ownJids)) return null;
    return normalized;
  }

  // @lid → essayer de résoudre via le cache
  if (isLidUser && isLidUser(normalized)) {
    const lidMap = global.__lidToPn || new Map();
    const pn = lidMap.get(normalized);
    if (pn) {
      const resolved = toPnJid(pn);
      if (isOwnParticipant(resolved, ownJids)) return null;
      return resolved;
    }
    // Pas de résolution disponible
    return null;
  }

  // @g.us ou autre → ignorer
  return null;
}

function getErrorMessage(error) {
  if (!error) return 'Erreur inconnue';
  return error?.message || error?.data?.message || error?.output?.payload?.message || String(error);
}

function isRateLimitError(error) {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('rate') ||
    message.includes('too many') ||
    message.includes('limit') ||
    message.includes('throttl') ||
    message.includes('temporar') ||
    message.includes('try again later') ||
    message.includes('wait') ||
    message.includes('forbidden') ||
    message.includes('not-authorized') ||
    message.includes('not authorized')
  );
}

async function processGroupCreation({ conn, chatJid, groupJid, groupName, members, reply }) {
  const jobKey = groupJid;
  let successCount = 0;
  let failCount = 0;
  let alreadyMemberCount = 0;

  try {
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👥 [CREATEGROUP] AJOUT EN ARRIÈRE-PLAN');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Groupe :', groupJid);
    console.log('Nom    :', groupName);
    console.log('Cible  :', members.length);
    console.log('Délai  :', ADD_DELAY_MS + ' ms');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    for (let index = 0; index < members.length; index++) {
      const memberJid = members[index];

      try {
        const result = await conn.groupParticipantsUpdate(groupJid, [memberJid], 'add');
        const item = Array.isArray(result) ? result[0] : null;
        const status = item?.status != null ? String(item.status) : '';
        const normalizedStatus = status.toLowerCase();

        if (normalizedStatus === '200' || normalizedStatus === 'success' || normalizedStatus === 'ok' || normalizedStatus === '') {
          successCount++;
          console.log('[CREATEGROUP] ✅ ' + successCount + '/' + members.length + ' ajouté : ' + memberJid);
        } else if (normalizedStatus.includes('409') || normalizedStatus.includes('already')) {
          alreadyMemberCount++;
          console.log('[CREATEGROUP] ↪️ Déjà membre : ' + memberJid);
        } else {
          failCount++;
          console.log('[CREATEGROUP] ⚠️ Refusé : ' + memberJid + ' (' + status + ')');
        }
      } catch (error) {
        failCount++;
        console.error('[CREATEGROUP] ❌ Échec ' + memberJid + ': ' + getErrorMessage(error));

        if (isRateLimitError(error)) {
          console.warn('[CREATEGROUP] 🛑 Limitation WhatsApp détectée. Arrêt.');
          try {
            await reply(
              '⚠️ *Ajout interrompu*\n\n' +
              'WhatsApp limite les ajouts.\n\n' +
              '✅ Ajoutés : ' + successCount + '\n' +
              '⚠️ Échecs : ' + failCount + '\n' +
              '👥 Déjà présents : ' + alreadyMemberCount
            );
          } catch (_) {}
          break;
        }
      }

      const processed = successCount + failCount + alreadyMemberCount;
      if (processed > 0 && (processed % PROGRESS_EVERY === 0 || processed === members.length)) {
        try {
          await reply(
            '👥 *Progression*\n\n' +
            '📊 Traités : ' + processed + '/' + members.length + '\n' +
            '✅ Ajoutés : ' + successCount + '\n' +
            '↪️ Déjà présents : ' + alreadyMemberCount + '\n' +
            '❌ Échecs : ' + failCount
          );
        } catch (_) {}
      }

      if (index < members.length - 1) await sleep(ADD_DELAY_MS);
    }

    const inviteCode = await conn.groupInviteCode(groupJid).catch(() => null);
    const link = inviteCode ? 'https://chat.whatsapp.com/' + inviteCode : '(lien indisponible)';

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🏁 [CREATEGROUP] TERMINÉ');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Ajoutés :', successCount);
    console.log('Déjà présents :', alreadyMemberCount);
    console.log('Échecs :', failCount);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    await reply(
      box('👥 *GROUPE CRÉÉ*', [
        { label: 'Nom', value: groupName },
        { label: 'ID', value: groupJid },
        { blank: true },
        { label: 'Cible', value: String(members.length) },
        { label: 'Ajoutés', value: String(successCount) },
        { label: 'Déjà présents', value: String(alreadyMemberCount) },
        { label: 'Échecs', value: String(failCount) },
        { blank: true },
        { raw: '🔗 ' + link },
      ])
    );
  } catch (error) {
    console.error('[CREATEGROUP] Erreur:', getErrorMessage(error));
    try {
      await reply('⚠️ *Ajout interrompu*\n\n✅ Ajoutés : ' + successCount + '\n❌ Échecs : ' + failCount);
    } catch (_) {}
  } finally {
    runningJobs.delete(jobKey);
  }
}

cmd({
  pattern: 'creategroup',
  react: '👥',
  desc: 'Créer un groupe avec les membres uniques résolus',
  category: 'group',
  filename: __filename,
  fromMe: true,
}, async (conn, m, commands, { q, reply }) => {
  try {
    const groupName = (q || '').trim() || 'DJOUSSE TECH GROUP';
    const accountId = conn?.user?.id || 'default-account';

    if (runningJobs.has(accountId)) {
      return reply('⏳ *Une création est déjà en cours.*');
    }

    runningJobs.set(accountId, { startedAt: Date.now() });
    await reply('🔍 *Analyse de tes groupes WhatsApp...*');

    const chats = await conn.groupFetchAllParticipating();
    const groupJids = Object.keys(chats || {});

    if (groupJids.length === 0) {
      runningJobs.delete(accountId);
      return reply('❌ Aucun groupe trouvé.');
    }

    await reply('📊 *' + groupJids.length + ' groupes trouvés.*\nExtraction des membres...');

    const ownJids = getOwnJids(conn);
    const lidMap = global.__lidToPn || new Map();
    console.log('[CREATEGROUP] Cache LID→PN:', lidMap.size, 'entrées');
    console.log('[CREATEGROUP] JID(s) du compte:', Array.from(ownJids).join(', '));

    // Collecte brute de tous les JID membres
    const rawMembersSet = new Set();
    for (const jid of groupJids) {
      const groupMeta = chats[jid];
      if (!groupMeta || !Array.isArray(groupMeta.participants)) continue;
      for (const participant of groupMeta.participants) {
        if (!participant?.id) continue;
        rawMembersSet.add(normalizeJid(participant.id));
      }
    }

    const rawCount = rawMembersSet.size;

    // Résolution LID → PN
    const resolvedMembers = new Set();
    let lidSkipped = 0;
    let ownSkipped = 0;

    for (const rawJid of rawMembersSet) {
      const resolved = resolveMemberJid(rawJid, ownJids);
      if (!resolved) {
        if (isLidUser && isLidUser(rawJid)) lidSkipped++;
        else ownSkipped++;
        continue;
      }
      resolvedMembers.add(resolved);
    }

    const allResolved = Array.from(resolvedMembers);

    if (allResolved.length === 0) {
      runningJobs.delete(accountId);
      return reply(
        '❌ Aucun membre résolvable.\n\n' +
        '🔍 Bruts récupérés : ' + rawCount + '\n' +
        '🔒 @lid sans résolution : ' + lidSkipped + '\n' +
        '👤 Propres JID exclus : ' + ownSkipped + '\n\n' +
        '💡 Les @lid ne peuvent être résolus que si la personne a déjà envoyé un message au bot.'
      );
    }

    const membersToAdd = allResolved.slice(0, MAX_MEMBERS_TO_ADD);
    const omittedCount = Math.max(0, allResolved.length - membersToAdd.length);

    let msg = '👥 *' + rawCount + ' membres bruts récupérés*\n\n';
    msg += '📱 Résolus (PN) : *' + allResolved.length + '*\n';
    if (lidSkipped > 0) msg += '🔒 @lid non résolus : ' + lidSkipped + '\n';
    if (ownSkipped > 0) msg += '👤 JID propres exclus : ' + ownSkipped + '\n';
    msg += '\n🎯 Sélection : *' + membersToAdd.length + '*';
    if (omittedCount > 0) msg += '\n⚠️ ' + omittedCount + ' exclus (limite 1 024)';
    msg += '\n\nCréation du groupe...';
    await reply(msg);

    const createResponse = await conn.groupCreate(groupName, []);
    const newGroupJid = createResponse?.id || createResponse?.gid;

    if (!newGroupJid) {
      runningJobs.delete(accountId);
      throw new Error('WhatsApp n\'a pas retourné l\'ID du groupe.');
    }

    await reply(
      '✅ *Groupe créé !*\n\n' +
      '🆔 ' + newGroupJid + '\n' +
      '👥 Membres : ' + membersToAdd.length + '\n' +
      '🚀 Ajout en arrière-plan.\n\n' +
      '⏱️ Délai : ' + (ADD_DELAY_MS / 1000) + ' s'
    );

    runningJobs.delete(accountId);
    runningJobs.set(newGroupJid, { startedAt: Date.now() });

    processGroupCreation({
      conn,
      chatJid: m.chat,
      groupJid: newGroupJid,
      groupName,
      members: membersToAdd,
      reply,
    }).catch(error => {
      console.error('[CREATEGROUP] Job non géré:', getErrorMessage(error));
      runningJobs.delete(newGroupJid);
    });

    return;
  } catch (error) {
    console.error('❌ creategroup:', getErrorMessage(error));
    return reply('❌ *Erreur :* ' + getErrorMessage(error));
  }
});
