const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');

/*
 * DJOUSSE TECH — CREATEGROUP
 *
 * 1. Analyse les groupes auxquels le compte participe.
 * 2. Récupère les membres uniques.
 * 3. Crée immédiatement le nouveau groupe.
 * 4. Lance l'ajout des membres en arrière-plan.
 *
 * WhatsApp limite un groupe à 1024 membres.
 * Le compte créateur occupe déjà une place → max 1023 ajouts.
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
  const failedMembers = [];

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
          failedMembers.push({ jid: memberJid, error: 'Statut WhatsApp : ' + status });
          console.log('[CREATEGROUP] ⚠️ Refusé : ' + memberJid + ' (' + status + ')');
        }
      } catch (error) {
        failCount++;
        const errorMessage = getErrorMessage(error);
        failedMembers.push({ jid: memberJid, error: errorMessage });
        console.error('[CREATEGROUP] ❌ Échec ' + memberJid + ': ' + errorMessage);

        if (isRateLimitError(error)) {
          console.warn('[CREATEGROUP] 🛑 Limitation WhatsApp détectée. Arrêt du processus.');
          try {
            await reply(
              '⚠️ *Ajout interrompu temporairement*\n\n' +
              'WhatsApp limite les ajouts de membres.\n\n' +
              '✅ Ajoutés : ' + successCount + '\n' +
              '⚠️ Échecs : ' + failCount + '\n' +
              '👥 Déjà présents : ' + alreadyMemberCount + '\n\n' +
              'Le groupe reste disponible.'
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
        } catch (error) {
          console.warn('[CREATEGROUP] Impossible d\'envoyer la progression:', getErrorMessage(error));
        }
      }

      if (index < members.length - 1) await sleep(ADD_DELAY_MS);
    }

    const inviteCode = await conn.groupInviteCode(groupJid).catch(() => null);
    const link = inviteCode ? 'https://chat.whatsapp.com/' + inviteCode : '(lien indisponible)';
    const processed = successCount + failCount + alreadyMemberCount;

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🏁 [CREATEGROUP] TERMINÉ');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Groupe :', groupJid);
    console.log('Traités :', processed);
    console.log('Ajoutés :', successCount);
    console.log('Déjà présents :', alreadyMemberCount);
    console.log('Échecs :', failCount);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    await reply(
      box('👥 *GROUPE CRÉÉ*', [
        { label: 'Nom', value: groupName },
        { label: 'ID', value: groupJid },
        { blank: true },
        { label: 'Cible sélectionnée', value: String(members.length) },
        { label: 'Ajoutés', value: String(successCount) },
        { label: 'Déjà présents', value: String(alreadyMemberCount) },
        { label: 'Échecs', value: String(failCount) },
        { blank: true },
        { raw: members.length < MAX_MEMBERS_TO_ADD ? 'ℹ️ Tous les membres traités.' : 'ℹ️ Limite atteinte : 1 024 membres max.' },
        { blank: true },
        { raw: '🔗 ' + link },
      ])
    );
  } catch (error) {
    console.error('[CREATEGROUP] Erreur arrière-plan:', getErrorMessage(error));
    try {
      await reply(
        '⚠️ *Ajout interrompu*\n\n' +
        'Le groupe a été créé mais l\'ajout s\'est arrêté.\n\n' +
        '✅ Ajoutés : ' + successCount + '\n' +
        '❌ Échecs : ' + failCount
      );
    } catch (_) {}
  } finally {
    runningJobs.delete(jobKey);
  }
}

cmd({
  pattern: 'creategroup',
  react: '👥',
  desc: 'Créer un groupe avec les membres uniques des groupes disponibles',
  category: 'group',
  filename: __filename,
  fromMe: true,
}, async (conn, m, commands, { q, reply }) => {
  try {
    const groupName = (q || '').trim() || 'DJOUSSE TECH GROUP';
    const accountId = conn?.user?.id || 'default-account';

    if (runningJobs.has(accountId)) {
      return reply('⏳ *Une création est déjà en cours.*\n\nAttends la fin de l\'opération actuelle.');
    }

    runningJobs.set(accountId, { startedAt: Date.now() });
    await reply('🔍 *Analyse de tes groupes WhatsApp...*');

    const chats = await conn.groupFetchAllParticipating();
    const groupJids = Object.keys(chats || {});

    if (groupJids.length === 0) {
      runningJobs.delete(accountId);
      return reply('❌ Aucun groupe trouvé.');
    }

    await reply('📊 *' + groupJids.length + ' groupes trouvés.*\nExtraction des membres uniques...');

    const ownJids = getOwnJids(conn);
    console.log('[CREATEGROUP] JID(s) du compte:', Array.from(ownJids).join(', '));

    const uniqueMembersSet = new Set();

    for (const jid of groupJids) {
      const groupMeta = chats[jid];
      if (!groupMeta || !Array.isArray(groupMeta.participants)) continue;

      for (const participant of groupMeta.participants) {
        if (!participant?.id) continue;
        const memberJid = normalizeJid(participant.id);
        if (!memberJid) continue;
        if (isOwnParticipant(memberJid, ownJids)) continue;
        uniqueMembersSet.add(memberJid);
      }
    }

    const allUniqueMembers = Array.from(uniqueMembersSet);

    if (allUniqueMembers.length === 0) {
      runningJobs.delete(accountId);
      return reply('❌ Aucun autre membre unique à ajouter.');
    }

    const membersToAdd = allUniqueMembers.slice(0, MAX_MEMBERS_TO_ADD);
    const omittedCount = Math.max(0, allUniqueMembers.length - membersToAdd.length);

    let selectionMessage = '👥 *' + allUniqueMembers.length + ' membres uniques récupérés.*\n\n🎯 Sélection : *' + membersToAdd.length + '*';
    if (omittedCount > 0) {
      selectionMessage += '\n⚠️ ' + omittedCount + ' membres exclus (limite 1 024).';
    }
    selectionMessage += '\n\nCréation du groupe « ' + groupName + ' »...';
    await reply(selectionMessage);

    const createResponse = await conn.groupCreate(groupName, []);
    const newGroupJid = createResponse?.id || createResponse?.gid;

    if (!newGroupJid) {
      runningJobs.delete(accountId);
      throw new Error('WhatsApp n\'a pas retourné l\'ID du groupe.');
    }

    await reply(
      '✅ *Groupe créé !*\n\n' +
      '🆔 ID : ' + newGroupJid + '\n' +
      '👥 Membres : ' + membersToAdd.length + '\n' +
      '🚀 Ajout en arrière-plan.\n\n' +
      '⏱️ Délai : ' + (ADD_DELAY_MS / 1000) + ' s entre les ajouts.'
    );

    runningJobs.delete(accountId);
    runningJobs.set(newGroupJid, { startedAt: Date.now(), type: 'background-add-members' });

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
    return reply('❌ *Erreur creategroup :*\n' + getErrorMessage(error));
  }
});
