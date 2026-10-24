#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function option(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? null : process.argv[index + 1] || null;
}

const botRoot = path.resolve(option('--bot-root') || process.env.DJOUSSE_BOT_ROOT || process.cwd());
const websiteRoot = path.resolve(option('--website-root') || process.env.DJOUSSE_WEBSITE_ROOT || path.join(botRoot, 'website'));
const handlerPath = path.join(botRoot, 'handler.js');
const outputPath = path.join(websiteRoot, 'data', 'commands.json');

if (!fs.existsSync(handlerPath)) {
  console.error(`handler.js introuvable dans ${botRoot}. Lance le script depuis la racine du bot, ou passe --bot-root <dossier-bot>.`);
  process.exit(1);
}

let handler;
try {
  // Charger le registre en mémoire; index.js n’est pas importé et aucune connexion WhatsApp n’est lancée.
  handler = require(handlerPath);
} catch (error) {
  console.error(`Impossible de charger le registre du bot : ${error.message}`);
  console.error('Vérifie que les dépendances du dépôt sont installées (npm install) et que sa configuration locale est valide.');
  process.exit(1);
}

if (!(handler.commands instanceof Map) || !Array.isArray(handler.CATEGORIES)) {
  console.error('Le registre commands ou les catégories ne sont pas exportés par handler.js.');
  process.exit(1);
}

const unique = new Map();
for (const entry of handler.commands.values()) {
  if (!entry || typeof entry.name !== 'string' || !entry.name.trim()) continue;
  const name = entry.name.trim().toLowerCase();
  const category = Number(entry.cat) || 1;
  const access = entry.owner || category === 9 ? 'owner' : (entry.admin || entry.botAdmin) ? 'admin' : 'public';
  const aliases = Array.isArray(entry.aliases)
    ? [...new Set(entry.aliases.map((alias) => String(alias).trim().toLowerCase()).filter(Boolean))]
    : [];
  unique.set(name, {
    name,
    aliases,
    category,
    description: String(entry.desc || '').trim(),
    usage: String(entry.usage || '').trim(),
    access,
  });
}

const commands = [...unique.values()].sort((a, b) => a.category - b.category || a.name.localeCompare(b.name, 'fr'));
const categories = handler.CATEGORIES.map((category) => ({
  n: Number(category.n),
  name: String(category.label || '').toLocaleLowerCase('fr').replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase('fr')),
  icon: String(category.emoji || ''),
  count: commands.filter((command) => command.category === Number(category.n)).length,
}));

const payload = {
  partial: false,
  generatedFrom: 'handler.js',
  commands,
  categories,
  totals: {
    commands: commands.length,
    aliases: commands.reduce((sum, command) => sum + command.aliases.length, 0),
  },
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
const temporary = `${outputPath}.tmp`;
fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
fs.renameSync(temporary, outputPath);
console.log(`Catalogue régénéré : ${commands.length} commandes, ${payload.totals.aliases} alias → ${path.relative(websiteRoot, outputPath)}`);
