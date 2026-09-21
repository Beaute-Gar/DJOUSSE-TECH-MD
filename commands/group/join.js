const { cmd } = require('../command.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');

cmd({
    pattern: 'join',
    desc: 'Rejoint un groupe via lien',
    category: 'admin',
    filename: __filename,
}, async (conn, m, commands, { q }) => {
    if (!q) return m.reply(boxWithFooter('ERREUR', [{ raw: '❌ Utilisation: .join <lien d\'invitation>\nExemple: .join https://chat.whatsapp.com/ABC123' }]));
    const link = q.trim();
    const match = link.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/);
    if (!match) return m.reply(boxWithFooter('ERREUR', [{ raw: '❌ Lien invalide. Format: https://chat.whatsapp.com/XXXXX' }]));
    const inviteCode = match[1];
    try {
        const result = await conn.groupAcceptInvite(inviteCode);
        m.reply(boxWithFooter('SUCCÈS', [{ raw: '✅ J\'ai rejoint le groupe !' }]));
    } catch (e) {
        const msg = e.message || '';
        if (msg.includes('401')) m.reply(boxWithFooter('ERREUR', [{ raw: '❌ Lien invalide ou expiré.' }]));
        else if (msg.includes('403')) m.reply(boxWithFooter('ERREUR', [{ raw: '❌ Je suis bloqué par ce groupe.' }]));
        else if (msg.includes('404')) m.reply(boxWithFooter('ERREUR', [{ raw: '❌ Groupe introuvable.' }]));
        else if (msg.includes('410')) m.reply(boxWithFooter('ERREUR', [{ raw: '❌ Le groupe a été supprimé.' }]));
        else m.reply(boxWithFooter('ERREUR', [{ raw: '❌ Erreur: ' + msg }]));
    }
});
