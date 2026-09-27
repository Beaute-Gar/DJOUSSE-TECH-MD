// plugins/invite.cjs — .invite : lien d'invitation du groupe + broadcast dans tous les groupes
const { cmd } = require('../command.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({ pattern: 'invite', desc: 'Lien d\'invitation du groupe — .invite (ici) ou .invite all (dans tous les groupes)', category: 'group', filename: __filename, fromMe: true }, async (conn, m) => {
    const sock = conn;
    const from = m.chat;
    if (!from || !from.endsWith('@g.us')) return m.reply(boxWithFooter('ERREUR', [{ raw: '⚠️ Cette commande ne fonctionne qu\'en groupe.' }]));

    const code = await sock.groupInviteCode(from).catch(() => null);
    if (!code) return m.reply(boxWithFooter('ERREUR', [{ raw: '❌ Impossible de générer le lien d\'invitation.' }]));
    const link = 'https://chat.whatsapp.com/' + code;

    const broadcast = String(m.body || '').split(' ').slice(1).join(' ').trim().toLowerCase() === 'all';
    if (!broadcast) {
        return m.reply(
            box('INVITATION', [
                '🔗 Lien d\'invitation',
                '',
                link,
                '',
                '📢 Partagez ce lien pour inviter les membres.',
                '⚡ Astuce: *.invite all* pour l\'envoyer dans tous vos groupes automatiquement.'
            ])
        );
    }

    await m.reply(box('DIFFUSION', ['📢 Diffusion du lien d\'invitation dans vos groupes...', '⏱️ Diffusion lente (15s entre chaque) pour éviter toute restriction WhatsApp.']));
    let sent = 0;
    const groups = await sock.groupFetchAllParticipating().catch(() => ({}));
    const targets = Object.keys(groups || {}).filter(gid => String(gid).endsWith('@g.us'));
    const MAX_GROUPS = 4;
    const slice = targets.slice(0, MAX_GROUPS);
    if (targets.length > MAX_GROUPS) {
        await m.reply(boxWithFooter('ATTENTION', [{ raw: '⚠️ Compte restreint: diffusion limitée à ' + MAX_GROUPS + ' groupes pour aujourd\'hui. Réessayez demain pour les autres.' }]));
    }
    for (const gid of slice) {
        if (gid === from) continue;
        try {
            await sock.sendMessage(gid, {
                text: box('INVITATION', [
                    '🎉 Rejoignez notre nouvelle communauté !',
                    '',
                    '🤖 DJOUSSE-TECH COMMUNITY',
                    '💬 Discussions, débats, actualités tech et partages.',
                    '',
                    '🔗 ' + link
                ]),
            });
            sent++;
        } catch (e) {
            console.error(`❌ Diffusion ${gid}:`, e.message);
        }
        await new Promise(r => setTimeout(r, 15000));
    }
    await m.reply(box('SUCCÈS', ['✅ Diffusion terminée', '', '📢 Lien envoyé dans ' + sent + ' groupe(s).', '🔗 ' + link]));
});
