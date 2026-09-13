// plugins/deldup.cjs — .deldup : quitte les groupes dupliqués (même nom), garde un seul
const { cmd } = require('../command.cjs');

cmd({ pattern: 'deldup', desc: 'Quitter les groupes dupliqués (même nom) en gardant un seul', category: 'group', filename: __filename, fromMe: true }, async (conn, m) => {
    const sock = conn;
    const from = m.chat;
    if (!from || !from.endsWith('@g.us')) return m.reply('⚠️ Cette commande ne fonctionne qu\'en groupe.');

    await m.reply('🔍 *Recherche des groupes dupliqués...*');
    const groups = await sock.groupFetchAllParticipating().catch(() => ({}));
    const byName = {};
    for (const [gid, g] of Object.entries(groups || {})) {
        const name = String(g.subject || 'Sans nom').toLowerCase();
        if (!byName[name]) byName[name] = [];
        byName[name].push({ id: gid, subject: g.subject });
    }

    const dupes = Object.values(byName).filter(list => list.length > 1);
    if (dupes.length === 0) {
        return m.reply('✅ Aucun groupe dupliqué trouvé.');
    }

    let left = 0;
    const details = [];
    for (const list of dupes) {
        const keep = list[0];
        for (const dup of list.slice(1)) {
            if (dup.id === from) continue;
            try {
                await sock.groupLeave(dup.id);
                details.push(`• Quitté: ${dup.subject} (${dup.id})`);
                left++;
            } catch (e) {
                details.push(`• Échec: ${dup.subject} — ${e.message}`);
            }
            await new Promise(r => setTimeout(r, 3000));
        }
        details.push(`✔️ Gardé: ${keep.subject} (${keep.id})`);
    }

    await m.reply(`🧹 *Nettoyage des doublons*\n\n${details.join('\n')}\n\n✅ ${left} groupe(s) quitté(s).`);
});
