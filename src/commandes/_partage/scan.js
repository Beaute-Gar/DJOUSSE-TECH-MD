'use strict';

const fs = require('node:fs');
const path = require('node:path');

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
  return files.sort((a, b) => path.basename(a).localeCompare(path.basename(b)) || a.localeCompare(b));
}

function loadCommandPlugins(root) {
  const plugins = [];
  const rootPath = root || path.resolve(__dirname, '..');
  for (const filePath of scanCommandFiles(rootPath)) {
    let loaded;
    try {
      loaded = require(filePath);
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
