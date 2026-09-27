'use strict';

const { cmd } = require('../command.cjs');
const { box, boxWithFooter } = require('../lib/djousse-ui.cjs');
const { addFact, removeFact, getFacts, searchFacts, clearAll, getStats } = require('../lib/ainoria-memory.cjs');

// ─── .remember <clé> = <valeur> ─────────────────────────────────
cmd({
    pattern: 'memoire',
    desc: 'Mémoriser une information',
    category: 'ainoria',
    filename: __filename
}, async (conn, m, commands, { q, reply, sender }) => {
    if (!q) return reply(boxWithFooter('AINORIA MEMORY', [
      { raw: '💡 Usage :' },
      { raw: '.remember <clé> = <valeur>' },
      { blank: true },
      { raw: '📌 Exemples :' },
      { raw: '.remember projet = DJOUSSE TECH' },
      { raw: '.remember langue = Français' },
      { raw: '.remember style = hacker' }
    ]));

    const sep = q.indexOf('=');
    if (sep < 0) return reply(boxWithFooter('ERROR', [{ raw: '❌ Format : `.remember <clé> = <valeur>`' }]));

    const key = q.slice(0, sep).trim();
    const value = q.slice(sep + 1).trim();
    if (!key || !value) return reply(boxWithFooter('ERROR', [{ raw: '❌ Clé et valeur requises' }]));

    const updated = addFact(sender, key, value);
    await m.react('🧠');
    return reply(boxWithFooter('AINORIA MEMORY', [
      { raw: `🧠 Information ${updated ? 'mise à jour' : 'mémorisée'}.` },
      { blank: true },
      { label: '📌', value: key },
      { label: '📝', value: value }
    ]));
});

// ─── .forget <query> ─────────────────────────────────────────────
cmd({
    pattern: 'oublier',
    desc: 'Oublier une information',
    category: 'ainoria',
    filename: __filename
}, async (conn, m, commands, { q, reply, sender }) => {
    if (!q) return reply(boxWithFooter('ERROR', [{ raw: '❌ Usage : `.forget <clé ou mot-clé>`' }]));

    const removed = removeFact(sender, q);
    if (removed === 0) return reply(boxWithFooter('ERROR', [{ raw: `❌ Aucune information trouvée pour "${q}"` }]));

    await m.react('🗑️');
    return reply(boxWithFooter('AINORIA MEMORY', [
      { raw: `🗑️ ${removed} information(s) supprimée(s).` }
    ]));
});

// ─── .memory [query] ─────────────────────────────────────────────
cmd({
    pattern: 'mem',
    desc: 'Voir toutes les informations mémorisées',
    category: 'ainoria',
    filename: __filename
}, async (conn, m, commands, { q, reply, sender }) => {
    const facts = getFacts(sender);

    if (facts.length === 0) {
        return reply(boxWithFooter('AINORIA MEMORY', [
          { raw: '🧠 Aucune information mémorisée.' },
          { blank: true },
          { raw: '💡 Utilise .remember <clé> = <valeur>' }
        ]));
    }

    // Si query, chercher
    if (q) {
        const found = searchFacts(sender, q);
        if (found.length === 0) return reply(boxWithFooter('ERROR', [{ raw: `❌ Aucun résultat pour "${q}"` }]));

        const list = found.map((f, i) => ({ raw: `${i + 1}. 📌 ${f.key}\n   📝 ${f.value}` }));
        return reply(boxWithFooter('AINORIA MEMORY', [
          { raw: `🔎 Résultats pour "${q}" :` },
          ...list
        ]));
    }

    // Tout afficher
    const list = facts.map((f, i) => ({ raw: `${i + 1}. 📌 ${f.key}\n   📝 ${f.value}` }));
    const stats = getStats(sender);

    return reply(boxWithFooter('AINORIA MEMORY', [
      { raw: `🧠 ${stats.total} information(s) mémorisée(s)` },
      ...list
    ]));
});

// ─── .memory clear ───────────────────────────────────────────────
cmd({
    pattern: 'memory clear',
    desc: 'Effacer toute la mémoire',
    category: 'ainoria',
    filename: __filename
}, async (conn, m, commands, { reply, sender }) => {
    clearAll(sender);
    await m.react('🧹');
    return reply(boxWithFooter('AINORIA MEMORY', [{ raw: '🧹 Mémoire effacée.' }]));
});

module.exports = {};
