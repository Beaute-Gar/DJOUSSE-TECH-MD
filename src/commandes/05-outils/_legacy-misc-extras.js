'use strict';
module.exports = [
    null,
    { commands: ['brain', 'brainsize', 'expanding'], description: 'Expanding brain meme', permission: 'public', run: async (s, m, a, c) => { const items = a.join(' ').split('|').map(i => i.trim()).filter(Boolean); if (items.length < 2) return c.reply('Usage: .brain item1 | item2 | item3 | item4'); const brains = ['🧠','🧠💡','🧠✨','🧠🌟','🧠💫🔥']; c.reply(items.map((item, i) => `${brains[Math.min(i, brains.length-1)]} ${item}`).join('\n\n')); }},
    null,
    { commands: ['uwu', 'uwuify'], description: 'UwUify text', permission: 'public', run: async (s, m, a, c) => { const t = a.join(' '); if (!t) return c.reply('Usage: .uwu <text>'); c.reply(t.replace(/[lr]/g, 'w').replace(/[LR]/g, 'W').replace(/n([aeiou])/g, 'ny$1').replace(/N([AEIOU])/g, 'NY$1').replace(/ove/g, 'uv') + ' UwU'); }},
    { commands: ['waves', 'wave', 'textwave'], description: 'Wave text effect', permission: 'public', run: async (s, m, a, c) => { const t = a.join(' '); if (!t) return c.reply('Usage: .waves <text>'); const up = 'ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖᑫʳˢᵗᵘᵛʷˣʸᶻ'; const normal = 'abcdefghijklmnopqrstuvwxyz'; c.reply(t.toLowerCase().split('').map((ch, i) => { const idx = normal.indexOf(ch); if (idx === -1) return ch; return i % 2 === 0 ? ch.toUpperCase() : [...up][idx] || ch; }).join('')); }},
    { commands: ['border', 'textborder', 'box'], description: 'Put text in a box', permission: 'public', run: async (s, m, a, c) => { const t = a.join(' '); if (!t) return c.reply('Usage: .border <text>'); const lines = t.split('\n'); const maxLen = Math.max(...lines.map(l => l.length)); const top = '╔' + '═'.repeat(maxLen + 2) + '╗'; const bottom = '╚' + '═'.repeat(maxLen + 2) + '╝'; const body = lines.map(l => `║ ${l.padEnd(maxLen)} ║`).join('\n'); c.reply(`${top}\n${body}\n${bottom}`); }},
    { commands: ['banner', 'textbanner'], description: 'Create text banner', permission: 'public', run: async (s, m, a, c) => { const t = a.join(' ').toUpperCase(); if (!t) return c.reply('Usage: .banner <text>'); c.reply(`\n${'═'.repeat(t.length+4)}\n║ ${t} ║\n${'═'.repeat(t.length+4)}`); }},
    null,
    { commands: ['backwards', 'reversewords'], description: 'Reverse word order', permission: 'public', run: async (s, m, a, c) => { const t = a.join(' '); if (!t) return c.reply('Usage: .backwards <sentence>'); c.reply(t.split(' ').reverse().join(' ')); }},
    { commands: ['rainbow', 'colortext'], description: 'Rainbow text', permission: 'public', run: async (s, m, a, c) => { const t = a.join(' '); if (!t) return c.reply('Usage: .rainbow <text>'); const colors = ['🔴','🟠','🟡','🟢','🔵','🟣']; c.reply(t.split('').map((ch, i) => ch === ' ' ? '  ' : `${colors[i % colors.length]}${ch}`).join('')); }},
    null,
    null,
    null,
    null,
    { commands: ['fortune2', 'luckynumber'], description: 'Lucky numbers', permission: 'public', run: async (s, m, a, c) => { const nums = Array(6).fill(0).map(() => Math.floor(Math.random()*49)+1).sort((a,b)=>a-b); c.reply(`🍀 *Lucky Numbers*\n\n${nums.join(' - ')}\n\n_May fortune smile upon you! 🌟_`); }},
    null,
    null,
    { commands: ['bio2', 'bioideas'], description: 'Random bio ideas', permission: 'public', run: async (s, m, a, c) => { const bios = ["Just a vibe you can't find anywhere else 🌊","Making history, not repeating it 📜","Turning dreams into plans 🎯","Built different 🏗️","Creating my own sunshine ☀️","Less talk, more action 🎬","Leveling up daily 📈","Not lucky, just blessed 🙏","Born to stand out 🌟","Life's too short for bad vibes 🦋","Main character energy ✨","Plot twist expert 🎭","Living the dream... mostly 😴","Under construction 🚧","Collecting moments, not things 📸"]; c.reply(`📝 *Bio Ideas*\n\n${Array(5).fill(0).map(() => `• ${bios[Math.floor(Math.random()*bios.length)]}`).join('\n')}`); }},
    null,
];

module.exports[3] = null;
module.exports[4] = null;
module.exports[5] = null;
module.exports[6] = null;
module.exports[8] = null;
module.exports[9] = null;
module.exports[17] = null;
