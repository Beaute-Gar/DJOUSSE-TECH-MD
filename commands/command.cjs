/**
 * command.cjs — Compatibility layer
 * Allows KnightBot plugins using cmd() to work with DJOUSSE TECH command loader
 * Injects m.reply() and m.react() for backward compatibility
 */

const commandMap = new Map();
const duplicates = [];

function cmd(opts, handler) {
  const name = opts.pattern || opts.name;
  if (!name) return;

  // 🔍 Détection de doublons
  if (commandMap.has(name)) {
    const existing = commandMap.get(name);
    const msg = `⚠️ DOUBLON "${name}": ${existing.filename || 'inconnu'} → ${opts.filename || 'inconnu'}`;
    console.warn(msg);
    duplicates.push({ name, old: existing.filename, new: opts.filename });
  }

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
        // Injection reply/react sur msg
        const from = ctx.from || msg.key?.remoteJid;
        if (from && !msg.reply) {
          msg.reply = (text) => sock.sendMessage(from, { text }, { quoted: msg });
        }
        if (from && !msg.react) {
          msg.react = (emoji) => sock.sendMessage(from, { react: { text: emoji, key: msg.key } }).catch(() => {});
        }

        // Injection des propriétés
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
        if (!ctx.conn) ctx.conn = sock;

        // ✅ INJECTION STYLE HACKER GLOBAL
        const { boxWithFooter, FOOTER } = require('../lib/djousse-ui.cjs');

        // ✅ Wrapper reply : ajoute automatiquement le footer
        const originalReply = ctx.reply;
        ctx.reply = (text, mentions) => {
          let finalText = typeof text === 'string' ? text : String(text || '');

          // Ajouter le footer si absent
          if (!finalText.includes('ᴘᴏᴡᴇʀᴇᴅ ʙʏ')) {
            finalText += `\n> ${FOOTER}`;
          }

          // Si mentions fournies
          if (mentions) {
            return sock.sendMessage(from, { text: finalText, mentions }, { quoted: msg });
          }
          return originalReply(finalText);
        };

        // ✅ Wrapper m.reply : même chose
        const originalMsgReply = msg.reply;
        msg.reply = (text, chatId = from, options = {}) => {
          let finalText = typeof text === 'string' ? text : String(text || '');
          if (!finalText.includes('ᴘᴏᴡᴇʀᴇᴅ ʙʏ')) {
            finalText += `\n> ${FOOTER}`;
          }
          return sock.sendMessage(chatId, { text: finalText, ...options }, { quoted: msg });
        };

        const fullText = args.join(' ');
        ctx.q = fullText;
        await handler(sock, msg, args, ctx);
      } catch (e) {
        console.error(`[CMD] Error in ${name}:`, e.message);
        const from = ctx.from || msg.key?.remoteJid;
        if (from) {
          await sock.sendMessage(from, { text: `⚠️ *Erreur*\n\`[${e.message}]\`` }, { quoted: msg }).catch(() => {});
        }
      }
    }
  };

  commandMap.set(name, command);
  if (command.aliases.length) {
    command.aliases.forEach(a => {
      if (commandMap.has(a) && commandMap.get(a).name !== name) {
        console.warn(`⚠️ DOUBLON ALIAS "${a}": ${commandMap.get(a).filename || 'inconnu'} → ${opts.filename || 'inconnu'}`);
      }
      commandMap.set(a, command);
    });
  }
}

module.exports = { cmd, commandMap, duplicates };
