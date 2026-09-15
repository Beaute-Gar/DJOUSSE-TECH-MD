const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');
const { isLidUser } = require('@whiskeysockets/baileys');

/*
 * DJOUSSE TECH — CREATEGROUP v3
 *
 * Réalité Baileys 7 (@whiskeysockets/baileys ^7.0.0-rc14) :
 * - groupFetchAllParticipating() retourne des @lid pour les groupes LID mode
 * - groupParticipantsUpdate() exige des @s.whatsapp.net
 * - Aucune fonction native pour convertir @lid → @s.whatsapp.net
 * - Seul le cache global.__lidToPn (construit depuis les messages reçus)
 *   permet de résoudre un @lid en numéro de téléphone
 *
 * Comportement :
 * 1. Extrait tous les JID membres (bruts)
 * 2. Résout via le cache LID→PN
 * 3. Ignore les JID non résolubles
 * 4. Crée le groupe immédiatement
 * 5. Ajoute les résolus en arrière-plan
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
  const s = String(num).replace(/@s\.whatsapp\.net$/, '').split(':')[0];
  return s + '@s.whatsapp.net';
}

function getOwnJids(conn) {
  const result = new Set();
  try {
    if (conn?.user?.id) {
      const raw = String(conn.user.id);
      result.add(normalizeJid(raw));
      const base = raw.split(':')[0];
      if (base) result.add(normalizeJid(base + '@s.whatsapp.net'));
    }
    if (conn?.user?.lid) result.add(normalizeJid(conn.user.lid));
  } catch (_) {}
  return result;
}

function isOwnJid(jid, ownJids) {
  const n = normalizeJid(jid);
  if (!n) return true;
  if (ownJids.has(n)) return true;
  if (n.endsWith('@s.whatsapp.net')) {
    const num = n.replace('@s.whatsapp.net', '').split(':')[0];
    for (const own of ownJids) {
      if (!own.endsWith('@s.whatsapp.net')) continue;
      if (own.replace('@s.whatsapp.net', '').split(':')[0] === num) return true;
    }
  }
  return false;
}

/**
 * Résout un JID brut en @s.whatsapp.net utilisable.
 * Retourne null si non résoluble.
 */
function resolveToPn(rawJid, ownJids) {
  const n = normalizeJid(rawJid);
  if (!n) return null;

  // Déjà un @s.whatsapp.net
  if (n.endsWith('@s.whatsapp.net')) {
    return isOwnJid(n, ownJids) ? null : n;
  }

  // @lid → résoudre via le cache
  if (isLidUser && isLidUser(n)) {
    const lidMap = global.__lidToPn || new Map();
    const pn = lidMap.get(n);
    if (pn) {
      const resolved = toPnJid(pn);
      return isOwnJid(resolved, ownJids) ? null : resolved;
    }
    return null; // Non résoluble
  }

  return null; // @g.us ou autre → ignorer
}

function getErrorMessage(error) {
  if (!error) return 'Erreur inconnue';
  return error?.message || error?.data?.message || error?.output?.payload?.message || String(error);
}

function isRateLimitError(error) {
  const msg = getErrorMessage(error).toLowerCase();
  return msg.includes('rate') || msg.includes('too many') || msg.includes('limit') ||
    msg.includes('throttl') || msg.includes('temporar') || msg.includes('try again later') ||
    msg.includes('wait') || msg.includes('forbidden') || msg.includes('not-authorized');
}

async function processGroupCreation({ conn, groupJid, groupName, members, reply }) {
  let successCount = 0;
  let failCount = 0;
  let alreadyCount = 0;

  try {
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👥 [CREATEGROUP] AJOUT EN ARRIÈRE-PLAN');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Groupe :', groupJid);
    console.log('Cible  :', members.length);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    for (let i = 0; i < members.length; i++) {
      const jid = members[i];

      try {
        const result = await conn.groupParticipantsUpdate(groupJid, [jid], 'add');
        const item = Array.isArray(result) ? result[0] : null;
        const status = (item?.status != null ? String(item.status) : '').toLowerCase();

        if (status === '200' || status === 'success' || status === 'ok' || status === '') {
          successCount++;
          console.log('[CREATEGROUP] ✅ ' + successCount + '/' + members.length + ' : ' + jid);
        } else if (status.includes('409') || status.includes('already')) {
          alreadyCount++;
        } else {
          failCount++;
          console.log('[CREATEGROUP] ⚠️ Refusé : ' + jid + ' (' + status + ')');
        }
      } catch (error) {
        failCount++;
        console.error('[CREATEGROUP] ❌ ' + jid + ': ' + getErrorMessage(error));

        if (isRateLimitError(error)) {
          console.warn('[CREATEGROUP] 🛑 Rate limit WhatsApp. Arrêt.');
          try {
            await reply('⚠️ *Ajout interrompu*\n\n✅ Ajoutés : ' + successCount + '\n❌ Échecs : ' + failCount);
          } catch (_) {}
          break;
        }
      }

      const processed = successCount + failCount + alreadyCount;
      if (processed > 0 && (processed % PROGRESS_EVERY === 0 || processed === members.length)) {
        try {
          await reply('👥 *Progression*\n\n📊 ' + processed + '/' + members.length + '\n✅ ' + successCount + ' | ↪️ ' + alreadyCount + ' | ❌ ' + failCount);
        } catch (_) {}
      }

      if (i < members.length - 1) await sleep(ADD_DELAY_MS);
    }

    const inviteCode = await conn.groupInviteCode(groupJid).catch(() => null);
    const link = inviteCode ? 'https://chat.whatsapp.com/' + inviteCode : '(lien indisponible)';

    console.log('🏁 [CREATEGROUP] TERMINÉ — Ajoutés:', successCount, 'Déjà:', alreadyCount, 'Échecs:', failCount);

    await reply(
      box('👥 *GROUPE CRÉÉ*', [
        { label: 'Nom', value: groupName },
        { label: 'Ajoutés', value: String(successCount) },
        { label: 'Déjà présents', value: String(alreadyCount) },
        { label: 'Échecs', value: String(failCount) },
        { blank: true },
        { raw: '🔗 ' + link },
      ])
    );
  } catch (error) {
    console.error('[CREATEGROUP] Erreur:', getErrorMessage(error));
    try { await reply('⚠️ *Ajout interrompu*\n\n✅ ' + successCount + ' | ❌ ' + failCount); } catch (_) {}
  } finally {
    runningJobs.delete(groupJid);
  }
}

cmd({
  pattern: 'creategroup',
  react: '👥',
  desc: 'Créer un groupe avec les membres résolus (PN) de tes groupes',
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
    await reply('🔍 *Analyse de tes groupes...*');

    const chats = await conn.groupFetchAllParticipating();
    const groupJids = Object.keys(chats || {});

    if (groupJids.length === 0) {
      runningJobs.delete(accountId);
      return reply('❌ Aucun groupe trouvé.');
    }

    await reply('📊 *' + groupJids.length + ' groupes trouvés.* Extraction...');

    const ownJids = getOwnJids(conn);
    const lidMap = global.__lidToPn || new Map();
    console.log('[CREATEGROUP] Cache LID→PN:', lidMap.size, 'entrées');

    // 1. Collecte brute
    const rawSet = new Set();
    for (const jid of groupJids) {
      const meta = chats[jid];
      if (!meta || !Array.isArray(meta.participants)) continue;
      for (const p of meta.participants) {
        if (p?.id) rawSet.add(normalizeJid(p.id));
      }
    }

    // 2. Résolution LID → PN
    const resolved = new Set();
    let lidTotal = 0;
    let lidResolved = 0;
    let lidUnresolved = 0;
    let ownSkipped = 0;

    for (const raw of rawSet) {
      if (isLidUser && isLidUser(raw)) {
        lidTotal++;
        const pn = resolveToPn(raw, ownJids);
        if (pn) { resolved.add(pn); lidResolved++; }
        else lidUnresolved++;
      } else if (raw.endsWith('@s.whatsapp.net')) {
        if (isOwnJid(raw, ownJids)) { ownSkipped++; continue; }
        resolved.add(raw);
      } else {
        // @g.us ou autre
      }
    }

    const allResolved = Array.from(resolved);

    if (allResolved.length === 0) {
      runningJobs.delete(accountId);
      return reply(
        '❌ Aucun membre résolvable.\n\n' +
        '🔍 Bruts : ' + rawSet.size + '\n' +
        '🔒 @lid total : ' + lidTotal + '\n' +
        '✅ @lid résolus : ' + lidResolved + '\n' +
        '❌ @lid non résolus : ' + lidUnresolved + '\n' +
        '👤 JID propres exclus : ' + ownSkipped + '\n\n' +
        '💡 Les @lid ne sont résolubles que si la personne a déjà envoyé un message au bot.\n' +
        'Les membres non résolus ne peuvent pas être ajoutés via groupParticipantsUpdate.'
      );
    }

    const membersToAdd = allResolved.slice(0, MAX_MEMBERS_TO_ADD);
    const omitted = Math.max(0, allResolved.length - membersToAdd.length);

    let msg = '👥 *' + rawSet.size + ' membres bruts*\n\n';
    msg += '📱 Résolus (PN) : *' + allResolved.length + '*\n';
    msg += '🔒 @lid : ' + lidTotal + ' (✅ ' + lidResolved + ' / ❌ ' + lidUnresolved + ')\n';
    if (ownSkipped > 0) msg += '👤 Bot exclu : ' + ownSkipped + '\n';
    msg += '\n🎯 Sélection : *' + membersToAdd.length + '*';
    if (omitted > 0) msg += '\n⚠️ ' + omitted + ' exclus (limite 1 024)';
    msg += '\n\nCréation...';
    await reply(msg);

    const createResponse = await conn.groupCreate(groupName, []);
    const newGroupJid = createResponse?.id || createResponse?.gid;

    if (!newGroupJid) {
      runningJobs.delete(accountId);
      throw new Error('ID du groupe non retourné.');
    }

    await reply('✅ *Groupe créé !*\n\n🆔 ' + newGroupJid + '\n👥 ' + membersToAdd.length + ' membres\n🚀 Ajout en arrière-plan...');

    runningJobs.delete(accountId);
    runningJobs.set(newGroupJid, { startedAt: Date.now() });

    processGroupCreation({ conn, groupJid: newGroupJid, groupName, members: membersToAdd, reply })
      .catch(e => { console.error('[CREATEGROUP] Job:', e.message); runningJobs.delete(newGroupJid); });

    return;
  } catch (error) {
    console.error('❌ creategroup:', getErrorMessage(error));
    return reply('❌ *Erreur :* ' + getErrorMessage(error));
  }
});
