const { cmd } = require('../command.cjs');
const rl = require('../lib/ratelimit.cjs');
const throttle = require('../lib/throttle.cjs');
const confirm = require('../lib/confirm.cjs');

cmd({ pattern: 'broadcast', desc: 'Diffuser un message a tous les groupes', category: 'communication', filename: __filename, fromMe: true }, async (conn, m, commands, config) => {
  const msg = m.body.split(' ').slice(1).join(' ');

  const bc = rl.hit('broadcast', 1, 60e3);
  if (bc.blocked) return m.reply("Diffusion déjà lancée il y a moins d'une minute.");

  if (!msg) return m.reply('Usage: .broadcast <message>');

  return confirm.prompt(conn, m, `Diffuser ce message vers TOUS les groupes ?\n\n${msg.length > 200 ? msg.slice(0, 200) + '…' : msg}`, async (conn, m) => {
    const groups = await conn.groupFetchAllParticipating();
    const ids = Object.keys(groups);
    let sent = 0;
    let failed = 0;

    conn.sendMessage(m.chat, { text: `📡 Diffusion vers ${ids.length} groupes...` }, { quoted: m });

    for (const id of ids) {
      try {
        const r = await throttle.throttledSend(conn, id, { text: `📢 *BROADCAST* 📢\n\n${msg}\n\n> DJOUSSE TECH` });
        if (r.ok) sent++;
        else failed++;
      } catch {
        failed++;
      }
    }

    conn.sendMessage(m.chat, { text: `✅ Diffusion terminée\n📨 Envoyé: ${sent} groupes\n❌ Échec: ${failed}` }, { quoted: m });
  });
});