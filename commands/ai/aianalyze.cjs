'use strict';

const { cmd } = require('../command.cjs');
const aiMedia = require('../../lib/ai-media.cjs');

cmd({
    pattern: 'aianalyze|analyze|aiimg|aiimage',
    alias: ['aianalyze', 'analyze'],
    react: '🔍',
    desc: 'Analyser un média avec IA (image, vidéo, audio)',
    category: 'ai',
    filename: __filename
}, async (conn, m, commands, { reply, q }) => {
    const prompt = q || 'Décris ce média en détail';
    await reply('🔍 Analyse en cours...');
    const result = await aiMedia.analyzeMedia(conn, m, prompt);
    if (result) {
        await reply(result);
    } else {
        await reply('❌ Réponds à une image, vidéo ou audio avec `.aianalyze`');
    }
});
