'use strict';

/**
 * ============================================================
 * DJOUSSE TECH — COMMANDE AUTO (Dashboard)
 * ============================================================
 *
 * Contrôle les automatismes par groupe:
 *   .auto              → vue d'ensemble
 *   .auto list         → état de chaque automatisme
 *   .auto welcome on   → welcome/goodbye
 *   .auto autoreact on → réactions auto messages
 *   .auto autochat on  → chatbot mentions
 *   .auto autostats weekly → récap hebdo
 *   .auto levelup on   → réaction niveau-up
 *   .auto read on      → blue ticks auto
 *   .auto on           → tout activer
 *   .auto off          → tout désactiver
 *
 * ============================================================
 */

const database = require('../../database');

const AUTOMATIONS = [
    { key: 'welcome', label: 'Welcome/Goodbye', default: false },
    { key: 'autoreact', label: 'Auto-réactions messages', default: false },
    { key: 'autochat', label: 'Chatbot (mentions)', default: false },
    { key: 'autostats', label: 'Stats hebdo', default: false },
    { key: 'levelup', label: 'Réaction niveau-up', default: false },
    { key: 'read', label: 'Blue ticks auto', default: false },
    { key: 'antidelete', label: 'Anti-delete', default: false },
    { key: 'autoviewonce', label: 'Anti-vue-unique', default: false },
];

function getGroupAutomationSettings(groupId) {
    const settings = database.getGroupSettings(groupId);
    const result = {};
    for (const a of AUTOMATIONS) {
        result[a.key] = settings[a.key] !== undefined ? settings[a.key] : a.default;
    }
    return result;
}

module.exports = {
    name: 'auto',
    aliases: ['automatisme', 'automations'],
    desc: 'Contrôle les automatismes du groupe',
    category: 'group',
    ownerOnly: false,
    adminOnly: true,
    groupOnly: true,
    privateOnly: false,
    modOnly: false,
    botAdminNeeded: false,

    execute: async (sock, msg, args, ctx) => {
        if (!ctx.isGroup) return ctx.reply('Commande de groupe uniquement.');

        const input = args.join(' ').trim();
        const settings = getGroupAutomationSettings(ctx.from);

        // No argument → vue d'ensemble
        if (!input) {
            const lines = AUTOMATIONS.map(a => {
                const status = settings[a.key] ? '🟢' : '🔴';
                return `${status} ${a.label} (${a.key})`;
            });
            return ctx.reply(
                `⚙️ *Automatismes du groupe*\n\n${lines.join('\n')}\n\n` +
                `_Activer : .auto <nom> on_\n_Désactiver : .auto <nom> off_\n_Tout activer : .auto on_`
            );
        }

        // List
        if (/^list$/i.test(input)) {
            const lines = AUTOMATIONS.map(a => {
                const status = settings[a.key] ? '🟢 ON' : '🔴 OFF';
                return `${status} — ${a.label}`;
            });
            return ctx.reply(`📋 *État des automatismes*\n\n${lines.join('\n')}`);
        }

        // Toggle all
        if (/^on$/i.test(input)) {
            for (const a of AUTOMATIONS) {
                database.updateGroupSettings(ctx.from, { [a.key]: true });
            }
            return ctx.reply('✅ Tous les automatismes activés.');
        }
        if (/^off$/i.test(input)) {
            for (const a of AUTOMATIONS) {
                database.updateGroupSettings(ctx.from, { [a.key]: false });
            }
            return ctx.reply('❌ Tous les automatismes désactivés.');
        }

        // Toggle specific: ".auto welcome on/off"
        const parts = input.split(/\s+/);
        const name = parts[0]?.toLowerCase();
        const state = parts[1]?.toLowerCase();

        const automation = AUTOMATIONS.find(a => a.key === name || a.label.toLowerCase().includes(name));
        if (!automation) {
            const names = AUTOMATIONS.map(a => a.key).join(', ');
            return ctx.reply(`❌ Automatisme inconnu.\nDisponibles : ${names}`);
        }

        if (state === 'on') {
            database.updateGroupSettings(ctx.from, { [automation.key]: true });
            return ctx.reply(`✅ *${automation.label}* activé.`);
        } else if (state === 'off') {
            database.updateGroupSettings(ctx.from, { [automation.key]: false });
            return ctx.reply(`❌ *${automation.label}* désactivé.`);
        } else {
            // Toggle
            const current = settings[automation.key];
            database.updateGroupSettings(ctx.from, { [automation.key]: !current });
            return ctx.reply(`${current ? '❌' : '✅'} *${automation.label}* ${current ? 'désactivé' : 'activé'}.`);
        }
    }
};
