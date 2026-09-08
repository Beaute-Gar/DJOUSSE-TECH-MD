const { cmd } = require('../command.cjs');

/* img2sticker.cjs — Envoie des stickers waifu/animés aléatoires via waifu.pics */

const stickerCmds = [
  'cry', 'kiss', 'kill', 'kick', 'hug', 'pat', 'lick', 'bite', 'yeet',
  'bully', 'bonk', 'wink', 'poke', 'nom', 'slap', 'smile', 'wave',
  'awoo', 'blush', 'smug', 'dance', 'happy', 'sad', 'cringe', 'cuddle',
  'shinobu', 'handhold', 'glomp', 'highfive',
];

for (const cmdName of stickerCmds) {
  cmd({
    pattern: cmdName,
    react: '🏷️',
    desc: 'Sticker animé : ' + cmdName,
    category: 'anime',
    filename: __filename,
  }, async (conn, m, commands, { from, reply }) => {
    try {
      const res = await fetch('https://api.waifu.pics/sfw/' + cmdName);
      const data = await res.json();
      if (!data || !data.url) return reply('❌ Erreur lors du chargement.');
      await conn.sendMessage(from, {
        sticker: Buffer.from(await (await fetch(data.url)).arrayBuffer()),
      }, { quoted: m });
      await m.react('✅').catch(() => {});
    } catch (e) {
      await m.react('❌').catch(() => {});
      reply('❌ Erreur: ' + e.message);
    }
  });
}
