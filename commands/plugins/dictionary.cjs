const { cmd } = require('../command.cjs');
const axios = require('axios');
const { box, truncate } = require('../lib/djousse-ui.cjs');

cmd({ pattern: 'dictionary', alias: ['define', 'definition', 'dico'], react: '📖', desc: 'Définition d\'un mot anglais', category: 'tools', filename: __filename }, async (conn, m, commands, { q, reply }) => {
  if (!q) {
    return reply(box('📖 *DICTIONNAIRE*', [
      { label: 'Utilisation', value: '.dictionary <mot>' },
      { label: 'Exemple', value: '.dictionary hello' },
      { blank: true },
      { raw: '_Fonctionne uniquement pour les mots anglais (API publique)._' },
    ]));
  }
  try {
    const word = q.trim().split(/\s+/)[0].toLowerCase();
    const { data } = await axios.get(
      'https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word),
      { timeout: 15000 }
    );
    const entry = Array.isArray(data) ? data[0] : null;
    if (!entry) return reply(box('❌ *AUCUN RÉSULTAT*', [{ raw: `Aucune définition trouvée pour "${word}".` }]));

    const phonetic = entry.phonetic || entry.phonetics?.find(p => p.text)?.text || '';
    const lines = [];
    for (const meaning of (entry.meanings || []).slice(0, 3)) {
      const defs = (meaning.definitions || []).slice(0, 2);
      lines.push({ raw: `*${meaning.partOfSpeech}*` });
      for (const d of defs) {
        lines.push({ raw: '• ' + truncate(d.definition, 150) });
        if (d.example) lines.push({ raw: '  _ex: ' + truncate(d.example, 100) + '_' });
      }
      lines.push({ blank: true });
    }

    reply(box(`📖 *${entry.word.toUpperCase()}*${phonetic ? ' — ' + phonetic : ''}`, lines));
  } catch (e) {
    if (e.response?.status === 404) {
      return reply(box('❌ *AUCUN RÉSULTAT*', [{ raw: `Aucune définition trouvée pour "${q.trim()}".` }]));
    }
    reply(box('❌ *ERREUR*', [{ raw: '```' + e.message + '```' }]));
  }
});
