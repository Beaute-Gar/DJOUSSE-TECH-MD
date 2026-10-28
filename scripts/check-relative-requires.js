'use strict';

const fs = require('node:fs');
const path = require('node:path');

const sourceRoot = path.resolve(__dirname, '..', 'src');
const failures = [];

function skipQuoted(source, start, quote) {
  let index = start + 1;
  while (index < source.length) {
    if (source[index] === '\\') {
      index += 2;
      continue;
    }
    if (source[index] === quote) return index + 1;
    index += 1;
  }
  return source.length;
}

function lineAt(source, index) {
  let line = 1;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (source[cursor] === '\n') line += 1;
  }
  return line;
}

function relativeRequires(source) {
  const found = [];
  let index = 0;
  while (index < source.length) {
    if (source.startsWith('//', index)) {
      const end = source.indexOf('\n', index + 2);
      index = end === -1 ? source.length : end + 1;
      continue;
    }
    if (source.startsWith('/*', index)) {
      const end = source.indexOf('*/', index + 2);
      index = end === -1 ? source.length : end + 2;
      continue;
    }
    if (source[index] === '\'' || source[index] === '"') {
      index = skipQuoted(source, index, source[index]);
      continue;
    }
    if (source[index] === '`') {
      index = skipQuoted(source, index, '`');
      continue;
    }

    if (!source.startsWith('require', index)
      || /[\w$]/.test(source[index - 1] || '')
      || /[\w$]/.test(source[index + 7] || '')) {
      index += 1;
      continue;
    }

    let cursor = index + 7;
    while (/\s/.test(source[cursor] || '')) cursor += 1;
    if (source[cursor] !== '(') {
      index += 7;
      continue;
    }
    cursor += 1;
    while (/\s/.test(source[cursor] || '')) cursor += 1;
    const quote = source[cursor];
    if (quote !== '\'' && quote !== '"') {
      index += 7;
      continue;
    }

    const end = skipQuoted(source, cursor, quote);
    if (end === source.length && source[end - 1] !== quote) {
      index += 7;
      continue;
    }
    const specifier = source.slice(cursor + 1, end - 1);
    cursor = end;
    while (/\s/.test(source[cursor] || '')) cursor += 1;
    if (source[cursor] === ')' && specifier.startsWith('.')) {
      found.push({ specifier, index });
    }
    index = end;
  }
  return found;
}

function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(filePath);
    else if (entry.isFile() && entry.name.endsWith('.js')) {
      const source = fs.readFileSync(filePath, 'utf8');
      for (const call of relativeRequires(source)) {
        try {
          require.resolve(call.specifier, { paths: [path.dirname(filePath)] });
        } catch {
          failures.push({
            file: path.relative(path.dirname(sourceRoot), filePath).replace(/\\/g, '/'),
            line: lineAt(source, call.index),
            specifier: call.specifier,
          });
        }
      }
    }
  }
}

visit(sourceRoot);
if (failures.length) {
  for (const failure of failures) {
    process.stderr.write(`${failure.file}:${failure.line} -> ${failure.specifier}\n`);
  }
  process.stderr.write(`Unresolved relative requires: ${failures.length}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('All literal relative requires under src/ resolve.\n');
}
