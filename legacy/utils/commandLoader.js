const fs = require('fs');
const path = require('path');
const { commandMap, duplicates } = require('../commands/command.cjs');

const loadCommands = () => {
  const commands = new Map();
  const commandsDir = path.join(__dirname, '..', 'commands');

  const categories = fs.readdirSync(commandsDir).filter(dir => {
    try {
      return fs.statSync(path.join(commandsDir, dir)).isDirectory();
    } catch { return false; }
  });

  // Étape 1 : require() tous les fichiers (déclenche les cmd() qui remplissent commandMap)
  for (const category of categories) {
    const categoryPath = path.join(commandsDir, category);
    const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.js') || f.endsWith('.cjs'));

    for (const file of files) {
      if (file === 'command.cjs') continue;
      try {
        require(path.join(categoryPath, file));
      } catch (e) {
        console.error(`[CMD] Erreur chargement ${file}: ${e.message}`);
      }
    }
  }

  // Étape 2 : Récupérer depuis commandMap (les doublons ont déjà été loggés par command.cjs)
  for (const [name, command] of commandMap) {
    if (!commands.has(name)) {
      commands.set(name, command);
    }
  }

  // Compter les commandes uniques (sans les alias)
  const uniqueCommands = new Set();
  for (const [name, command] of commands) {
    uniqueCommands.add(command.name || name);
  }

  console.log(`[CMD] ✅ ${uniqueCommands.size} commandes uniques chargées (${commands.size} entrées avec alias)`);
  return commands;
};

module.exports = { loadCommands };
