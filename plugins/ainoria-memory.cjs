'use strict';

const { cmd } = require('../command.cjs');
const { addFact, removeFact, getFacts, searchFacts, clearAll, getStats } = require('../lib/ainoria-memory.cjs');

// ─── .remember <clé> = <valeur> ─────────────────────────────────
cmd({
    pattern: 'remember',
    alias: ['rmember', 'mémorise'],
    desc: 'Mémoriser une information',
    category: 'ainoria',
    filename: __filename
}, async (conn, m, commands, { q, reply, sender }) => {
    if (!q) return reply(
        `┏━⍟「 ☣ AINORIA MEMORY ☣ 」⍟━┓\n` +
        `┃\n` +
        `┃ 💡 Usage :\n` +
        `┃ .remember <clé> = <valeur>\n` +
        `┃\n` +
        `┃ 📌 Exemples :\n` +
        `┃ .remember projet = DJOUSSE TECH\n` +
        `┃ .remember langue = Français\n` +
        `┃ .remember style = hacker\n` +
        `┃\n` +
        `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⍟`
    );

    const sep = q.indexOf('=');
    if (sep < 0) return reply('❌ Format : `.remember <clé> = <valeur>`');

    const key = q.slice(0, sep).trim();
    const value = q.slice(sep + 1).trim();
    if (!key || !value) return reply('❌ Clé et valeur requises');

    const updated = addFact(sender, key, value);
    await m.react('🧠');
    return reply(
        `┏━⍟「 ☣ AINORIA MEMORY ☣ 」⍟━┓\n` +
        `┃\n` +
        `┃ 🧠 Information ${updated ? 'mise à jour' : 'mémorisée'}.\n` +
        `┃\n` +
        `┃ 📌 ${key}\n` +
        `┃ 📝 ${value}\n` +
        `┃\n` +
        `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⍟`
    );
});

// ─── .forget <query> ─────────────────────────────────────────────
cmd({
    pattern: 'forget',
    alias: ['oublie', 'oublier'],
    desc: 'Oublier une information',
    category: 'ainoria',
    filename: __filename
}, async (conn, m, commands, { q, reply, sender }) => {
    if (!q) return reply('❌ Usage : `.forget <clé ou mot-clé>`');

    const removed = removeFact(sender, q);
    if (removed === 0) return reply(`❌ Aucune information trouvée pour "${q}"`);

    await m.react('🗑️');
    return reply(
        `┏━⍟「 ☣ AINORIA MEMORY ☣ 」⍟━┓\n` +
        `┃\n` +
        `┃ 🗑️ ${removed} information(s) supprimée(s).\n` +
        `┃\n` +
        `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⍟`
    );
});

// ─── .memory [query] ─────────────────────────────────────────────
cmd({
    pattern: 'memory',
    alias: ['mem', 'mémoire'],
    desc: 'Voir toutes les informations mémorisées',
    category: 'ainoria',
    filename: __filename
}, async (conn, m, commands, { q, reply, sender }) => {
    const facts = getFacts(sender);

    if (facts.length === 0) {
        return reply(
            `┏━⍟「 ☣ AINORIA MEMORY ☣ 」⍟━┓\n` +
            `┃\n` +
            `┃ 🧠 Aucune information mémorisée.\n` +
            `┃\n` +
            `┃ 💡 Utilise .remember <clé> = <valeur>\n` +
            `┃\n` +
            `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⍟`
        );
    }

    // Si query, chercher
    if (q) {
        const found = searchFacts(sender, q);
        if (found.length === 0) return reply(`❌ Aucun résultat pour "${q}"`);

        const list = found.map((f, i) => `┃ ${i + 1}. 📌 ${f.key}\n┃    📝 ${f.value}`).join('\n');
        return reply(
            `┏━⍟「 ☣ AINORIA MEMORY ☣ 」⍟━┓\n` +
            `┃\n` +
            `┃ 🔎 Résultats pour "${q}" :\n` +
            `┃\n` +
            list + '\n' +
            `┃\n` +
            `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⍟`
        );
    }

    // Tout afficher
    const list = facts.map((f, i) => `┃ ${i + 1}. 📌 ${f.key}\n┃    📝 ${f.value}`).join('\n');
    const stats = getStats(sender);

    return reply(
        `┏━⍟「 ☣ AINORIA MEMORY ☣ 」⍟━┓\n` +
        `┃\n` +
        `┃ 🧠 ${stats.total} information(s) mémorisée(s)\n` +
        `┃\n` +
        list + '\n' +
        `┃\n` +
        `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⍟`
    );
});

// ─── .memory clear ───────────────────────────────────────────────
cmd({
    pattern: 'memory clear',
    alias: ['clear memory', 'effacer mémoire'],
    desc: 'Effacer toute la mémoire',
    category: 'ainoria',
    filename: __filename
}, async (conn, m, commands, { reply, sender }) => {
    clearAll(sender);
    await m.react('🧹');
    return reply(
        `┏━⍟「 ☣ AINORIA MEMORY ☣ 」⍟━┓\n` +
        `┃\n` +
        `┃ 🧹 Mémoire effacée.\n` +
        `┃\n` +
        `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⍟`
    );
});

module.exports = {};
