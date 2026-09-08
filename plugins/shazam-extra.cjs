const { cmd } = require('../command.cjs');
const { box, truncate } = require('../lib/djousse-ui.cjs');

/* ═══════════════════════════════════════════════════════════════════════════
   MUSIC IDENTIFICATION (extra)
   Uses audd.io free tier (100 req/day) instead of acrcloud (paid).
   Requires AUDD_API_KEY env var.
   ═══════════════════════════════════════════════════════════════════════════ */

cmd({
  pattern: 'hansfind',
  alias: ['whatmusic'],
  react: '🔍',
  desc: 'Identifier une musique à partir d\'un audio/vidéo',
  category: 'media',
  filename: __filename,
}, async (conn, m, commands, { from, reply }) => {
  const key = process.env.AUDD_API_KEY;
  if (!key) {
    return reply(box('🔍 *IDENTIFICATION MUSIQUE*', [
      { raw: 'AUDD_API_KEY non configurée.' },
      { label: 'Clé gratuite', value: 'https://dashboard.audd.io/ (100 requêtes/jour gratuites)' },
    ]));
  }
  const target = m.quoted?.type === 'audioMessage' || m.quoted?.type === 'videoMessage' ? m.quoted : (m.type === 'audioMessage' || m.type === 'videoMessage' ? m : null);
  if (!target) return reply('❌ Réponds (quote) à un message audio ou vidéo contenant la musique avec .hansfind');

  try {
    await m.react('🔍').catch(() => {});
    reply('⏳ Identification en cours...');
    const buffer = await target.download();
    if (!buffer) throw new Error('Téléchargement du média impossible.');

    const form = new FormData();
    form.append('api_token', key);
    form.append('file', new Blob([buffer]), 'audio.mp3');
    form.append('return', 'apple_music,spotify');

    const res = await fetch('https://api.audd.io/', { method: 'POST', body: form, signal: AbortSignal.timeout(30000) });
    const data = await res.json();
    if (data.status !== 'success' || !data.result) {
      await m.react('❌').catch(() => {});
      return reply('❌ Musique non reconnue — essaie un extrait plus long ou avec moins de bruit de fond.');
    }
    const r = data.result;
    await m.react('✅').catch(() => {});
    reply(box('🎵 *MUSIQUE IDENTIFIÉE*', [
      { label: 'Titre', value: r.title },
      { label: 'Artiste', value: r.artist },
      { label: 'Album', value: r.album || 'N/A' },
      { label: 'Sortie', value: r.release_date || 'N/A' },
      r.spotify?.external_urls?.spotify ? { label: 'Spotify', value: r.spotify.external_urls.spotify } : { raw: '' },
    ]));
  } catch (e) {
    await m.react('❌').catch(() => {});
    reply(box('❌ *ERREUR*', [{ raw: truncate(e.message, 200) }]));
  }
});
