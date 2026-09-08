/**
 * .loglevel — Contrôle le niveau de logs du bot
 * Usage: .loglevel | .loglevel normal | .loglevel debug | .loglevel quiet
 * Seul l'owner peut modifier le niveau global.
 */
const { cmd } = require('../command.cjs');
const log = require('../lib/logger.cjs');
const { isOwner } = require('../lib/permission.cjs');

cmd({
    pattern: 'loglevel',
    desc: 'Afficher ou changer le niveau de logs',
    category: 'owner',
    filename: __filename,
    fromMe: false,
}, async (conn, m, commands, config) => {
    if (!isOwner(m.sender) && !isOwner(m.altSender)) return m.reply('🔒 Réservé à l\'owner.');

    const args = m.body.split(' ').slice(1);
    const mode = (args[0] || '').toLowerCase();

    if (!mode || !['normal', 'debug', 'quiet'].includes(mode)) {
        const current = log.getMode();
        return m.reply(`📋 *Niveau de logs actuel :* ${current}\n\nModes disponibles :\n• \`normal\` — Affichage propre\n• \`debug\` — Détails techniques\n• \`quiet\` — Silencieux`);
    }

    log.setMode(mode);
    const labels = { NORMAL: '🟢 Normal', DEBUG: '🔵 Debug', QUIET: '🟠 Silencieux' };
    return m.reply(`${labels[mode.toUpperCase()] || mode}\nNiveau de logs changé : ${mode.toUpperCase()}`);
});
