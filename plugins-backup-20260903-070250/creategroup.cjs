const { cmd } = require('../command.cjs');

cmd({ pattern: 'creategroup', desc: 'Créer un groupe unique avec tous les membres de tous les groupes', category: 'group', filename: __filename, fromMe: true }, async (conn, m) => {
    try {
        await m.reply('🔍 *Analyse de tes groupes WhatsApp en cours...*');

        // 1. Récupérer tous les chats de l'utilisateur
        const chats = await conn.groupFetchAllParticipating();
        const groupJids = Object.keys(chats);

        if (groupJids.length === 0) {
            return m.reply('❌ Aucun groupe trouvé où tu es participant.');
        }

        await m.reply(`📊 ${groupJids.length} groupes trouvés. Extraction des membres uniques...`);

        // 2. Collecter tous les membres uniques (en évitant les doublons et ton propre numéro)
        const uniqueMembersSet = new Set();
        const botJid = conn.user.id.split(':')[0] + '@s.whatsapp.net';

        for (const jid of groupJids) {
            const groupMeta = chats[jid];
            if (groupMeta && groupMeta.participants) {
                for (const participant of groupMeta.participants) {
                    // Ne pas s'ajouter soi-même dans l'ensemble des membres à ajouter
                    if (participant.id !== botJid) {
                        uniqueMembersSet.add(participant.id);
                    }
                }
            }
        }

        const allUniqueMembers = Array.from(uniqueMembersSet);
        await m.reply(`✅ ${allUniqueMembers.length} membres uniques récupérés. Création du groupe en cours...`);

        // 3. Création du nouveau groupe vide
        const createResponse = await conn.groupCreate(args.join(" ") || "DJOUSSE TECH GROUP", []);
        const newGroupJid = createResponse.id || createResponse.gid;

        await m.reply(`✅ Groupe créé avec succès ! ID : ${newGroupJid}\n⏳ Ajout progressif des membres (3s entre chaque) pour éviter le blocage WhatsApp...`);

        // 4. Boucle d'ajout SÉCURISÉE avec délai de 3s entre chaque
        let successCount = 0;
        let failCount = 0;

        for (const memberJid of allUniqueMembers) {
            try {
                // Ajout des membres UN PAR UN (pas par lots de 50)
                await conn.groupParticipantsUpdate(newGroupJid, [memberJid], "add");
                successCount++;
                
                // ⏱️ PAUSE IMPERATIVE de 3 secondes entre chaque ajout
                // pour simuler un comportement humain et respecter les quotas WhatsApp
                await new Promise(resolve => setTimeout(resolve, 3000));
                
            } catch (err) {
                failCount++;
                console.log(`⚠️ Impossible d'ajouter ${memberJid} (confidentialité ou erreur): ${err.message}`);
                // On continue même si l'ajout d'un membre échoue (ex: restrictions de confidentialité du contact)
            }
        }

        // 5. Rapport final complet
        await m.reply(`🎉 Opération terminée !\n\n` +
            `👥 Membres ajoutés avec succès : **${successCount}**\n` +
            `⚠️ Échecs (restrictions confidentialité) : **${failCount}**\n\n` +
            `⏱️ Délai de 3s entre chaque ajout respecté pour éviter le rate limiting WhatsApp.\n\n` +
            `🔗 Rejoins le groupe : ` + (await conn.groupInviteCode(newGroupJid).catch(() => 'Voir le groupe dans vos discussions')));
    } catch (error) {
        console.error("❌ Erreur critique dans la commande .creategroup :", error);
        await m.reply("❌ Une erreur critique est survenue lors de l'exécution. Vérifie les logs du terminal.");
    }
});