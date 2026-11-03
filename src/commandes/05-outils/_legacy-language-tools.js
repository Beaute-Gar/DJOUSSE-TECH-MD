'use strict';
module.exports = [
    null,
    null,
    null,
    { commands: ['goodbye', 'bye2'], description: 'Goodbye in many languages', permission: 'public', run: async (s, m, a, c) => { const phrases = [['English','Goodbye'],['Spanish','Adiós'],['French','Au revoir'],['German','Auf Wiedersehen'],['Italian','Arrivederci'],['Japanese','さようなら (Sayōnara)'],['Korean','안녕히 가세요 (Annyeonghi gaseyo)'],['Chinese','再见 (Zàijiàn)'],['Arabic','مع السلامة (Ma\'a salama)'],['Swahili','Kwaheri'],['Hindi','अलविदा (Alvida)'],['Portuguese','Adeus'],['Russian','До свидания (Do svidaniya)'],['Turkish','Hoşça kal']]; c.reply(`👋 *Goodbye in 14 Languages*\n\n${phrases.map(([l,p])=>`*${l}:* ${p}`).join('\n')}`); }},
    null,
    null,
    null,
    null,
    null,
    null,
    { commands: ['palindrome', 'ispalindrome'], description: 'Check if palindrome', permission: 'public', run: async (s, m, a, c) => { const t = a.join(' '); if (!t) return c.reply('Usage: .palindrome <word or phrase>'); const clean = t.toLowerCase().replace(/[^a-z0-9]/g, ''); const isPalin = clean === clean.split('').reverse().join(''); c.reply(`🔤 "${t}" ${isPalin ? 'IS ✅' : 'is NOT ❌'} a palindrome`); }},
    { commands: ['anagram', 'isanagram'], description: 'Check if anagram', permission: 'public', run: async (s, m, a, c) => { const parts = a.join(' ').split(/[,|\/]/); if (parts.length < 2) return c.reply('Usage: .anagram word1, word2'); const [w1, w2] = parts.map(w => w.trim().toLowerCase().replace(/\s/g, '').split('').sort().join('')); c.reply(`🔤 "${parts[0].trim()}" and "${parts[1].trim()}" ${w1 === w2 ? 'ARE ✅' : 'are NOT ❌'} anagrams`); }},
];

module.exports[10] = null;
module.exports[11] = null;
