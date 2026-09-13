const { cmd } = require('../command.cjs');
const config = require('../config-djousse.cjs');
const { getAIMemory } = require('../src/services/ai-memory.cjs');

/* ══ Commandes AI Memory ══ */

cmd({
    pattern: 'aimemory',
    alias: ['memory', 'mem', 'historique'],
    desc: 'Voir l\'historique de conversation IA',
    category: 'ai',
    filename: __filename,
}, async (conn, m) => {
    const aiMem = getAIMemory();
    const userId = m.sender;
    const history = aiMem.getHistory(userId);
    
    if (history.length === 0) {
        return m.reply('🧠 Aucun historique de conversation.\nCommencez à discuter avec le bot !');
    }
    
    const recent = history.slice(-10);
    const text = `🧠 *Historique — ${history.length} messages*\n\n` +
        recent.map(h => {
            const role = h.role === 'user' ? '👤' : '🤖';
            return `${role} ${h.content?.slice(0, 80) || '...'}`;
        }).join('\n');
    
    await m.reply(text);
});

cmd({
    pattern: 'memory clear',
    alias: ['clear memory', 'effacer memoire'],
    desc: 'Effacer l\'historique IA',
    category: 'ai',
    filename: __filename,
}, async (conn, m) => {
    const aiMem = getAIMemory();
    aiMem.clearHistory(m.sender);
    await m.reply('🧠 Mémoire effacée. Nouvelle conversation possible.');
});

cmd({
    pattern: 'memory stats',
    desc: 'Statistiques mémoire IA',
    category: 'ai',
    filename: __filename,
}, async (conn, m) => {
    const aiMem = getAIMemory();
    const stats = aiMem.getStats();
    
    const text = `🧠 *AI Memory Stats*\n\n` +
        `💬 *Conversations actives:* ${stats.activeConversations}\n` +
        `📝 *Total messages:* ${stats.totalMessages}\n` +
        `⏰ *TTL:* ${stats.config.TTL_HOURS}h\n` +
        `📊 *Max par user:* ${stats.config.MAX_HISTORY_PER_USER} messages`;
    
    await m.reply(text);
});

module.exports = {};
