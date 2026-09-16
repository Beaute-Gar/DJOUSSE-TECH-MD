/**
 * command.cjs — Compatibility layer
 * Allows KnightBot plugins using cmd() to work with DJOUSSE TECH command loader
 * Injects m.reply() and m.react() for backward compatibility
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
        // Inject reply/react on msg for commands using m.reply()
        const from = ctx.from || msg.key?.remoteJid;
        if (from && !msg.reply) {
          msg.reply = (text) => sock.sendMessage(from, { text }, { quoted: msg });
        }
        if (from && !msg.react) {
          msg.react = (emoji) => sock.sendMessage(from, { react: { text: emoji, key: msg.key } }).catch(() => {});
        }
        // Inject common properties on m for KnightBot-style commands
        if (!msg.chat) msg.chat = from;
        if (!msg.sender) msg.sender = ctx.sender || msg.key?.participant || msg.key?.remoteJid;
        if (!msg.isGroup) msg.isGroup = ctx.isGroup || false;
        if (!msg.isOwner) msg.isOwner = ctx.isOwner || false;
        if (!msg.isAdmin) msg.isAdmin = ctx.isAdmin || false;
        if (!msg.isMod) msg.isMod = ctx.isMod || false;
        if (!msg.isBotAdmin) msg.isBotAdmin = ctx.isBotAdmin || false;
        if (!msg.body) msg.body = args?.join?.(' ') || '';
        if (!msg.text) msg.text = args?.join?.(' ') || '';
        if (!msg.quoted) msg.quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
        // Inject conn in ctx for KnightBot-style commands using ctx.conn
        if (!ctx.conn) ctx.conn = sock;

        const fullText = args.join(' ');
        ctx.q = fullText;
        await handler(sock, msg, args, ctx);
      } catch (e) {
        console.error(`[CMD] Error in ${name}:`, e.message);
        const from = ctx.from || msg.key?.remoteJid;
        if (from) {
          await sock.sendMessage(from, { text: `⚠️ *Erreur robot*\n\`[${e.message}]\`` }, { quoted: msg }).catch(() => {});
        }
      }
    }
  };

  commandMap.set(name, command);
  if (command.aliases.length) {
    command.aliases.forEach(a => commandMap.set(a, command));
  }
}

module.exports = { cmd, commandMap };
