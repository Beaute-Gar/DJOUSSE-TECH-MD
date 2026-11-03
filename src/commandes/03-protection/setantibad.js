'use strict';

const fs = require('fs');
const path = require('path');
const style = require('../../config/style');

const badWordsFile = path.join(require('../../config/paths').PLUGIN_DATA, 'badwords.json');

function loadBadWords(jid) {
    try {
        const data = JSON.parse(fs.readFileSync(badWordsFile, 'utf8'));
        return data[jid] || [];
    } catch {
        return [];
    }
}

function saveBadWords(jid, words) {
    let data = {};
    try {
        data = JSON.parse(fs.readFileSync(badWordsFile, 'utf8'));
    } catch {}
    data[jid] = words;
    fs.mkdirSync(path.dirname(badWordsFile), { recursive: true });
    fs.writeFileSync(badWordsFile, JSON.stringify(data, null, 2));
}

module.exports = {
    // @legacy-order {"sourceFile":"03-protection/group3.js","sourceOrder":104,"definitionIndex":0,"entryOrder":286}
    commands: ['setantibad'],
    description: 'Extended group management commands',
    permission: 'admin',
    group: true,
    private: false,

    run: async (sock, message, args, ctx) => {
        const { jid, contextInfo } = ctx;
        const words = args.join(' ').split(/[,\s]+/).map((word) => word.trim().toLowerCase()).filter(Boolean);
        const send = (text, renderer = style.renderInfo) => sock.sendMessage(jid, {
            text: renderer(text.split('\n')),
            contextInfo,
        }, { quoted: message });
        if (!words.length) return send('❌ *Usage:* `.setantibad <word1, word2, ...>`', style.renderError);

        const existing = loadBadWords(jid);
        const merged = [...new Set([...existing, ...words])];
        saveBadWords(jid, merged);
        return send(`✅ Added *${words.length}* word(s) to bad word filter.\nTotal: *${merged.length}* words`);
    },
};
