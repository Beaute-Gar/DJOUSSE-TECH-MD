const { cmd, commands } = require('../command.cjs');
const config = require('../config-djousse.cjs');
const { envoyerMenuInteractif, envoyerAvecBoutons, genererTexteMenu } = require('../src/menu-interactif.cjs');
const { box, uptime } = require('../lib/djousse-ui.cjs');

/* ══ Menu Interactif — Boutons / Liste WhatsApp ══
   Envoie un menu avec boutons cliquables (ou liste).
   Compatible Baileys v7 (réception) + fallback. */

cmd({
    pattern: 'menu3',
    alias: ['menubutton', 'menubtn', 'menu interactif', 'menu list'],
    desc: 'Menu interactif avec boutons/liste WhatsApp',
    category: 'main',
    filename: __filename,
}, async (conn, m) => {
    try {
        // Essayer d'abord les boutons, fallback vers liste
        const sentWithButtons = await envoyerAvecBoutons(conn, m.chat, config);
        if (sentWithButtons) {
            console.log(`[MENU3] Menu boutons envoyé à ${m.chat}`);
        } else {
            console.log(`[MENU3] Menu liste envoyé à ${m.chat} (fallback)`);
        }
    } catch (err) {
        console.error('❌ [MENU3] Erreur envoi menu interactif:', err.message);
        // Fallback : menu texte classique
        await m.reply(genererTexteMenu(config));
    }
});

/* ══ Menu Liste (alternatif) ══
   Envoie uniquement la liste interactive (pas de tentative de boutons). */
cmd({
    pattern: 'menulist',
    alias: ['mlist', 'menu2'],
    desc: 'Menu en liste interactive WhatsApp',
    category: 'main',
    filename: __filename,
}, async (conn, m) => {
    try {
        await envoyerMenuInteractif(conn, m.chat, config);
        console.log(`[MENULIST] Menu liste envoyé à ${m.chat}`);
    } catch (err) {
        console.error('❌ [MENULIST] Erreur envoi menu liste:', err.message);
        await m.reply(genererTexteMenu(config));
    }
});

module.exports = { commands };
