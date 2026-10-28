'use strict';

const fs = require('node:fs');
const path = require('node:path');

const captured = [];
const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
};

let handler;
try {
  console.log = (...args) => captured.push(args.map(String).join(' '));
  console.info = (...args) => captured.push(args.map(String).join(' '));
  console.warn = (...args) => captured.push(args.map(String).join(' '));
  handler = require('../src/handlers/handler');
} catch (error) {
  process.stderr.write(`Échec du chargement de src/handlers/handler.js : ${error.stack || error.message}\n`);
  if (captured.length) process.stderr.write(`${captured.join('\n')}\n`);
  process.exitCode = 1;
} finally {
  console.log = originalConsole.log;
  console.info = originalConsole.info;
  console.warn = originalConsole.warn;
}

if (handler && handler.commands instanceof Map) {
  const commands = handler.commands;
  const entries = new Set(commands.values());
  const byEntry = new Map();

  for (const [key, entry] of commands) {
    if (!byEntry.has(entry)) byEntry.set(entry, []);
    byEntry.get(entry).push(key);
  }

  const registryKeys = [...commands.keys()].sort().map((key) => {
    const entry = commands.get(key);
    const reachableKeys = byEntry.get(entry) || [];
    return {
      key,
      name: entry.name,
      aliases: reachableKeys.filter((registeredKey) => registeredKey !== entry.name).sort(),
      category: entry.cat,
      flags: {
        group: !!entry.group,
        admin: !!entry.admin,
        botAdmin: !!entry.botAdmin,
        owner: !!entry.owner,
        enabled: entry.enabled !== false,
        requiresInput: !!entry.requiresInput,
      },
      description: entry.desc || '',
    };
  });

  const byCategory = {};
  for (const entry of entries) {
    const category = String(entry.cat ?? 1);
    byCategory[category] = (byCategory[category] || 0) + 1;
  }

  const snapshot = {
    totalCommands: entries.size,
    totalRegistryKeys: commands.size,
    byCategory: Object.fromEntries(
      Object.entries(byCategory).sort(([a], [b]) => Number(a) - Number(b)),
    ),
    registryKeys,
  };
  const outputArgument = process.argv.indexOf('--output');
  if (outputArgument !== -1) {
    const outputPath = path.resolve(process.cwd(), process.argv[outputArgument + 1] || '');
    fs.writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
    process.stdout.write(`Snapshot enregistré : ${outputPath}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  }
} else if (!process.exitCode) {
  process.stderr.write('Le handler ne fournit pas de Map commands.\n');
  process.exitCode = 1;
}
