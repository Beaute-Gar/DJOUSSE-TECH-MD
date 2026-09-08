const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const SRC = path.join(__dirname, '..', 'src', 'commands');
const DEST = path.join(__dirname, '..', 'plugins');
const cmd = require('../command.cjs');

function smsEscape(str) {
  if (!str) return '';
  return str.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$').replace(/"/g, '\\"');
}

async function convert() {
  const files = fs.readdirSync(SRC).filter(f => f.endsWith('.js') && !f.startsWith('_'));
  let ok = 0, fail = 0;

  for (const file of files) {
    const filePath = path.join(SRC, file);
    const name = file.replace('.js', '');

    try {
      const mod = await import(pathToFileURL(filePath).href + '?t=' + Date.now());
      const pattern = mod.name || name;
      const aliases = mod.aliases || [];
      const desc = mod.description || '';
      const category = mod.category || 'misc';
      const handler = mod.handler || mod.default;

      if (typeof handler !== 'function') {
        console.log(`  ⏭️  ${file}: no handler`);
        fail++;
        continue;
      }

      const cjsPath = path.join(DEST, name + '.cjs');
      const safeDesc = smsEscape(desc);
      const aliasStr = JSON.stringify(aliases);

      const code = `const { cmd } = require('../command.cjs');
const { pathToFileURL } = require('url');

cmd({
    pattern: '${pattern}',
    aliases: ${aliasStr},
    desc: '${safeDesc}',
    category: '${category}',
    filename: __filename,
}, async (conn, m, commands, config) => {
    try {
        const mod = await import(pathToFileURL('${filePath.replace(/\\/g, '/')}').href + '?t=' + Date.now());
        const handler = mod.handler || mod.default;
        if (typeof handler !== 'function') return;

        const text = m.body || m.message?.conversation || m.message?.extendedTextMessage?.text || '';
        const args = text.trim().split(/\\s+/).slice(1);
        const jid = m.chat || m.key?.remoteJid || '';
        const sender = m.sender || '';
        const prefix = config.PREFIX || '.';
        const isOwner = config.BOT_OWNER && (sender.includes(config.BOT_OWNER));
        const reply = (msg) => conn.sendMessage(jid, { text: String(msg) }, { quoted: m });

        await handler(conn, m, {
            text, args, prefix, reply, jid, sender, senderJid: sender,
            isOwner, config, m, sock: conn, body: m.body,
            startTime: Date.now(), command: '${pattern}',
            cleanText: text, isGroup: !!m.isGroup,
            isGroupAdmin: false, botIsAdmin: false, pushName: m.pushName || '',
        });
    } catch (e) {
        console.error('  ❌', '${pattern}', e.message);
        await conn.sendMessage(m.chat || m.key?.remoteJid, { text: '❌ Erreur: ' + e.message }).catch(() => {});
    }
});
`;

      const oldPath = path.join(DEST, name + '.cjs');
      if (fs.existsSync(oldPath)) {
        const oldCode = fs.readFileSync(oldPath, 'utf-8');
        if (oldCode.startsWith('const { cmd }') && !oldCode.includes("pathToFileURL('" + filePath.replace(/\\/g, '/') + "')")) {
          console.log(`  ⏭️  ${name}.cjs (deja natif, preserve)`);
          continue;
        }
      }

      fs.writeFileSync(cjsPath, code);
      ok++;
      console.log(`  ✅ ${name}.cjs`);
    } catch (e) {
      console.log(`  ❌ ${file}: ${e.message}`);
      fail++;
    }
  }

  console.log(`\n📊 ${ok} plugins DJOUSSE-TECH générés, ${fail} échecs`);

  /* Post-generation: remove ?t= cache busting from generated files */
  const generated = fs.readdirSync(DEST).filter(f => f.endsWith('.cjs') && !['menu.cjs', 'total.cjs'].includes(f));
  let fixed = 0;
  for (const f of generated) {
    const fp = path.join(DEST, f);
    const code = fs.readFileSync(fp, 'utf-8');
    const fixedCode = code.replace(/\?t=\s*\+\s*Date\.now\(\)/g, '');
    if (fixedCode !== code) {
      fs.writeFileSync(fp, fixedCode);
      fixed++;
    }
  }
  console.log(`  🔧 ${fixed} fichiers optimises (cache-busting supprime)`);
}

convert().catch(e => console.error('Convert error:', e));
