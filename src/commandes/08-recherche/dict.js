'use strict';

const axios = require('axios');
const style = require('../../config/style');

module.exports = {
  commands: ['dict', 'meaning'],
  description: 'Look up the definition of an English word',
  usage: '.dict <word>',
  permission: 'public',
  run: async (sock, message, args, ctx) => {
    const word = String(args[0] || '').trim().toLowerCase();
    if (!word) {
      return ctx.reply(style.renderError(['Usage: .dict <word>', 'Example: .dict serendipity']));
    }

    try {
      const response = await axios.get(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
        { timeout: 8000 },
      );
      const entry = response.data?.[0];
      if (!entry || !Array.isArray(entry.meanings)) {
        throw new Error('Dictionary returned an invalid response.');
      }

      const phonetic = entry.phonetic || entry.phonetics?.find((item) => item.text)?.text || '';
      const lines = [`📖 *Definition: ${entry.word || word}*`];
      if (phonetic) lines.push(`🔊 _${phonetic}_`);

      for (const meaning of entry.meanings.slice(0, 3)) {
        lines.push('', `*${meaning.partOfSpeech || 'Meaning'}*`);
        for (const [index, definition] of (meaning.definitions || []).slice(0, 2).entries()) {
          lines.push(`${index + 1}. ${definition.definition || 'No definition available.'}`);
          if (definition.example) lines.push(`   _"${definition.example}"_`);
        }
        if (meaning.synonyms?.length) {
          lines.push(`🔁 *Synonyms:* ${meaning.synonyms.slice(0, 5).join(', ')}`);
        }
      }
      await ctx.reply(style.renderInfo(lines));
    } catch (error) {
      const status = error.response?.status;
      const detail = status === 404
        ? `No definition found for "${word}".`
        : 'Dictionary lookup failed. Please try again later.';
      if (status !== 404) console.warn('[DICT] lookup failed:', error.message);
      await ctx.reply(style.renderError([detail]));
    }
  },
};
