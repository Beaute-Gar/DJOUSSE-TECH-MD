'use strict';

/**
 * ============================================================
 * DJOUSSE TECH — COMMANDE RAPPEL
 * ============================================================
 *
 * Gère les rappels en langage naturel:
 *   .rappel appeler le fournisseur demain à 15h   → créer
 *   .rappel                                        → liste
 *   .rappel annuler <n°>                           → annuler
 *   .rappel stats                                  → statistiques
 *
 * ============================================================
 */

const Reminder = require('../../lib/reminders.cjs');
const { parseReminder } = require('../../lib/reminder-parser.cjs');

module.exports = {
    name: 'rappel',
    aliases: ['remind', 'agenda', 'rappelle'],
    desc: 'Gère tes rappels en langage naturel',
    category: 'tool',
    ownerOnly: false,
    adminOnly: false,
    groupOnly: false,
    privateOnly: false,
    modOnly: false,
    botAdminNeeded: false,

    execute: async (sock, msg, args, ctx) => {
        const input = args.join(' ').trim();

        // SANS argument : lister
        if (!input) {
            const list = Reminder.listReminders(ctx.sender);
            if (!list.length) {
                return ctx.reply(
                    '📅 *Aucun rappel actif*\n\n' +
                    'Crée-en un :\n' +
                    '_.rappel appeler maman demain à 15h_\n' +
                    '_.rappel dans 2h envoyer le devis_\n' +
                    '_.rappel chaque lundi à 8h réunion_'
                );
            }
            const lines = list.map((r, i) => {
                const when = new Date(r.dueAt).toLocaleString('fr-FR', { timeZone: 'Africa/Douala' });
                return `${i + 1}. ${r.text}\n   ⏰ ${when}${r.recurring ? ' 🔁' : ''}`;
            });
            return ctx.reply(
                `📅 *Tes rappels (${list.length}/${20})*\n\n${lines.join('\n')}\n\n_Annuler : .rappel annuler <n°>_`
            );
        }

        // Annuler
        if (/^annuler\b/i.test(input)) {
            const target = input.replace(/^annuler\s+/i, '').trim();
            if (!target) {
                return ctx.reply('Utilise : _.rappel annuler <n°>_ (numéro dans la liste)');
            }
            const removed = Reminder.cancelReminder(ctx.sender, target);
            if (!removed) return ctx.reply('❌ Rappel non trouvé.');
            return ctx.reply(`🗑️ Rappel n°${target} annulé.`);
        }

        // Stats
        if (/^stats?$/i.test(input)) {
            const stats = Reminder.getStats(ctx.sender);
            return ctx.reply(
                `📊 *Stats rappels*\n\n` +
                `Actifs : ${stats.active}/${stats.maxPerUser}\n` +
                `Livrés : ${stats.delivered}\n` +
                `Total : ${stats.total}`
            );
        }

        // Créer — parsing langage naturel
        const parsed = parseReminder(input);
        if (!parsed || !parsed.dueAt || !parsed.text) {
            return ctx.reply(
                '❌ Je n\'ai pas compris la date.\n\n' +
                'Exemples :\n' +
                '_.rappel appeler Jean demain à 15h_\n' +
                '_.rappel dans 2h envoyer le devis_\n' +
                '_.rappel chaque lundi à 8h réunion_\n' +
                '_.rappel le 25 à 10h30 payer le loyer_'
            );
        }

        const id = Reminder.addReminder({
            chatJid: ctx.from,
            userJid: ctx.sender,
            text: parsed.text,
            dueAt: parsed.dueAt,
            recurring: parsed.recurring,
            created: Date.now(),
        });

        if (!id) {
            return ctx.reply('⚠️ Limite de 20 rappels actifs atteinte. Annule-en un d\'abord.');
        }

        const when = new Date(parsed.dueAt).toLocaleString('fr-FR', { timeZone: 'Africa/Douala' });
        return ctx.reply(
            `✅ Rappel programmé pour *${when}*\n📝 ${parsed.text}${parsed.recurring ? '\n🔁 Récurrent' : ''}`
        );
    }
};
