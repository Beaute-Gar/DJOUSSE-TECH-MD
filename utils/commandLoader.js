const fs = require('fs');
const path = require('path');

const loadCommands = () => {
  const commands = new Map();
  const commandsDir = path.join(__dirname, '..', 'commands');
  
  const categories = fs.readdirSync(commandsDir).filter(dir => {
    return fs.statSync(path.join(commandsDir, dir)).isDirectory();
  });
  
  for (const category of categories) {
    const categoryPath = path.join(commandsDir, category);
    const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.js'));
    
    for (const file of files) {
      try {
        const command = require(path.join(categoryPath, file));
        if (command.name) {
          commands.set(command.name, { ...command, category });
        }
        if (command.aliases && Array.isArray(command.aliases)) {
          for (const alias of command.aliases) {
            commands.set(alias, { ...command, category });
          }
        }
      } catch (e) {
        console.error(`Erreur chargement ${file}: ${e.message}`);
      }
    }
  }
  
  return commands;
};

module.exports = { loadCommands };