'use strict';

const { cmd } = require('../command.cjs');
const fs = require('fs');
const path = require('path');

// ─── Message index (stockage léger) ──────────────────────────────
const INDEX_FILE = path.join(__dirname, '..', 'data', 'message-index.json');

function loadIndex() {
    try {
        fs.mkdirSync(path.dirname(INDEX_FILE), { recursive: true });
        return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
    } catch { return {}; }
}

function saveIndex(data) {
    fs.mkdirSync(path.dirname(INDEX_FILE), { recursive: true });
    fs.writeFileSync(INDEX_FILE, JSON.stringify(data, null, 2));
}

// ─── Indexer un message ──────────────────────────────────────────
function indexMessage(chat, sender, text, time) {
    if (!text || text.length < 3) return;
    const idx = loadIndex();
    if (!idx[chat]) idx[chat] = [];

    idx[chat].push({
        sender: sender.replace(/[^0-9]/g, ''),
        text: text.slice(0, 500),
        time: time || Date.now()
    });

    // Garder les 5000 derniers messages par chat
    if (idx[chat].length > 5000) idx[chat] = idx[chat].slice(-5000);
    saveIndex(idx);
}

// ─── Chercher dans l'index ───────────────────────────────────────
function searchMessages(chat, query) {
    const idx = loadIndex();
    const messages = idx[chat] || [];
    const q = query.toLowerCase();

    return messages.filter(m => m.text.toLowerCase().includes(q)).slice(-20);
}

// ─── .find <query> ───────────────────────────────────────────────
cmd({
    pattern: 'find',
    alias: ['search', 'chercher', 'recherche'],
    desc: 'Rechercher dans les messages',
    category: 'ainoria',
    filename: __filename
}, async (conn, m, commands, { q, reply, isGroup }) => {
    if (!q) return reply(
        `┏━⍟「 ☣ MESSAGE SEARCH ☣ 」⍟━┓\n` +
        `┃\n` +
        `┃ 💡 Usage : .find <terme>\n` +
        `┃\n` +
        `┃ 📌 Exemples :\n` +
        `┃ .find prix du serveur\n` +
        `┃ .find réunion\n` +
        `┃ .find Gar\n` +
        `┃\n` +
        `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⍟`
    );

    const chat = m.chat;
    const results = searchMessages(chat, q);

    if (results.length === 0) {
        return reply(`🔎 Aucun résultat pour "${q}" dans cette conversation.`);
    }

    const list = results.map((r, i) => {
        const date = new Date(r.time);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const time = `${date.getHours()}h${String(date.getMinutes()).padStart(2, '0')}`;
        return `┃ ${i + 1}. @${r.sender} — ${day}/${month} ${time}\n┃    « ${r.text.slice(0, 80)}${r.text.length > 80 ? '...' : ''} »`;
    }).join('\n');

    const mentions = [...new Set(results.map(r => r.sender + '@s.whatsapp.net'))];

    return reply(
        `┏━⍟「 ☣ SEARCH — "${q}" ☣ 」⍟━┓\n` +
        `┃\n` +
        `┃ 🔎 ${results.length} résultat(s) trouvé(s)\n` +
        `┃\n` +
        list + '\n' +
        `┃\n` +
        `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⍟`
    );
});

// ─── Export pour index.cjs ────────────────────────────────────────
module.exports = { indexMessage };
