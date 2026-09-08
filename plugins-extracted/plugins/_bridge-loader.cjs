const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { cmd } = require('../command.cjs');

const COMMANDS_DIR = path.join(__dirname, '..', 'src', 'commands');

function extractText(m) {
  return m.body || m.message?.conversation || m.message?.extendedTextMessage?.text || '';
}

function extractArgs(m) {
  const body = extractText(m);
  const parts = body.trim().split(/\s+/);
  return parts.slice(1);
}

async function loadAllEsmCommands() {
  const files = fs.readdirSync(COMMANDS_DIR)
    .filter(f => f.endsWith('.js') && !f.startsWith('_'));

  const PLUGINS_DIR = path.join(__dirname);
  const nativePlugins = new Set(
    fs.readdirSync(PLUGINS_DIR)
      .filter(f => f.endsWith('.cjs') && f !== '_bridge-loader.cjs')
      .map(f => f.replace('.cjs', ''))
  );

  let loaded = 0;
  let failed = 0;
  let skipped = 0;

  for (const file of files) {
    const filePath = path.join(COMMANDS_DIR, file);
    try {
      const mod = await import(pathToFileURL(filePath).href);
      const name = mod.name || file.replace('.js', '');
      const aliases = mod.aliases || [];
      const description = mod.description || '';
      const category = mod.category || 'misc';
      const handler = mod.handler || mod.default;
      if (typeof handler !== 'function') { failed++; continue; }

      /* Skip if native DJOUSSE-TECH plugin already exists */
      if (nativePlugins.has(name)) { skipped++; continue; }

      cmd({
        pattern: name,
        aliases,
        desc: description,
        category,
        filename: filePath,
      }, async (conn, m, commands, config) => {
        try {
          const text = extractText(m);
          const args = extractArgs(m);
          const prefix = config.PREFIX || '.';
          const jid = m.chat || m.key?.remoteJid || '';
          const sender = m.sender || '';
          const isOwner = config.BOT_OWNER && (sender.includes(config.BOT_OWNER));
          const reply = (msg) => conn.sendMessage(jid, { text: String(msg) }, { quoted: m });
          await handler(conn, m, {
            text, args, prefix, reply, jid, sender, senderJid: sender,
            isOwner, config, m, sock: conn, body: m.body,
            startTime: Date.now(), command: name,
            cleanText: text, isGroup: !!m.isGroup,
            isGroupAdmin: false, botIsAdmin: false, pushName: m.pushName || '',
          });
        } catch (e) {
          console.error('  Handler error', name, e.message);
          await conn.sendMessage(m.chat || m.key?.remoteJid, { text: 'Erreur: ' + e.message }).catch(() => {});
        }
      });
      loaded++;
    } catch (e) {
      console.log('  Load error', file, e.message);
      failed++;
    }
  }
  console.log('Bridge: ' + loaded + ' OK' + (skipped ? ', ' + skipped + ' skip (natifs)' : '') + (failed ? ', ' + failed + ' echecs' : ''));
}

loadAllEsmCommands().catch(e => console.error('Bridge error:', e));

module.exports = {};
