import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const pluginsDir = join('C:\\Users\\DJOUSSSE\\Downloads\\Compressed\\DJOUSSE-TECH-MD', 'plugins');
const files = readdirSync(pluginsDir).filter(f => f.endsWith('.cjs'));
const results = [];

for (const file of files) {
  const code = readFileSync(join(pluginsDir, file), 'utf8');
  const cmdMatch = code.match(/cmd\s*\(\s*['"`]([\w-]+)['"`]/);
  const lines = code.split('\n').filter(l => l.trim() && !l.trim().startsWith('//') && !l.trim().startsWith('/*'));
  const replyLine = lines.find(l => l.includes('reply(') || l.includes('send(') || l.includes('.reply') || l.includes('.send'));
  
  results.push({
    file,
    command: cmdMatch ? cmdMatch[1] : file.replace('.cjs',''),
    code: lines.slice(0, 15).join('\n').substring(0, 300)
  });
}

results.sort((a,b) => a.command.localeCompare(b.command));
for (const r of results) {
  console.log('=== .' + r.command + ' ===');
  console.log(r.code.substring(0, 200));
  console.log('');
}
