function box(title, lines, width = 40) {
  const inner = width - 2;
  const rows = [];
  rows.push(`╭${'─'.repeat(inner)}╮`);
  if (title) {
    const t = ` ${title} `;
    const left = Math.max(0, Math.floor((inner - t.length) / 2));
    const right = Math.max(0, inner - left - t.length);
    rows.push(`│${' '.repeat(left)}${t}${' '.repeat(right)}│`);
    rows.push(`├${'─'.repeat(inner)}┤`);
  }
  for (const line of lines) {
    let text;
    if (typeof line === 'string') {
      text = line;
    } else if (line.blank) {
      text = '';
    } else if (line.raw) {
      text = line.raw;
    } else if (line.label !== undefined && line.value !== undefined) {
      text = `${line.label}: ${line.value}`;
    } else if (line.cmd && line.desc) {
      text = `.${line.cmd} — ${line.desc}`;
    } else {
      text = JSON.stringify(line);
    }
    const truncated = text.length > inner ? text.slice(0, inner - 1) + '…' : text;
    rows.push(`│ ${truncated}${' '.repeat(Math.max(0, inner - 1 - truncated.length))}│`);
  }
  rows.push(`╰${'─'.repeat(inner)}╯`);
  return rows.join('\n');
}

function boxWithFooter(title, lines, footer, width = 40) {
  const inner = width - 2;
  const rows = [];
  rows.push(`╭${'─'.repeat(inner)}╮`);
  if (title) {
    const t = ` ${title} `;
    const left = Math.max(0, Math.floor((inner - t.length) / 2));
    const right = Math.max(0, inner - left - t.length);
    rows.push(`│${' '.repeat(left)}${t}${' '.repeat(right)}│`);
    rows.push(`├${'─'.repeat(inner)}┤`);
  }
  for (const line of lines) {
    let text;
    if (typeof line === 'string') {
      text = line;
    } else if (line.blank) {
      text = '';
    } else if (line.raw) {
      text = line.raw;
    } else if (line.label !== undefined && line.value !== undefined) {
      text = `${line.label}: ${line.value}`;
    } else if (line.cmd && line.desc) {
      text = `.${line.cmd} — ${line.desc}`;
    } else {
      text = JSON.stringify(line);
    }
    const truncated = text.length > inner ? text.slice(0, inner - 1) + '…' : text;
    rows.push(`│ ${truncated}${' '.repeat(Math.max(0, inner - 1 - truncated.length))}│`);
  }
  if (footer) {
    rows.push(`├${'─'.repeat(inner)}┤`);
    const ft = ` ${footer} `;
    const left = Math.max(0, Math.floor((inner - ft.length) / 2));
    const right = Math.max(0, inner - left - ft.length);
    rows.push(`│${' '.repeat(left)}${ft}${' '.repeat(right)}│`);
  }
  rows.push(`╰${'─'.repeat(inner)}╯`);
  return rows.join('\n');
}

function truncate(text, maxLen = 40) {
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text;
}

function uptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d > 0) parts.push(`${d}j`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

module.exports = { box, boxWithFooter, truncate, uptime };
