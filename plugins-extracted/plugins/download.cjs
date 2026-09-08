const { cmd } = require('../command.cjs');
const { box, truncate } = require('../lib/djousse-ui.cjs');

/* ═══════════════════════════════════════════════════════════════════════════
   TÉLÉCHARGEMENT — YouTube / TikTok / Facebook
   YouTube  : @distube/ytdl-core (bibliothèque open-source active, pas de clé)
   TikTok   : tikwm.com — API publique gratuite, utilisée depuis des années
              dans l'écosystème des bots WhatsApp, stable en pratique.
   Facebook : AUCUNE API officielle gratuite n'existe. Meta ne fournit pas de
              moyen légitime de télécharger une vidéo publique par API sans
              scraping fragile. Implémenté en best-effort via un point de
              terminaison public connu, avec message d'erreur clair si ça
              casse — plutôt que de prétendre que c'est fiable.
   ═══════════════════════════════════════════════════════════════════════════ */

cmd({
  pattern: 'ytmp3',
  alias: ['ytaudio'],
  react: '🎵',
  desc: 'Télécharger l\'audio d\'une vidéo YouTube',
  category: 'download',
  filename: __filename,
}, async (conn, m, commands, { q, reply }) => {
  if (!q || !/youtu(\.be|be\.com)/.test(q)) {
    return reply(box('🎵 *YOUTUBE MP3*', [{ label: 'Utilisation', value: '.ytmp3 <lien YouTube>' }]));
  }
  try {
    const ytdl = require('@distube/ytdl-core');
    if (!ytdl.validateURL(q)) return reply('❌ Lien YouTube invalide.');
    const info = await ytdl.getInfo(q);
    const title = info.videoDetails.title;
    const durationSec = parseInt(info.videoDetails.lengthSeconds, 10);
    if (durationSec > 1800) return reply('❌ Vidéo trop longue (max 30 minutes) pour éviter de saturer le serveur.');

    await m.react('🕐').catch(() => {});
    const stream = ytdl(q, { filter: 'audioonly', quality: 'highestaudio' });
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    await conn.sendMessage(m.chat, {
      audio: buffer,
      mimetype: 'audio/mpeg',
      fileName: truncate(title, 60) + '.mp3',
    }, { quoted: m });
    await m.react('✅').catch(() => {});
  } catch (e) {
    await m.react('❌').catch(() => {});
    reply(box('❌ *ERREUR*', [{ raw: truncate(e.message, 200) }, { raw: '_YouTube modifie régulièrement son fonctionnement interne — si ça persiste, la bibliothèque devra être mise à jour (npm update @distube/ytdl-core)._' }]));
  }
});

cmd({
  pattern: 'ytmp4',
  alias: ['ytvideo'],
  react: '🎬',
  desc: 'Télécharger une vidéo YouTube',
  category: 'download',
  filename: __filename,
}, async (conn, m, commands, { q, reply }) => {
  if (!q || !/youtu(\.be|be\.com)/.test(q)) {
    return reply(box('🎬 *YOUTUBE MP4*', [{ label: 'Utilisation', value: '.ytmp4 <lien YouTube>' }]));
  }
  try {
    const ytdl = require('@distube/ytdl-core');
    if (!ytdl.validateURL(q)) return reply('❌ Lien YouTube invalide.');
    const info = await ytdl.getInfo(q);
    const durationSec = parseInt(info.videoDetails.lengthSeconds, 10);
    if (durationSec > 900) return reply('❌ Vidéo trop longue (max 15 minutes en vidéo, la taille grossit vite).');

    await m.react('🕐').catch(() => {});
    const format = ytdl.chooseFormat(info.formats, { quality: '18' }); // 360p — équilibre taille/qualité pour WhatsApp
    const stream = ytdl(q, { format });
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    await conn.sendMessage(m.chat, { video: buffer, caption: truncate(info.videoDetails.title, 200) }, { quoted: m });
    await m.react('✅').catch(() => {});
  } catch (e) {
    await m.react('❌').catch(() => {});
    reply(box('❌ *ERREUR*', [{ raw: truncate(e.message, 200) }]));
  }
});

cmd({
  pattern: 'tiktok',
  alias: ['tt', 'ttdl'],
  react: '📱',
  desc: 'Télécharger une vidéo TikTok sans filigrane',
  category: 'download',
  filename: __filename,
}, async (conn, m, commands, { q, reply }) => {
  if (!q || !/tiktok\.com/.test(q)) {
    return reply(box('📱 *TIKTOK*', [{ label: 'Utilisation', value: '.tiktok <lien TikTok>' }]));
  }
  try {
    await m.react('🕐').catch(() => {});
    const res = await fetch('https://www.tikwm.com/api/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'url=' + encodeURIComponent(q) + '&hd=1',
      signal: AbortSignal.timeout(20000),
    });
    const data = await res.json();
    if (data.code !== 0 || !data.data?.play) throw new Error(data.msg || 'Vidéo introuvable ou privée.');

    const videoRes = await fetch(data.data.play, { signal: AbortSignal.timeout(30000) });
    const buffer = Buffer.from(await videoRes.arrayBuffer());

    await conn.sendMessage(m.chat, { video: buffer, caption: truncate(data.data.title || '', 200) + '\n\n_Sans filigrane_' }, { quoted: m });
    await m.react('✅').catch(() => {});
  } catch (e) {
    await m.react('❌').catch(() => {});
    reply(box('❌ *ERREUR*', [{ raw: truncate(e.message, 200) }]));
  }
});

cmd({
  pattern: 'fbdl',
  alias: ['facebook'],
  react: '📘',
  desc: 'Télécharger une vidéo Facebook publique (meilleur effort — aucune API officielle gratuite n\'existe)',
  category: 'download',
  filename: __filename,
}, async (conn, m, commands, { q, reply }) => {
  if (!q || !/facebook\.com|fb\.watch/.test(q)) {
    return reply(box('📘 *FACEBOOK*', [
      { label: 'Utilisation', value: '.fbdl <lien Facebook>' },
      { raw: '_Ne fonctionne que sur des vidéos PUBLIQUES._' },
    ]));
  }
  try {
    await m.react('🕐').catch(() => {});
    const res = await fetch('https://api.cobalt.tools/api/json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ url: q }),
      signal: AbortSignal.timeout(20000),
    });
    const data = await res.json();
    if (!data.url) throw new Error(data.text || 'Extraction impossible (vidéo privée, supprimée, ou service indisponible).');

    const videoRes = await fetch(data.url, { signal: AbortSignal.timeout(30000) });
    const buffer = Buffer.from(await videoRes.arrayBuffer());
    await conn.sendMessage(m.chat, { video: buffer }, { quoted: m });
    await m.react('✅').catch(() => {});
  } catch (e) {
    await m.react('❌').catch(() => {});
    reply(box('❌ *ÉCHEC*', [
      { raw: truncate(e.message, 200) },
      { raw: '_Facebook ne propose aucune API gratuite officielle — cette commande dépend d\'un service tiers qui peut être instable._' },
    ]));
  }
});
