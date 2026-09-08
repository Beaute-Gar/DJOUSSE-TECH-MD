const { cmd } = require('../command.cjs');
const { box, truncate } = require('../lib/djousse-ui.cjs');

/* ═══════════════════════════════════════════════════════════════════════════
   RECONNAISSANCE MUSICALE + RECHERCHE
   Musique : AudD.io — a un vrai plan GRATUIT (clé requise, quota limité),
             contrairement à ACRCloud (uniquement payant). Plus honnête que
             de prétendre offrir Shazam gratuitement sans aucune clé.
   Recherche : DuckDuckGo Instant Answer API — gratuite, sans clé, mais
             moins riche que Google (pas de "top 10 liens" classiques,
             plutôt des réponses factuelles/définitions). Je le dis
             clairement dans l'aide de la commande plutôt que de survendre.
   ═══════════════════════════════════════════════════════════════════════════ */

cmd({
  pattern: 'shazam',
  alias: ['identifysong', 'quellemusique'],
  react: '🎧',
  desc: 'Identifier une musique à partir d\'un extrait audio/vidéo',
  category: 'tools',
  filename: __filename,
}, async (conn, m, commands, { reply }) => {
  const key = process.env.AUDD_API_KEY;
  if (!key) {
    return reply(box('🎧 *SHAZAM*', [
      { raw: 'AUDD_API_KEY non configurée.' },
      { label: 'Clé gratuite', value: 'https://dashboard.audd.io/ (quota limité, gratuit)' },
    ]));
  }
  const target = m.quoted?.type === 'audioMessage' || m.quoted?.type === 'videoMessage' ? m.quoted : (m.type === 'audioMessage' || m.type === 'videoMessage' ? m : null);
  if (!target) {
    return reply(box('🎧 *SHAZAM*', [
      { raw: 'Réponds (quote) à un message audio ou vidéo contenant la musique avec .shazam' },
    ]));
  }
  try {
    await m.react('🕐').catch(() => {});
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
    reply(box('🎧 *MUSIQUE IDENTIFIÉE*', [
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

cmd({
  pattern: 'recherche',
  alias: ['search', 'ddg'],
  react: '🔎',
  desc: 'Rechercher une information sur le web (DuckDuckGo)',
  category: 'tools',
  filename: __filename,
}, async (conn, m, commands, { q, reply }) => {
  if (!q) {
    return reply(box('🔎 *RECHERCHE WEB*', [
      { label: 'Utilisation', value: '.recherche <question>' },
      { raw: '_Fonctionne mieux pour des faits/définitions que pour "les 10 meilleurs sites de X" (pas de Google officiel gratuit)._' },
    ]));
  }
  try {
    const res = await fetch('https://api.duckduckgo.com/?q=' + encodeURIComponent(q) + '&format=json&no_html=1&skip_disambig=1', { signal: AbortSignal.timeout(15000) });
    const data = await res.json();
    const abstract = data.AbstractText || data.Answer || data.Definition;
    if (!abstract) {
      const related = (data.RelatedTopics || []).filter(t => t.Text).slice(0, 5);
      if (!related.length) return reply('❌ Aucun résultat direct trouvé pour "' + q + '". Essaie une formulation plus factuelle (ex: "capitale du Cameroun" plutôt que "meilleurs restaurants").');
      return reply(box('🔎 *PISTES LIÉES*', related.map(t => ({ raw: '• ' + truncate(t.Text, 150) }))));
    }
    reply(box('🔎 *RÉSULTAT*', [
      { raw: abstract },
      data.AbstractURL ? { label: 'Source', value: data.AbstractURL } : { raw: '' },
    ]));
  } catch (e) {
    reply(box('❌ *ERREUR*', [{ raw: truncate(e.message, 200) }]));
  }
});
