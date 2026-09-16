const { cmd } = require('../command.cjs');
const config = require('../config-djousse.cjs');
const { getCRM } = require('../src/services/crm-manager.cjs');

/* ══ Commandes CRM ══ */

cmd({
    pattern: 'crm',
    alias: ['crm stats', 'crm info'],
    desc: 'Statistiques CRM (contacts, messages)',
    category: 'owner',
    filename: __filename,
}, async (conn, m) => {
    const crm = getCRM();
    const stats = crm.getStats();
    
    const text = `📊 *CRM — Statistiques*\n\n` +
        `👥 *Contacts:* ${stats.totalContacts}\n` +
        `📱 *Actifs aujourd'hui:* ${stats.activeToday}\n` +
        `💬 *Total messages:* ${stats.totalMessages}\n` +
        `⌨️ *Total commandes:* ${stats.totalCommands}\n` +
        `📢 *Campagnes:* ${stats.campaigns}\n` +
        `⏰ *Rappels en attente:* ${stats.pendingReminders}\n\n` +
        `🏆 *Top 5 contacts:*\n` +
        stats.topContacts.slice(0, 5).map((c, i) => `${i+1}. ${c.name}: ${c.messages} msg`).join('\n');
    
    await m.reply(text);
});

cmd({
    pattern: 'crm search',
    alias: ['crm find'],
    desc: 'Rechercher un contact CRM',
    category: 'owner',
    filename: __filename,
}, async (conn, m) => {
    const query = String(m.body || '').replace(/^\.?(crm\s+(?:search|find))\s*/i, '').trim();
    if (!query) return m.reply('Usage: .crm search <nom/tag>');
    
    const crm = getCRM();
    const results = crm.search(query);
    
    if (results.length === 0) return m.reply('Aucun contact trouvé.');
    
    const text = `🔍 *Résultats:*\n\n` +
        results.slice(0, 10).map(c => 
            `• ${c.name || c.phone} (${c.stats.messages} msg) — Tags: ${c.tags.join(', ') || 'aucun'}`
        ).join('\n');
    
    await m.reply(text);
});

cmd({
    pattern: 'crm tag',
    desc: 'Ajouter un tag à un contact',
    category: 'owner',
    filename: __filename,
}, async (conn, m) => {
    const parts = String(m.body || '').replace(/^\.?(crm\s+tag)\s*/i, '').trim().split(/\s+/);
    const tag = parts[0];
    const phone = parts[1];
    if (!tag || !phone) return m.reply('Usage: .crm tag <tag> <numero>');
    
    const crm = getCRM();
    const userId = phone.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
    crm.addTag(userId, tag);
    await m.reply(`✅ Tag "${tag}" ajouté à ${phone}`);
});

cmd({
    pattern: 'crm note',
    desc: 'Ajouter une note à un contact',
    category: 'owner',
    filename: __filename,
}, async (conn, m) => {
    const parts = String(m.body || '').replace(/^\.?(crm\s+note)\s*/i, '').trim().split(/\s+/);
    const phone = parts[0];
    const note = parts.slice(1).join(' ');
    if (!phone || !note) return m.reply('Usage: .crm note <numero> <note>');
    
    const crm = getCRM();
    const userId = phone.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
    crm.addNote(userId, note);
    await m.reply(`✅ Note ajoutée pour ${phone}`);
});

module.exports = {};
