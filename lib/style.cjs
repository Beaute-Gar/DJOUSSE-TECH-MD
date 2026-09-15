const BOX_CHARS = { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│' };

function box(title, lines, width = 40) {
  const pad = (s, w) => {
    s = String(s);
    return s + ' '.repeat(Math.max(0, w - s.length));
  };
  const inner = width - 2;
  const rows = [];
  rows.push(`${BOX_CHARS.tl}${BOX_CHARS.h.repeat(inner)}${BOX_CHARS.tr}`);
  if (title) {
    const t = ` ${title} `;
    const left = Math.floor((inner - t.length) / 2);
    const right = inner - left - t.length;
    rows.push(`${BOX_CHARS.v}${' '.repeat(left)}${t}${' '.repeat(right)}${BOX_CHARS.v}`);
    rows.push(`${BOX_CHARS.h}${'─'.repeat(inner)}${BOX_CHARS.h}`);
  }
  for (const line of lines) {
    const text = typeof line === 'string' ? line : (line.raw || JSON.stringify(line));
    const truncated = text.length > inner ? text.slice(0, inner - 1) + '…' : text;
    rows.push(`${BOX_CHARS.v} ${pad(truncated, inner - 1)}${BOX_CHARS.v}`);
  }
  rows.push(`${BOX_CHARS.bl}${BOX_CHARS.h.repeat(inner)}${BOX_CHARS.br}`);
  return rows.join('\n');
}

function djousseStyle(label, text, emoji = '✨') {
  const width = 38;
  const inner = width - 2;
  const rows = [];
  rows.push(`╭${'─'.repeat(inner)}╮`);
  rows.push(`│ ${emoji} *${label}*`);
  rows.push(`├${'─'.repeat(inner)}┤`);
  if (typeof text === 'string') {
    for (const line of text.split('\n')) {
      rows.push(`│ ${line}`);
    }
  }
  rows.push(`╰${'─'.repeat(inner)}╯`);
  return rows.join('\n');
}

function error(msg) {
  return `❌ *Erreur*\n${msg}`;
}

module.exports = box;
module.exports.box = box;
module.exports.djousseStyle = djousseStyle;
module.exports.error = error;
