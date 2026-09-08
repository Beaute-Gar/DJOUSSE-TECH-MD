const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');

cmd({
    pattern: 'creategroup',
    react: '👥',
    desc: 'Créer un groupe avec tous les membres uniques de tes groupes',
    category: 'group',
    filename: __filename,
    fromMe: true,
}, async (conn, m, commands, { q, reply }) => {
    try {
        const groupName = (q || '').trim() || 'DJOUSSE TECH GROUP';
        await reply('🔍 *Analyse de tes groupes WhatsApp en cours...*');

        const chats = await conn.groupFetchAllParticipating();
        const groupJids = Object.keys(chats);

        if (groupJids.length === 0) {
            return reply('❌ Aucun groupe trouvé où tu es participant.');
        }

        await reply('📊 ' + groupJids.length + ' groupes trouvés. Extraction des membres uniques...');

        const uniqueMembersSet = new Set();
        const botJid = conn.user.id.split(':')[0] + '@s.whatsapp.net';

        for (const jid of groupJids) {
            const groupMeta = chats[jid];
            if (groupMeta && groupMeta.participants) {
                for (const participant of groupMeta.participants) {
                    if (participant.id !== botJid) {
                        uniqueMembersSet.add(participant.id);
                    }
                }
            }
        }

        const allUniqueMembers = Array.from(uniqueMembersSet);
        await reply('✅ ' + allUniqueMembers.length + ' membres uniques récupérés. Création du groupe « ' + groupName + ' »...');

        const createResponse = await conn.groupCreate(groupName, []);
        const newGroupJid = createResponse.id || createResponse.gid;

        await reply('✅ Groupe créé ! ID: ' + newGroupJid + '\n⏳ Ajout progressif (3s entre chaque)...');

        let successCount = 0;
        let failCount = 0;

        for (const memberJid of allUniqueMembers) {
            try {
                await conn.groupParticipantsUpdate(newGroupJid, [memberJid], 'add');
                successCount++;
                await new Promise(resolve => setTimeout(resolve, 3000));
            } catch (err) {
                failCount++;
            }
        }

        const inviteCode = await conn.groupInviteCode(newGroupJid).catch(() => null);
        const link = inviteCode ? 'https://chat.whatsapp.com/' + inviteCode : '(voir le groupe)';

        await reply(box('👥 *GROUPE CRÉÉ*', [
            { label: 'Nom', value: groupName },
            { label: 'Ajoutés', value: String(successCount) },
            { label: 'Échecs', value: String(failCount) },
            { blank: true },
            { raw: '🔗 ' + link },
        ]));
    } catch (error) {
        console.error('❌ creategroup:', error.message);
        reply('❌ Erreur: ' + error.message);
    }
});
