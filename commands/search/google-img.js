const { cmd } = require('../command.cjs');
const { boxWithFooter } = require('../lib/djousse-ui.cjs');
const axios = require('axios');

// Recherche web locale via llm-search (sans clé API)
let llmSearch = null;
try { llmSearch = require('llm-search'); } catch (_) {}

cmd({
  pattern: 'img',
  alias: ['googleimg', 'gimg', 'searchimg'],
  desc: 'Recherche Google Image',
  category: 'search',
  filename: __filename,
}, async (conn, m, args, { reply, react }) => {
  const query = args.join(' ').trim();
  if (!query) {
    return reply(boxWithFooter('🔍 Google Image', [
      { raw: '❌ Tapez un mot-clé pour rechercher.' },
      { raw: 'Ex: .img paysage montagne' },
    ]));
  }

  try {
    await react('🕐');

    // Méthode 1 : API externe
    try {
      const { data } = await axios.get(`https://apis.davidcyriltech.my.id/googleimage?query=${encodeURIComponent(query)}`, { timeout: 10000 });
      if (data && data.result && data.result.length) {
        const images = data.result.sort(() => Math.random() - 0.5).slice(0, 5);
        for (const url of images) {
          await conn.sendMessage(m.key.remoteJid, {
            image: { url },
            caption: boxWithFooter('🔍 Google Image', [{ label: '🔎 Query', value: query }]),
          }, { quoted: m });
        }
        await react('✅');
        return;
      }
    } catch (_) {}

    // Méthode 2 : llm-search (local, sans API)
    if (llmSearch && llmSearch.search) {
      const results = await llmSearch.search(query, { limit: 5 });
      if (results && results.length) {
        for (const r of results) {
          if (r.url && (r.url.endsWith('.jpg') || r.url.endsWith('.png') || r.url.endsWith('.webp'))) {
            await conn.sendMessage(m.key.remoteJid, {
              image: { url: r.url },
              caption: boxWithFooter('🔍 Google Image', [{ label: '🔎 Titre', value: r.title || query }]),
            }, { quoted: m });
          }
        }
        await react('✅');
        return;
      }
    }

    // Aucun résultat
    await react('❌');
    return reply(boxWithFooter('🔍 Google Image', [{ raw: '❌ Aucune image trouvée pour cette requête.' }]));
  } catch (e) {
    console.error('[IMG]', e.message);
    await react('❌');
    return reply(boxWithFooter('🔍 Google Image', [{ raw: '❌ Erreur lors de la recherche.' }]));
  }
});
