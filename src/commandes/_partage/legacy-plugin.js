'use strict';

const path = require('node:path');

const ORDER_MARKER = /^\/\/ @legacy-order (.+)$/m;

function parseLegacyOrder(source) {
  const marker = ORDER_MARKER.exec(source);
  if (!marker) return null;
  const metadata = JSON.parse(marker[1]);
  if (!metadata || typeof metadata.sourceFile !== 'string') {
    throw new Error('Legacy command wrapper has invalid source-order metadata.');
  }
  return metadata;
}

function resolveLegacyDefinition(plugin, pluginPath) {
  const metadata = plugin && plugin.__legacyCommand;
  if (!metadata) return plugin;
  if (!Array.isArray(metadata.names) || !metadata.names.length
      || typeof metadata.source !== 'string'
      || !Number.isInteger(metadata.definitionIndex)) {
    throw new Error(`Invalid legacy command wrapper: ${pluginPath}`);
  }

  const sourcePath = path.resolve(path.dirname(pluginPath), metadata.source);
  const source = require(sourcePath);
  const definitions = Array.isArray(source) ? source : [source];
  const definition = definitions[metadata.definitionIndex];
  if (!definition || typeof definition !== 'object') {
    throw new Error(`Legacy command definition ${metadata.definitionIndex} not found in ${sourcePath}`);
  }

  return {
    ...definition,
    commands: [...metadata.names],
    aliases: [],
    alias: [],
  };
}

module.exports = { parseLegacyOrder, resolveLegacyDefinition };
