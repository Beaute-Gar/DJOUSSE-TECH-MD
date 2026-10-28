'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseLegacyOrder, resolveLegacyDefinition } = require('./legacy-plugin');

function scanCommandFiles(root = path.resolve(__dirname, '..')) {
  const files = [];

  function visit(directory) {
    const entries = fs.readdirSync(directory, { withFileTypes: true })
      .filter((entry) => !entry.name.startsWith('_'))
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(filePath);
      else if (entry.isFile() && entry.name.endsWith('.js')) files.push(filePath);
    }
  }

  visit(root);
  const orderByFile = new Map();
  // Wrappers keep the original file/definition order to preserve collisions.
  for (const filePath of files) {
    const source = fs.readFileSync(filePath, 'utf8');
    const metadata = parseLegacyOrder(source);
    orderByFile.set(filePath, metadata || {
      sourceFile: path.relative(root, filePath).split(path.sep).join('/'),
    });
  }
  return files.sort((a, b) => {
    const left = orderByFile.get(a);
    const right = orderByFile.get(b);
    const sourceOrder = path.basename(left.sourceFile).localeCompare(path.basename(right.sourceFile))
      || left.sourceFile.localeCompare(right.sourceFile);
    if (sourceOrder) return sourceOrder;
    const definitionOrder = (left.definitionIndex ?? -1) - (right.definitionIndex ?? -1);
    return definitionOrder || (left.entryOrder ?? -1) - (right.entryOrder ?? -1) || a.localeCompare(b);
  });
}

function loadCommandPlugins(root) {
  const plugins = [];
  const rootPath = root || path.resolve(__dirname, '..');
  for (const filePath of scanCommandFiles(rootPath)) {
    let loaded;
    try {
      loaded = resolveLegacyDefinition(require(filePath), filePath);
    } catch (error) {
      console.error(`[COMMAND SCAN] ${path.relative(rootPath, filePath)}: ${error.message}`);
      continue;
    }

    if (loaded?.maison) continue;
    const definitions = Array.isArray(loaded) ? loaded : [loaded];
    for (const definition of definitions) {
      if (definition && typeof definition === 'object' && Array.isArray(definition.commands)) {
        plugins.push(definition);
      }
    }
  }
  return plugins;
}

module.exports = { scanCommandFiles, loadCommandPlugins };
