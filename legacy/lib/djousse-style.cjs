'use strict';
const config = require('../config-djousse.cjs');

const getTime = () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const getDate = () => new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

function headerInfoBot(opts = {}) {
  const prefix = opts.prefix || config.PREFIX || '.';
  const botName = opts.botName || config.BOT_NAME || 'DJOUSSE-TECH-MD';
  const time = opts.time || getTime();
  const date = opts.date || getDate();
  return [
    `> ╭┄┄『 𝙸𝙽𝙵𝙾 𝙱𝙾𝚃 』┄❍`,
    `> │✦ 𝙿𝚁𝙴𝙵𝙸𝚇: 〔${prefix}〕`,
    `> │✦ 𝙱𝙾𝚃: ${botName.toUpperCase()}`,
    `> │✦ 𝚃𝙸𝙼𝙴: ${time}`,
    `> │✦ 𝙳𝙰𝚃𝙴: ${date}`,
    `> │「 𝚂𝚃𝙰𝚃𝚄𝚂 𝙿𝙰𝙽𝙴𝙻 」`,
    `> │ 𝚁𝙴𝙿𝙻𝚈 𝚆𝙸𝚃𝙷 𝙰 𝙽𝚄𝙼𝙱𝙴𝚁`,
    `> ╰┄┄┄┄┄┄┄┄┄┄┄┄⪼`,
  ].join('\n');
}

function blockCategories(categories) {
  const lines = [``, `> ╭『 𝙲𝙰𝚃𝙴𝙶𝙾𝚁𝙸𝙴𝚂 』`];
  for (const cat of categories) {
    const num = String(cat.num).padStart(2, ' ');
    lines.push(`> ┊${num} ⟩⟩ ${cat.emoji} ${cat.label.toUpperCase()}`);
  }
  lines.push(`> ╰┄┄┄┄┄┄┄┄┄┄┄┄⪼`);
  return lines.join('\n');
}

function footer(opts = {}) {
  return [
    ``,
    `> 𝙼𝚄𝙻𝚃𝙸-𝙳𝙴𝚅𝙸𝙲𝙴 𝚆𝙷𝙰𝚃𝚂𝙰𝙿𝙿 𝙱𝙾𝚃`,
    `> 𝙼𝙰𝙳𝙴 𝙱𝚈 ${(opts.author || 'DJOUSSE TECH').toUpperCase()}`,
  ].join('\n');
}

function renderMainMenu(categories, opts = {}) {
  return [headerInfoBot(opts), blockCategories(categories), footer(opts)].join('\n');
}

function renderCategoryMenu(categoryLabel, categoryEmoji, commands, opts = {}) {
  const lines = [`> ╭『 ${categoryEmoji} ${categoryLabel.toUpperCase()} 』`];
  for (const cmd of commands) {
    const num = String(cmd.num).padStart(2, ' ');
    const desc = cmd.desc ? ` — ${cmd.desc}` : '';
    lines.push(`> ┊${num} ⟩⟩ ${config.PREFIX}${cmd.name}${desc}`);
  }
  lines.push(`> ╰┄┄┄┄┄┄┄┄┄┄┄┄⪼`);
  lines.push(``);
  lines.push(`> 0 ⟩⟩ 🔙 Retour au menu principal`);
  return [headerInfoBot(opts), lines.join('\n'), footer(opts)].join('\n');
}

function box(title, rows) {
  const lines = [`> ╭『 ${title.toUpperCase()} 』`];
  for (const row of rows) {
    lines.push(`> │ ${row.label ? row.label + ': ' : ''}${row.value}`);
  }
  lines.push(`> ╰┄┄┄┄┄┄┄┄┄┄┄┄⪼`);
  return lines.join('\n');
}

module.exports = { headerInfoBot, blockCategories, footer, renderMainMenu, renderCategoryMenu, box, getTime, getDate };
