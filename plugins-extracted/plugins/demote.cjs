const { cmd } = require('../command.cjs');

cmd({
    pattern: 'demote',
    alias: ['rétrograder'],
    desc: 'Rétrograde un admin',
    category: 'admin',
    filename: __filename,
}, async (conn, m, commands, { q }) => {
    const chat = m.chat;
    if (!String(chat).endsWith('@g.us')) return m.reply('🔒 Cette commande est réservée aux groupes.');
    const groupMeta = await conn.groupMetadata(chat).catch(() => null);
    if (!groupMeta) return m.reply('❌ Impossible de récupérer les infos du groupe.');
    const botId = conn.user?.id?.split(':')[0] || conn.user?.id || '';
    const botIsAdmin = groupMeta.participants?.some(p => p.id === botId && (p.admin === 'admin' || p.admin === 'superadmin'));
    if (!botIsAdmin) return m.reply('❌ Je ne suis pas admin du groupe.');
    let target = '';
    if (m.quoted) {
        target = m.quoted.sender || m.quoted.participant || '';
    }
    if (!target && q) {
        const num = q.replace(/[^0-9]/g, '');
        if (num) target = num + '@s.whatsapp.net';
    }
    if (!target) return m.reply('❌ Réponds au message de l\'admin à rétrograder ou tape .demote <numéro>');
    const isParticipant = groupMeta.participants?.some(p => p.id === target);
    if (!isParticipant) return m.reply('❌ Ce membre n\'est pas dans le groupe.');
    const isAdmin = groupMeta.participants?.some(p => p.id === target && (p.admin === 'admin' || p.admin === 'superadmin'));
    if (!isAdmin) return m.reply('❌ Ce membre n\'est pas admin.');
    try {
        await conn.groupParticipantsUpdate(chat, [target], 'demote');
        const num = target.split('@')[0];
        m.reply(`✅ *${num}* a été rétrogradé.`);
    } catch (e) {
        m.reply('❌ Erreur: ' + e.message);
    }
});
