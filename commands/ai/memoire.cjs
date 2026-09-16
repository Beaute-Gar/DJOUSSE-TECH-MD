'use strict';

/**
 * ============================================================
 * DJOUSSE TECH — COMMANDE MÉMOIRE
 * ============================================================
 *
 * Gère la mémoire IA de l'utilisateur:
 *   .memoire              → liste les faits
 *   .memoire apprendre X  → ajoute un fait
 *   .memoire oublier <n>  → supprime par numéro
 *   .memoire reset        → efface tout
 *   .memoire stats        → statistiques
 *
 * ============================================================
 */

const memory = require('../../lib/memory.cjs');

module.exports = {
    name: 'memoire',
    aliases: ['memory', 'memo', 'm'],
    desc: 'Gère ta mémoire IA',
    category: 'ai',
    ownerOnly: false,
    adminOnly: false,
    groupOnly: false,
    privateOnly: false,
    modOnly: false,
    botAdminNeeded: false,

    execute: async (sock, msg, args, ctx) => {
        const input = args.join(' ').trim();
        const sub = input.split(/\s+/)[0]?.toLowerCase();

        // No argument → list
        if (!input || (!['apprendre', 'oublier', 'reset', 'stats', 'voir', 'list'].includes(sub))) {
            const facts = memory.listFacts(ctx.sender);
            if (!facts.length) {
                return ctx.reply(
                    '🧠 *Ta mémoire IA*\n\n' +
                    'Aucun fait enregistré.\n\n' +
                    'Envoie-moi un message contenant "je m\'appelle", "je vends", "j\'habite" etc.\n' +
                    'Ou utilise : _.memoire apprendre <fait>_'
                );
            }
            const lines = facts.map((f, i) => `${i + 1}. ${f.text}`).join('\n');
            return ctx.reply(
                `🧠 *Ta mémoire IA* (${facts.length}/${50})\n\n${lines}\n\n` +
                `_Oublier : .memoire oublier <n°>_`
            );
        }

        // Stats
        if (sub === 'stats') {
            const stats = memory.getStats(ctx.sender);
            return ctx.reply(
                `📊 *Stats mémoire*\n\n` +
                `Faits : ${stats.factCount}/${stats.maxFacts}\n` +
                `Interactions : ${stats.interactions}\n` +
                `Dernière interaction : ${stats.lastInteraction ? new Date(stats.lastInteraction).toLocaleString('fr-FR', { timeZone: 'Africa/Douala' }) : 'jamais'}`
            );
        }

        // Reset
        if (sub === 'reset') {
            memory.clearMemory(ctx.sender);
            return ctx.reply('🧠 Mémoire effacée.');
        }

        // Oublier
        if (sub === 'oublier') {
            const num = parseInt(args[1], 10);
            if (isNaN(num) || num < 1) {
                return ctx.reply('Utilise : _.memoire oublier <n°>_ (numéro du fait dans la liste)');
            }
            const removed = memory.removeFactByIndex(ctx.sender, num - 1);
            if (!removed) return ctx.reply('❌ Numéro invalide.');
            return ctx.reply(`🗑️ Fait n°${num} supprimé.`);
        }

        // Apprendre
        if (sub === 'apprendre' || sub === 'add') {
            const text = input.replace(/^apprendre\s+/i, '').replace(/^add\s+/i, '').trim();
            if (!text || text.length < 3) {
                return ctx.reply('Utilise : _.memoire apprendre <fait>_');
            }
            if (memory.containsSensitive(text)) {
                return ctx.reply('❌ Je ne stocke pas de données sensibles (mots de passe, numéros, etc.)');
            }
            const fact = memory.addFact(ctx.sender, text, 'manual');
            if (!fact) {
                return ctx.reply('❌ Fait déjà connu ou limite atteinte.');
            }
            return ctx.reply(`✅ Fait appris : _"${text.substring(0, 80)}${text.length > 80 ? '...' : ''}"_`);
        }

        // Voir (alias)
        if (sub === 'voir' || sub === 'list') {
            const facts = memory.listFacts(ctx.sender);
            if (!facts.length) return ctx.reply('🧠 Aucun fait enregistré.');
            const lines = facts.map((f, i) => `${i + 1}. ${f.text}`).join('\n');
            return ctx.reply(`🧠 *Ta mémoire* (${facts.length})\n\n${lines}`);
        }

        return ctx.reply('Commande inconnue. Utilise : _.memoire [apprendre/oublier/reset/stats]_');
    }
};
