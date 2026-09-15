/**
 * command.cjs — Compatibility layer
 * Allows KnightBot plugins using cmd() to work with DJOUSSE TECH command loader
 */

const commandMap = new Map();

function cmd(opts, handler) {
  const name = opts.pattern || opts.name;
  if (!name) return;

  const command = {
    name: name,
    aliases: opts.alias || opts.aliases || [],
    category: opts.category || 'general',
    desc: opts.desc || '',
    fromMe: opts.fromMe || false,
    onlyGroup: opts.onlyGroup || false,
    admin: opts.admin || false,
    botAdmin: opts.botAdmin || false,
    on: opts.on || null,
    filename: opts.filename || '',
    execute: async (sock, msg, args, ctx) => {
      try {
        await handler(sock, msg, { args, ...ctx });
      } catch (e) {
        console.error(`[CMD] Error in ${name}:`, e.message);
        await msg.reply?.(`⚠️ *Erreur robot*\n\`[${e.message}]\``);
      }
    }
  };

  commandMap.set(name, command);
  if (command.aliases.length) {
    command.aliases.forEach(a => commandMap.set(a, command));
  }
}

module.exports = { cmd, commandMap };
