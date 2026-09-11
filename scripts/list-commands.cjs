const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'plugins');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.cjs') && !f.startsWith('_'));

const cmds = [];

for (const f of files) {
    const content = fs.readFileSync(path.join(dir, f), 'utf8');
    const patternRe = /pattern:\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = patternRe.exec(content)) !== null) {
        cmds.push(m[1]);
    }
}

const unique = [...new Set(cmds)].sort();
unique.forEach(c => console.log('.' + c));
console.log('\n--- Total unique: ' + unique.length + ' ---');
