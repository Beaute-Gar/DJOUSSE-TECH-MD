const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', 'commands');
const out = [];
function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    let st;
    try { st = fs.statSync(p); } catch { continue; }
    if (st.isDirectory()) {
      if (f === 'node_modules') continue;
      walk(p);
    } else if (/\.(js|cjs)$/.test(f)) {
      const src = fs.readFileSync(p, 'utf8');
      const re = /cmd\(\s*\{([\s\S]*?)\}\s*,/g;
      let m;
      while ((m = re.exec(src))) {
        const body = m[1];
        const hasP = /pattern\s*:/.test(body);
        const hasN = /\bname\s*:/.test(body);
        const hasF = /\bfilter\s*:/.test(body);
        const on = body.match(/on\s*:\s*'([^']+)'/);
        const line = src.slice(0, m.index).split('\n').length;
        const rel = p.slice(root.length + 1);
        if (!hasP && !hasN) {
          out.push(`NOPATTERN ${rel}:${line} filter=${hasF} on=${on ? on[1] : '-'}`);
        } else {
          const pt = body.match(/pattern\s*:\s*['"`]([^'"`]+)['"`]/);
          if (pt && pt[1].includes('|')) out.push(`PIPE ${rel}:${line} => ${pt[1]}`);
          if (pt && /[A-Z]/.test(pt[1])) out.push(`UPPER ${rel}:${line} => ${pt[1]}`);
        }
      }
    }
  }
}
walk(root);
console.log(out.join('\n'));
