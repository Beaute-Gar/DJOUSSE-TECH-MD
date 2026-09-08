const config = require('../config-djousse.cjs');

function frame(title, lines) {
    const list = Array.isArray(lines) ? lines : [lines];
    const body = list
        .filter(l => l !== undefined && l !== null && l !== '')
        .map(l => `*│✦ ${l}*`)
        .join('\n');
    return `*╭┄┄『 \`${title}\` 』*\n*│*\n${body}\n*│*\n*╰┄┄┄┄┄┄┄┄┄┄┄┄⪼*`;
}

function djousseStyle(title, value, status) {
    const lines = [];
    if (value !== undefined && value !== null && value !== '') lines.push(`${title}: ${value}`);
    if (status !== undefined && status !== null && status !== '') lines.push(`sᴛᴀᴛᴜs: ${status}`);
    return `\n${frame(config.BOT_NAME || 'DJOUSSE-TECH-MD', lines)}\n\n> ${config.BOT_FOOTER || '© DJOUSSE TECH EVOLUTION'}\n`;
}

function box(title, lines) { return frame(title, lines); }
function success(text) { return frame('SUCCESS', text); }
function error(text) { return frame('ERROR', text || 'AN ERROR OCCURRED'); }
function warning(text) { return frame('WARNING', text); }
function info(text) { return frame('INFO', text); }
function menu(title, lines) { return frame(title, lines); }

module.exports = { djousseStyle, frame, box, success, error, warning, info, menu };
