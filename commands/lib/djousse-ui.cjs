module.exports = {
  box: (title, items) => {
    let t = `\u256D\u2500\u2500\u2500\u2500\u2500\u3010 ${title} \u3011\u2500\u2500\u2500\u2500\u2500\u256E\n`;
    items.forEach(i => {
      if (i.blank) t += '\u2503\n';
      else t += `\u2503 ${i.label ? i.label+' : ' : ''}${i.value || i.raw || ''}\n`;
    });
    t += '\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500';
    return t;
  },
  truncate: (s, n) => s?.length > n ? s.slice(0, n) + '...' : s
};
